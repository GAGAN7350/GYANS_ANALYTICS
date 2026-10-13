"""
Domain Knowledge RAG (Retrieval-Augmented Generation) Service for GYAN Analytics.

Indexes and retrieves domain-specific business playbooks, industry KPI benchmarks,
anomaly triage guidelines, and executive strategic playbooks using local ChromaDB
and all-MiniLM-L6-v2 ONNX embeddings.
"""

import os
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Base paths
_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
_APP_DIR = os.path.dirname(os.path.dirname(_MODULE_DIR))  # backend/app
_KNOWLEDGE_BASE_DIR = os.path.join(_APP_DIR, "knowledge_base")
_DEFAULT_DB_DIR = os.path.join(os.path.dirname(_APP_DIR), "data", "vector_store")

# Domain aliases for fuzzy mapping
DOMAIN_SYNONYMS: Dict[str, str] = {
    "retail": "retail",
    "ecommerce": "retail",
    "e-commerce": "retail",
    "sales": "retail",
    "store": "retail",
    "superstore": "retail",
    "finance": "finance",
    "banking": "finance",
    "bank": "finance",
    "credit": "finance",
    "fraud": "finance",
    "loan": "finance",
    "healthcare": "healthcare",
    "health": "healthcare",
    "hospital": "healthcare",
    "clinical": "healthcare",
    "medical": "healthcare",
    "patient": "healthcare",
    "saas": "saas",
    "subscription": "saas",
    "software": "saas",
    "churn": "saas",
    "manufacturing": "manufacturing",
    "supply_chain": "manufacturing",
    "logistics": "manufacturing",
    "operations": "manufacturing",
    "factory": "manufacturing",
    "hr": "hr",
    "workforce": "hr",
    "employee": "hr",
    "attrition": "hr",
    "religious": "religious",
    "temple": "religious",
    "charity": "religious",
    "donation": "religious",
    "philanthropy": "religious",
    "church": "religious",
    "trust": "religious",
    "education": "education",
    "school": "education",
    "student": "education",
    "academic": "education",
    "university": "education",
    "college": "education",
    "general": "general_operations",
    "operations": "general_operations",
    "business": "general_operations",
    "general_operations": "general_operations",
    "general organization": "general_operations",
}

# Column semantic keyword fingerprints for automatic domain detection
DOMAIN_COLUMN_KEYWORDS: Dict[str, List[str]] = {
    "finance": [
        "loan", "credit", "balance", "amount", "transaction", "interest", "debt",
        "account", "payment", "fraud", "income", "tax", "investment", "borrower",
        "collateral", "risk", "rate", "deposit", "mortgage", "capital", "equity", "default"
    ],
    "healthcare": [
        "patient", "diagnosis", "blood", "heart", "disease", "treatment", "hospital",
        "glucose", "cholesterol", "bmi", "medical", "doctor", "surgery", "dose",
        "clinical", "symptom", "medicine", "vital", "insulin", "outcome", "pregnancies",
        "skinthickness", "bp", "pedigree"
    ],
    "hr": [
        "employee", "salary", "attrition", "department", "performance", "tenure",
        "experience", "hire", "rating", "compensation", "turnover", "job_role",
        "satisfaction", "promotion", "overtime", "wage", "staff"
    ],
    "saas": [
        "mrr", "arr", "churn", "subscription", "dau", "mau", "plan", "signup",
        "user_id", "session", "retention", "ltv", "cac", "feature_usage", "active_users"
    ],
    "manufacturing": [
        "machine", "inventory", "warehouse", "defect", "production", "supplier",
        "shipment", "factory", "sensor", "cycle_time", "yield", "equipment", "failure",
        "batch", "temperature", "pressure", "vibration", "downtime", "scrap"
    ],
    "education": [
        "student", "grade", "score", "exam", "gpa", "course", "school", "teacher",
        "attendance", "mark", "semester", "class", "faculty", "credits", "subject",
        "homework", "test_score", "enrollment", "math", "reading", "writing"
    ],
    "religious": [
        "donation", "temple", "church", "charity", "donor", "tithe", "offering",
        "volunteer", "grant", "fundraiser", "faith", "worship", "ngo", "devotee"
    ],
    "retail": [
        "product", "sku", "price", "discount", "order", "sales", "revenue",
        "quantity", "customer", "cart", "store", "shipping", "gross_margin", "merchandise", "retail"
    ],
}


class DomainRAGService:
    """
    Manages indexing and semantic vector retrieval of domain consulting playbooks.
    Uses ChromaDB with onnxruntime all-MiniLM-L6-v2 embeddings.
    """

    _instance: Optional["DomainRAGService"] = None

    def __init__(self, persist_dir: Optional[str] = None) -> None:
        self.persist_dir = persist_dir or _DEFAULT_DB_DIR
        os.makedirs(self.persist_dir, exist_ok=True)

        self._client = None
        self._collection = None
        self._playbooks_cache: Dict[str, Dict[str, Any]] = {}
        self._load_playbooks_from_disk()
        self._init_vector_store()

    @classmethod
    def get_instance(cls) -> "DomainRAGService":
        if cls._instance is None:
            cls._instance = DomainRAGService()
        return cls._instance

    def _load_playbooks_from_disk(self) -> None:
        """Loads raw JSON playbook files into in-memory cache."""
        if not os.path.exists(_KNOWLEDGE_BASE_DIR):
            logger.warning("Knowledge base directory not found at: %s", _KNOWLEDGE_BASE_DIR)
            return

        for fname in os.listdir(_KNOWLEDGE_BASE_DIR):
            if fname.endswith(".json"):
                fpath = os.path.join(_KNOWLEDGE_BASE_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    domain = data.get("domain", "").lower()
                    if domain:
                        self._playbooks_cache[domain] = data
                except Exception as exc:
                    logger.error("Failed to load playbook %s: %s", fname, exc)

    def _init_vector_store(self) -> None:
        """Initializes ChromaDB collection and indexes playbooks if not already indexed."""
        try:
            import chromadb
            from chromadb.utils import embedding_functions

            emb_fn = embedding_functions.DefaultEmbeddingFunction()
            self._client = chromadb.PersistentClient(path=self.persist_dir)
            self._collection = self._client.get_or_create_collection(
                name="gyan_domain_playbooks",
                embedding_function=emb_fn,
                metadata={"description": "GYAN Analytics Consulting Playbooks and Benchmarks"},
            )

            # Check if collection is empty
            count = self._collection.count()
            if count == 0 and self._playbooks_cache:
                self._index_all_playbooks()
            else:
                logger.info("ChromaDB vector collection ready with %d knowledge chunks.", count)

        except Exception as exc:
            logger.warning(
                "ChromaDB initialization failed: %s. RAG service will use direct playbook cache.",
                exc,
            )
            self._collection = None

    def _index_all_playbooks(self) -> None:
        """Chunks and stores all loaded playbooks into ChromaDB."""
        if self._collection is None:
            return

        documents: List[str] = []
        metadatas: List[Dict[str, Any]] = []
        ids: List[str] = []

        chunk_counter = 0
        for domain, pb in self._playbooks_cache.items():
            pb_name = pb.get("name", f"{domain.title()} Playbook")
            chunks = pb.get("knowledge_chunks", [])

            for ch in chunks:
                chunk_counter += 1
                doc_text = ch.get("text", "").strip()
                topic = ch.get("topic", "general")
                if doc_text:
                    documents.append(doc_text)
                    metadatas.append({
                        "domain": domain,
                        "topic": topic,
                        "playbook_name": pb_name,
                    })
                    ids.append(f"{domain}_{topic}_{chunk_counter}")

        if documents:
            logger.info("Indexing %d domain knowledge chunks into ChromaDB...", len(documents))
            self._collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )
            logger.info("ChromaDB indexing complete!")

    def resolve_domain(self, raw_domain: str) -> str:
        """Maps user/dataset domain strings to canonical playbook domain."""
        if not raw_domain:
            return "general_operations"
        norm = raw_domain.lower().replace("-", "_").strip()
        for syn, canon in DOMAIN_SYNONYMS.items():
            if syn in norm:
                return canon
        return "general_operations"

    def infer_domain(
        self,
        columns: Optional[List[str]] = None,
        dataset_name: str = "",
        raw_domain: str = "",
    ) -> str:
        """
        Intelligently determines the dataset's domain by inspecting:
        1. Explicit user/template domain string (if provided and valid)
        2. Dataset file/table name keywords
        3. Column name semantic scoring
        4. Safe fallback to general_operations (never forcing retail onto arbitrary data).
        """
        # 1. Check explicit raw_domain if provided and not generic
        if raw_domain:
            norm_raw = raw_domain.lower().replace("-", "_").strip()
            if norm_raw not in ("general", "general_operations", "general organization", "business", "unknown", ""):
                for syn, canon in DOMAIN_SYNONYMS.items():
                    if syn in norm_raw:
                        return canon

        # 2. Check dataset name
        if dataset_name:
            norm_name = dataset_name.lower().replace("-", "_").strip()
            for syn, canon in DOMAIN_SYNONYMS.items():
                if syn in norm_name and canon != "general_operations":
                    return canon

        # 3. Score against column names
        if columns:
            scores: Dict[str, int] = {k: 0 for k in DOMAIN_COLUMN_KEYWORDS.keys()}
            col_lowers = [str(c).lower().replace(" ", "_").replace("-", "_") for c in columns]

            for col in col_lowers:
                for dom, keywords in DOMAIN_COLUMN_KEYWORDS.items():
                    for kw in keywords:
                        if kw in col:
                            scores[dom] += 1

            best_dom = max(scores, key=scores.get)
            if scores[best_dom] > 0:
                return best_dom

        # 4. Fallback to general operations (clean universal baseline)
        return "general_operations"

    def retrieve_domain_context(
        self,
        domain: str = "",
        columns: Optional[List[str]] = None,
        dataset_name: str = "",
        target_kpi: str = "",
        anomaly_pct: float = 0.0,
        top_driver: str = "",
        n_results: int = 3,
    ) -> Dict[str, Any]:
        """
        Retrieves matching industry benchmarks, anomaly guidelines, and tactical initiatives
        for the given dataset domain and characteristics.
        """
        canon_domain = self.infer_domain(columns=columns, dataset_name=dataset_name, raw_domain=domain)
        playbook = (
            self._playbooks_cache.get(canon_domain)
            or self._playbooks_cache.get("general_operations", {})
            or self._playbooks_cache.get("retail", {})
        )
        benchmarks = playbook.get("benchmarks", {})
        playbook_name = playbook.get("name", f"{canon_domain.replace('_', ' ').title()} Operational Playbook")

        matched_texts: List[str] = []

        # 1. Semantic search via ChromaDB if available
        if self._collection is not None and self._collection.count() > 0:
            try:
                query_str = (
                    f"{canon_domain} industry KPI benchmarks for {target_kpi or 'revenue'} "
                    f"with anomaly rate {anomaly_pct:.1f}% and driver {top_driver}"
                )
                results = self._collection.query(
                    query_texts=[query_str],
                    n_results=min(n_results, self._collection.count()),
                    where={"domain": canon_domain},
                )
                if results and results.get("documents") and results["documents"][0]:
                    matched_texts = results["documents"][0]
            except Exception as exc:
                logger.warning("Vector retrieval failed: %s. Using direct playbook chunks.", exc)

        # 2. Fallback to direct chunks from playbook cache if vector search returned nothing
        if not matched_texts:
            chunks = playbook.get("knowledge_chunks", [])
            matched_texts = [c.get("text", "") for c in chunks[:n_results] if c.get("text")]

        # 3. Extract profit matrix and concrete prescriptions
        profit_matrix = playbook.get("profit_matrix", [])
        prescriptions = [item.get("prescription", "") for item in profit_matrix if item.get("prescription")]

        # 4. Extract recommended action steps
        actions: List[str] = []
        if profit_matrix:
            for item in profit_matrix:
                init = item.get("initiative", "")
                lever = item.get("lever", "")
                impact = item.get("financial_impact", "")
                actions.append(f"{init} ({impact}): {lever}")
        else:
            for text in matched_texts:
                if "Action Plan" in text or "Priority" in text:
                    import re
                    found = re.findall(r"\(\d+\)\s*([^;]+?)(?=;\s*\(\d+\)|$)", text)
                    if found:
                        actions = [it.strip().rstrip(".") for it in found]
                        break

        if not actions:
            actions = [
                f"Calibrate operational tolerances against {canon_domain.title()} industry KPI baselines",
                f"Isolate high-variance outliers exceeding the {benchmarks.get('anomaly_tolerance', '2.0%')} tolerance ceiling",
                f"Enforce cohort-specific retention protocols on primary driver segments",
            ]

        return {
            "domain": canon_domain,
            "playbook_name": playbook_name,
            "benchmarks": benchmarks,
            "profit_matrix": profit_matrix,
            "prescriptions": prescriptions,
            "retrieved_excerpts": matched_texts,
            "recommended_actions": actions[:3],
        }
