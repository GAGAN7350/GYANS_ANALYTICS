import os
import uuid
import json
import math
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import UploadFile, HTTPException

from app.models.dataset import Dataset, ColumnMetadata
from app.services.ml_engine.pattern_detector import PatternRecognitionEngine
from app.services.ml_engine.decision_engine import DecisionEngine

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

DEMO_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "demo_data"))

SAMPLE_DATASETS: Dict[str, Dict[str, Any]] = {
    "retail_sales": {
        "id": "retail_sales",
        "name": "Global Retail & E-Commerce Performance",
        "category": "Retail & E-Commerce",
        "filename": "retail_sales_sample.csv",
        "description": "Multi-category transactional ledger tracking revenue, discounting strategy, and profitability margins across customer cohorts.",
        "tags": ["Revenue", "Margin", "Discounts", "Segments"],
    },
    "clinical_health": {
        "id": "clinical_health",
        "name": "Clinical Biometrics & Metabolic Health",
        "category": "Healthcare & Life Sciences",
        "filename": "clinical_health_sample.csv",
        "description": "Patient metabolic health markers examining fasting glucose, blood pressure, BMI, and physical activity risk tiers.",
        "tags": ["Glucose", "Blood Pressure", "BMI", "Risk Tier"],
    },
    "fintech_fraud": {
        "id": "fintech_fraud",
        "name": "FinTech Fraud Detection & Risk Scoring",
        "category": "FinTech & Payments",
        "filename": "fintech_fraud_sample.csv",
        "description": "High-velocity financial transaction stream with latency metrics, device trust scoring, and anomalous behavior flags.",
        "tags": ["Fraud Detection", "Risk Scoring", "Latency", "Distance"],
    },
    "saas_subscription": {
        "id": "saas_subscription",
        "name": "B2B SaaS Growth & Churn Analytics",
        "category": "Software & Subscription",
        "filename": "saas_subscription_sample.csv",
        "description": "Account retention metrics examining Monthly Recurring Revenue (MRR), seat utilization, support tickets, and churn risk.",
        "tags": ["MRR", "Churn Risk", "NPS", "Seat Expansion"],
    },
}

# ---------------------------------------------------------------------------
# FORMAT REGISTRY
# Add a new format by adding one entry here — no other code changes needed.
# Each entry: "ext" -> { "label": human name, "reader": callable(file_path)->DataFrame }
# ---------------------------------------------------------------------------
def _read_sql_file(file_path: str) -> pd.DataFrame:
    """
    Parse a .sql dump file and return the INSERT data as a DataFrame.
    Supports: INSERT INTO table VALUES (...) syntax.
    Future: connect to live DB via SQLAlchemy engine URL.
    """
    import re
    rows = []
    columns = []
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    # Extract column names from CREATE TABLE
    create_match = re.search(
        r"CREATE TABLE[^(]+\((.+?)\);", content, re.DOTALL | re.IGNORECASE
    )
    if create_match:
        col_block = create_match.group(1)
        columns = [
            re.match(r'\s*[`"\[]?(\w+)', line).group(1)
            for line in col_block.split("\n")
            if re.match(r'\s*[`"\[]?\w', line)
            and not re.match(r'\s*(PRIMARY|KEY|UNIQUE|INDEX|CONSTRAINT|ENGINE)', line, re.IGNORECASE)
        ]

    # Extract INSERT rows
    for insert in re.finditer(
        r"INSERT INTO[^(]+\((.+?)\)\s*VALUES\s*(.+?);", content, re.DOTALL | re.IGNORECASE
    ):
        col_part = insert.group(1)
        val_part = insert.group(2)
        if not columns:
            columns = [c.strip().strip('`"[]') for c in col_part.split(",")]
        # Parse individual row tuples
        for row_match in re.finditer(r"\(([^)]+)\)", val_part):
            vals = [v.strip().strip("'\"") for v in row_match.group(1).split(",")]
            if len(vals) == len(columns):
                rows.append(dict(zip(columns, vals)))

    if not rows:
        raise ValueError(
            "No parseable INSERT data found in .sql file. "
            "Ensure the file contains INSERT INTO ... VALUES ... statements."
        )
    return pd.DataFrame(rows)


def _read_pdf_file(file_path: str) -> pd.DataFrame:
    """
    Smart PDF reader:
    - Text PDFs: pdfplumber extracts tables directly
    - Scanned/Image PDFs: easyocr OCR fallback
    - Smart filter: rejects logos, diagrams, and decorative images
      based on size, aspect ratio, pixel variance, and numeric content ratio
    """
    import warnings
    warnings.filterwarnings("ignore")

    all_dfs: list = []

    # ── Step 1: pdfplumber for text-based PDFs ──────────────────────────────
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(
            status_code=400,
            detail="PDF support requires pdfplumber. Run: pip install pdfplumber"
        )

    try:
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                # Try standard table extraction first
                tables = page.extract_tables()
                # If no bordered tables found, try text-alignment extraction for borderless tables
                if not tables:
                    tables = page.extract_tables(table_settings={
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text",
                        "snap_tolerance": 5,
                    })

                for tbl in tables:
                    if not tbl or len(tbl) < 2:
                        continue
                    try:
                        # Clean cells and header row
                        header = [str(c).strip() if c is not None and str(c).strip() else f"Col_{i+1}" for i, c in enumerate(tbl[0])]
                        data_rows = tbl[1:]
                        df = pd.DataFrame(data_rows, columns=header)
                        df = df.dropna(axis=1, how="all").dropna(axis=0, how="all")
                        if not df.empty and len(df.columns) >= 1:
                            all_dfs.append(df)
                    except Exception:
                        continue
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to open PDF: {str(e)}")

    if all_dfs:
        combined = pd.concat(all_dfs, ignore_index=True)
        # Ensure column names are clean strings
        combined.columns = [str(c).strip() for c in combined.columns]
        return combined

    # ── Step 2: OCR fallback for scanned/image PDFs ─────────────────────────
    print("[PDF] No text tables found. Trying OCR fallback...")

    try:
        import easyocr
        import numpy as np_pdf
    except ImportError:
        raise HTTPException(
            status_code=400,
            detail=(
                "This PDF appears to be scanned/image-based. "
                "Install OCR support: pip install easyocr pdf2image"
            )
        )

    try:
        from pdf2image import convert_from_path
    except ImportError:
        raise HTTPException(
            status_code=400,
            detail="pdf2image is required for scanned PDFs. Run: pip install pdf2image"
        )

    def _is_data_image(img_array) -> tuple:
        """Filter: returns (is_data, reason). Rejects logos, blanks, and diagrams."""
        h, w = img_array.shape[:2]
        if w < 100 or h < 50:
            return False, f"Too small ({w}x{h}px)"
        aspect = w / max(h, 1)
        if aspect > 10 or aspect < 0.1:
            return False, f"Extreme aspect ratio ({aspect:.1f}:1) — likely a logo or banner"
        variance = float(np_pdf.var(img_array))
        if variance < 100:
            return False, f"Low pixel variance ({variance:.1f}) — likely blank or solid color"
        return True, "ok"

    def _has_enough_numbers(text: str, threshold: float = 0.30) -> bool:
        """Returns True if ≥30% of tokens contain digits — indicates tabular data."""
        tokens = text.split()
        if not tokens:
            return False
        numeric_count = sum(1 for t in tokens if any(ch.isdigit() for ch in t))
        return (numeric_count / len(tokens)) >= threshold

    try:
        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        pages = convert_from_path(file_path, dpi=200)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process PDF pages: {str(e)}")

    skipped = 0
    for page_num, page_img in enumerate(pages, 1):
        img_array = np_pdf.array(page_img)
        is_data, reason = _is_data_image(img_array)
        if not is_data:
            print(f"[PDF] Page {page_num}: SKIPPED — {reason}")
            skipped += 1
            continue

        try:
            results = reader.readtext(img_array, detail=0, paragraph=True)
            full_text = " ".join(results)
        except Exception:
            print(f"[PDF] Page {page_num}: OCR failed, skipping")
            skipped += 1
            continue

        if not _has_enough_numbers(full_text):
            print(f"[PDF] Page {page_num}: SKIPPED — not enough numeric content (likely a diagram or photo)")
            skipped += 1
            continue

        try:
            lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]
            if len(lines) >= 2:
                parsed = [ln.split() for ln in lines]
                max_cols = max(len(r) for r in parsed)
                padded = [r + [""] * (max_cols - len(r)) for r in parsed]
                df = pd.DataFrame(padded[1:], columns=[f"col_{i}" for i in range(max_cols)])
                df = df.replace("", pd.NA).dropna(axis=1, how="all").dropna(axis=0, how="all")
                if not df.empty:
                    all_dfs.append(df)
        except Exception:
            print(f"[PDF] Page {page_num}: Failed to parse OCR text into table")
            continue

    if not all_dfs:
        raise ValueError(
            f"No tabular data found in PDF. "
            f"Skipped {skipped} page(s) — they appeared to be logos, diagrams, or decorative images. "
            "Ensure the PDF contains tables or structured numeric data."
        )

    return pd.concat(all_dfs, ignore_index=True)


def _read_csv_smart(path: str) -> pd.DataFrame:
    """
    Robust CSV/Text reader that auto-detects delimiters (comma, semicolon, tab, pipe)
    and encodings so data never collapses into a single column.
    """
    import csv

    for enc in ("utf-8", "utf-8-sig", "latin1", "cp1252"):
        try:
            sample_lines = []
            with open(path, "r", encoding=enc, errors="replace") as f:
                for _ in range(25):
                    line = f.readline()
                    if not line:
                        break
                    if line.strip():
                        sample_lines.append(line)

            if not sample_lines:
                return pd.DataFrame()

            sample_text = "".join(sample_lines)

            # 1. Try python csv.Sniffer
            detected_delim = None
            try:
                dialect = csv.Sniffer().sniff(sample_text, delimiters=",\t;|")
                detected_delim = dialect.delimiter
            except Exception:
                pass

            # 2. Count common delimiters in the first non-empty line
            if not detected_delim:
                first_line = sample_lines[0]
                counts = {
                    ",": first_line.count(","),
                    ";": first_line.count(";"),
                    "\t": first_line.count("\t"),
                    "|": first_line.count("|"),
                }
                best = max(counts, key=counts.get)
                detected_delim = best if counts[best] > 0 else ","

            df = pd.read_csv(
                path,
                encoding=enc,
                sep=detected_delim,
                low_memory=False,
                on_bad_lines="skip"
            )

            # 3. Guard against 1-column collapse if other separators exist
            if len(df.columns) <= 1:
                for alt in (";", "\t", ",", "|"):
                    if alt != detected_delim and alt in sample_text:
                        try:
                            alt_df = pd.read_csv(
                                path,
                                encoding=enc,
                                sep=alt,
                                low_memory=False,
                                on_bad_lines="skip"
                            )
                            if len(alt_df.columns) > len(df.columns):
                                df = alt_df
                                break
                        except Exception:
                            pass

            # Clean column names
            df.columns = [str(c).strip().strip("\"'") for c in df.columns]
            return df
        except (UnicodeDecodeError, Exception):
            continue

    raise ValueError("Could not parse file into columns with supported encodings.")


FORMAT_REGISTRY: Dict[str, Dict[str, Any]] = {
    # Flat text
    ".csv":     {"label": "CSV",                "reader": lambda p: _read_csv_smart(p)},
    ".tsv":     {"label": "TSV",                "reader": lambda p: _read_csv_smart(p)},
    ".txt":     {"label": "Text (CSV)",         "reader": lambda p: _read_csv_smart(p)},
    # Excel
    ".xlsx":    {"label": "Excel (xlsx)",       "reader": lambda p: pd.read_excel(p, engine="openpyxl")},
    ".xls":     {"label": "Excel (xls)",        "reader": lambda p: pd.read_excel(p, engine="xlrd")},
    ".xlsm":    {"label": "Excel Macro",        "reader": lambda p: pd.read_excel(p, engine="openpyxl")},
    # JSON variants
    ".json":    {"label": "JSON",               "reader": lambda p: _read_json_smart(p)},
    ".jsonl":   {"label": "JSON Lines",         "reader": lambda p: pd.read_json(p, lines=True)},
    ".ndjson":  {"label": "NDJSON",             "reader": lambda p: pd.read_json(p, lines=True)},
    # Columnar / Big-data
    ".parquet": {"label": "Parquet",            "reader": lambda p: pd.read_parquet(p)},
    ".orc":     {"label": "ORC",                "reader": lambda p: pd.read_orc(p)},
    ".feather": {"label": "Feather",            "reader": lambda p: pd.read_feather(p)},
    # Markup / Config
    ".xml":     {"label": "XML",                "reader": lambda p: pd.read_xml(p)},
    ".html":    {"label": "HTML Table",         "reader": lambda p: pd.read_html(p)[0]},
    # Database dumps
    ".sql":     {"label": "SQL Dump",           "reader": lambda p: _read_sql_file(p)},
    # Documents
    ".pdf":     {"label": "PDF",                "reader": lambda p: _read_pdf_file(p)},
    # Stats / Scientific
    ".sas7bdat":{"label": "SAS",               "reader": lambda p: pd.read_sas(p)},
    ".dta":     {"label": "Stata",              "reader": lambda p: pd.read_stata(p)},
    ".sav":     {"label": "SPSS",               "reader": lambda p: pd.read_spss(p)},
}

SUPPORTED_EXTENSIONS = set(FORMAT_REGISTRY.keys())


def _try_encodings(reader_fn, path: str, **kwargs) -> pd.DataFrame:
    """Try multiple encodings for text files."""
    for enc in ("utf-8", "utf-8-sig", "latin1", "cp1252"):
        try:
            return reader_fn(path, encoding=enc, low_memory=False, **kwargs)
        except (UnicodeDecodeError, Exception):
            continue
    raise ValueError("Could not decode file with any supported encoding.")


def _read_json_smart(path: str) -> pd.DataFrame:
    """Handle both JSON arrays and JSON Lines."""
    try:
        return pd.read_json(path)
    except Exception:
        return pd.read_json(path, lines=True)


class DatasetService:
    @staticmethod
    def _read_file_to_df(file_path: str, filename: str) -> pd.DataFrame:
        """Reads any supported file format into a pandas DataFrame."""
        ext = os.path.splitext(filename)[1].lower()
        fmt = FORMAT_REGISTRY.get(ext)
        if not fmt:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )
        try:
            return fmt["reader"](file_path)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse {fmt['label']} file: {str(e)}")

    @staticmethod
    async def create_from_upload(
        db: AsyncSession,
        file: UploadFile,
        workspace_id: str,
        user_id: str,
        dataset_name: Optional[str] = None
    ) -> Dataset:
        """Saves uploaded file, parses schema, runs pattern recognition, and saves to DB."""
        orig_filename = file.filename or "uploaded_dataset.csv"
        clean_name = dataset_name or os.path.splitext(orig_filename)[0].replace("_", " ").title()

        file_ext = os.path.splitext(orig_filename)[1].lower()
        if file_ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format '{file_ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )

        unique_filename = f"{uuid.uuid4()}_{orig_filename}"
        saved_file_path = os.path.join(UPLOAD_DIR, unique_filename)

        # Write file to disk
        try:
            contents = await file.read()
            with open(saved_file_path, "wb") as f:
                f.write(contents)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

        # Read with Pandas
        df = DatasetService._read_file_to_df(saved_file_path, orig_filename)
        if df.empty:
            raise HTTPException(status_code=400, detail="Uploaded dataset contains no data rows.")

        # Clean column names (strip whitespace)
        df.columns = [str(c).strip() for c in df.columns]

        # 1. Run Data Health & Decisions
        health_info = DecisionEngine.calculate_data_health(df)

        # 2. Run Machine Learning Pattern Recognition
        ml_patterns = PatternRecognitionEngine.analyze_dataset_patterns(df)

        # 3. Create Dataset Record
        dataset = Dataset(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            name=clean_name,
            description=f"Ingested from {orig_filename} ({len(df)} rows, {len(df.columns)} columns)",
            source_type="file_upload",
            file_path=saved_file_path,
            row_count=int(len(df)),
            status="ready",
            created_by=user_id,
            connection_config={
                "original_filename": orig_filename,
                "health": health_info,
                "ml_patterns": ml_patterns
            }
        )
        db.add(dataset)
        await db.flush()

        # 4. Generate & Save Column Metadata
        for col_name in df.columns:
            series = df[col_name]
            
            # Simple data type classification
            if pd.api.types.is_numeric_dtype(series):
                col_type = "number"
            elif pd.api.types.is_datetime64_any_dtype(series):
                col_type = "datetime"
            elif pd.api.types.is_bool_dtype(series):
                col_type = "boolean"
            else:
                col_type = "string"

            # Semantics & Diagnostics
            semantics = DecisionEngine.classify_column_semantics(col_name, series)

            # Sample values (up to 5 non-null)
            samples = [str(x) for x in series.dropna().head(5).tolist()]

            # Numeric stats if available
            stats = {}
            if col_type == "number" and not series.dropna().empty:
                stats = {
                    "min": float(series.min()) if not pd.isna(series.min()) else None,
                    "max": float(series.max()) if not pd.isna(series.max()) else None,
                    "mean": float(round(series.mean(), 2)) if not pd.isna(series.mean()) else None,
                    "median": float(round(series.median(), 2)) if not pd.isna(series.median()) else None,
                }

            col_meta = ColumnMetadata(
                id=str(uuid.uuid4()),
                dataset_id=dataset.id,
                name=col_name,
                data_type=col_type,
                is_nullable=bool(series.isna().any()),
                sample_values=samples,
                stats={
                    "numeric_stats": stats,
                    "semantics": semantics
                }
            )
            db.add(col_meta)

        await db.commit()
        await db.refresh(dataset)
        return dataset

    @staticmethod
    async def get_preview(dataset: Dataset, limit: int = 100) -> Dict[str, Any]:
        """Loads first N rows from dataset file and formats as JSON table preview."""
        if not dataset.file_path or not os.path.exists(dataset.file_path):
            raise HTTPException(status_code=404, detail="Dataset file not found on disk.")

        df = DatasetService._read_file_to_df(dataset.file_path, dataset.file_path)
        preview_df = df.head(limit)

        # Replace NaN / Inf with None for JSON serialization
        preview_df = preview_df.replace([np.inf, -np.inf], None)
        preview_df = preview_df.where(pd.notnull(preview_df), None)

        rows = preview_df.to_dict(orient="records")
        columns = [{"name": c, "type": str(df[c].dtype)} for c in df.columns]

        return {
            "columns": columns,
            "rows": rows,
            "total_rows": int(len(df)),
            "preview_count": int(len(rows))
        }

    @staticmethod
    def get_sample_catalog() -> List[Dict[str, Any]]:
        """Returns catalog of pre-loaded demo datasets with stats."""
        catalog = []
        for key, info in SAMPLE_DATASETS.items():
            file_path = os.path.join(DEMO_DATA_DIR, info["filename"])
            row_count = 0
            col_count = 0
            if os.path.exists(file_path):
                try:
                    df = pd.read_csv(file_path)
                    row_count = len(df)
                    col_count = len(df.columns)
                except Exception:
                    pass
            catalog.append({
                "id": key,
                "name": info["name"],
                "category": info["category"],
                "description": info["description"],
                "rowCount": row_count,
                "colCount": col_count,
                "tags": info["tags"],
            })
        return catalog

    @staticmethod
    async def create_from_sample(
        db: AsyncSession,
        workspace_id: str,
        user_id: str,
        sample_id: str
    ) -> Dataset:
        """Seeds a pre-loaded sample dataset into the target workspace."""
        import shutil

        if sample_id not in SAMPLE_DATASETS:
            raise HTTPException(
                status_code=404,
                detail=f"Sample dataset '{sample_id}' not found. Available: {', '.join(SAMPLE_DATASETS.keys())}"
            )

        info = SAMPLE_DATASETS[sample_id]
        src_path = os.path.join(DEMO_DATA_DIR, info["filename"])
        if not os.path.exists(src_path):
            raise HTTPException(
                status_code=500,
                detail=f"Sample data file '{info['filename']}' not found on server."
            )

        unique_filename = f"{uuid.uuid4()}_{info['filename']}"
        saved_file_path = os.path.join(UPLOAD_DIR, unique_filename)

        try:
            shutil.copyfile(src_path, saved_file_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to stage sample file: {str(e)}")

        df = pd.read_csv(saved_file_path)
        df.columns = [str(c).strip() for c in df.columns]

        # 1. Run Data Health & Decisions
        health_info = DecisionEngine.calculate_data_health(df)

        # 2. Run Machine Learning Pattern Recognition
        ml_patterns = PatternRecognitionEngine.analyze_dataset_patterns(df)

        # 3. Create Dataset Record
        dataset = Dataset(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            name=info["name"],
            description=f"{info['description']} (Pre-loaded Demo: {len(df)} rows, {len(df.columns)} columns)",
            source_type="sample_demo",
            file_path=saved_file_path,
            row_count=int(len(df)),
            status="ready",
            created_by=user_id,
            connection_config={
                "original_filename": info["filename"],
                "health": health_info,
                "ml_patterns": ml_patterns,
                "sample_id": sample_id
            }
        )
        db.add(dataset)
        await db.flush()

        # 4. Generate & Save Column Metadata
        for col_name in df.columns:
            series = df[col_name]
            if pd.api.types.is_numeric_dtype(series):
                col_type = "number"
            elif pd.api.types.is_datetime64_any_dtype(series):
                col_type = "datetime"
            elif pd.api.types.is_bool_dtype(series):
                col_type = "boolean"
            else:
                col_type = "string"

            semantics = DecisionEngine.classify_column_semantics(col_name, series)
            samples = [str(x) for x in series.dropna().head(5).tolist()]

            stats = {}
            if col_type == "number" and not series.dropna().empty:
                stats = {
                    "min": float(series.min()) if not pd.isna(series.min()) else None,
                    "max": float(series.max()) if not pd.isna(series.max()) else None,
                    "mean": float(round(series.mean(), 2)) if not pd.isna(series.mean()) else None,
                    "median": float(round(series.median(), 2)) if not pd.isna(series.median()) else None,
                }

            col_meta = ColumnMetadata(
                id=str(uuid.uuid4()),
                dataset_id=dataset.id,
                name=col_name,
                data_type=col_type,
                is_nullable=bool(series.isna().any()),
                sample_values=samples,
                stats={
                    "numeric_stats": stats,
                    "semantics": semantics
                }
            )
            db.add(col_meta)

        await db.commit()
        await db.refresh(dataset)
        return dataset
