import re
from typing import Dict, Any, List
import pandas as pd
import numpy as np


class DecisionEngine:
    """
    Sub-50ms Structured Decision Engine for GYAN Analytics.
    Executes fast heuristic & probabilistic decisions:
    - Smart Chart Recommendation (Choice)
    - Semantic Column Tagging (Choice + Boolean)
    - Data Health & Quality (Score 0-100)
    """

    @staticmethod
    def classify_column_semantics(col_name: str, series: pd.Series) -> Dict[str, Any]:
        """Classifies a column's real-world business meaning and security status."""
        name_lower = col_name.lower().strip()
        sample_non_null = series.dropna().astype(str).head(50).tolist()
        
        is_pii = False
        semantic_type = "generic_text"
        confidence = 0.85

        # PII / Security checks
        if any(k in name_lower for k in ["email", "e-mail"]):
            is_pii = True
            semantic_type = "email"
            confidence = 0.99
        elif any(k in name_lower for k in ["phone", "mobile", "contact", "ssn", "password", "secret"]):
            is_pii = True
            semantic_type = "sensitive_pii"
            confidence = 0.98
        elif any(k in name_lower for k in ["id", "uuid", "key", "code"]) and not pd.api.types.is_numeric_dtype(series):
            semantic_type = "identifier"
            confidence = 0.92
        elif any(k in name_lower for k in ["price", "revenue", "cost", "salary", "sales", "amount", "profit", "discount", "fee", "tax"]):
            semantic_type = "currency"
            confidence = 0.95
        elif any(k in name_lower for k in ["rate", "percent", "pct", "ratio", "margin"]):
            semantic_type = "percentage"
            confidence = 0.95
        elif any(k in name_lower for k in ["date", "time", "created_at", "updated_at", "timestamp", "year", "month"]):
            semantic_type = "temporal"
            confidence = 0.96
        elif any(k in name_lower for k in ["city", "country", "state", "region", "zip", "postal", "address", "lat", "lon"]):
            semantic_type = "geographical"
            confidence = 0.92
        elif pd.api.types.is_numeric_dtype(series):
            semantic_type = "quantitative_metric"
            confidence = 0.90
        elif pd.api.types.is_datetime64_any_dtype(series):
            semantic_type = "temporal"
            confidence = 0.99
        elif series.nunique() <= min(15, len(series)):
            semantic_type = "categorical_dimension"
            confidence = 0.91

        return {
            "semantic_type": semantic_type,
            "is_pii": is_pii,
            "confidence": confidence,
            "cardinality": int(series.nunique()),
            "missing_count": int(series.isna().sum())
        }

    @staticmethod
    def recommend_chart(selected_columns: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Fast Decision: Chooses optimal visualization widget based on selected data types.
        Input: list of { "name": "...", "type": "number|string|datetime", "semantic": "..." }
        """
        if not selected_columns:
            return {"recommended_chart": "table", "confidence": 0.5, "reason": "No columns selected."}

        num_cols = len(selected_columns)
        types = [c.get("type", "string") for c in selected_columns]
        semantics = [c.get("semantic", "") for c in selected_columns]

        has_temporal = any(t == "datetime" or s == "temporal" for t, s in zip(types, semantics))
        numeric_count = sum(1 for t in types if t in ["number", "float", "int", "integer"])
        categorical_count = sum(1 for t in types if t in ["string", "category", "boolean"])

        # 1 Single Number -> KPI Card
        if num_cols == 1 and numeric_count == 1:
            return {
                "recommended_chart": "kpi_number",
                "confidence": 0.98,
                "reason": "Single numerical metric selected; ideal for summary KPI card."
            }

        # Temporal + Numeric -> Line Chart / Area Chart
        if has_temporal and numeric_count >= 1:
            return {
                "recommended_chart": "line",
                "confidence": 0.97,
                "reason": "Time dimension combined with continuous metric; line chart best shows trend over time."
            }

        # 1 Category + 1 Metric -> Bar Chart (or Pie if low cardinality)
        if categorical_count == 1 and numeric_count == 1:
            return {
                "recommended_chart": "bar",
                "confidence": 0.95,
                "reason": "One categorical dimension and one metric; bar chart optimal for clear ranking/comparison."
            }

        # 2 Numeric variables -> Scatter Plot
        if numeric_count == 2 and categorical_count == 0:
            return {
                "recommended_chart": "scatter",
                "confidence": 0.94,
                "reason": "Two numerical variables; scatter plot ideal for evaluating correlation and distribution."
            }

        # Multi-metric comparison -> Multi-bar / Stacked Area
        if numeric_count >= 2 and categorical_count == 1:
            return {
                "recommended_chart": "bar",
                "sub_type": "grouped_bar",
                "confidence": 0.92,
                "reason": "Multiple metrics across categories; grouped bar chart shows side-by-side performance."
            }

        # Fallback to Table
        return {
            "recommended_chart": "table",
            "confidence": 0.85,
            "reason": "Multivariate tabular data; data table provides comprehensive exploration."
        }

    @staticmethod
    def calculate_data_health(df: pd.DataFrame) -> Dict[str, Any]:
        """Calculates a 0-100 data quality score with diagnostic breakdown."""
        total_cells = df.size
        if total_cells == 0:
            return {"score": 0, "rating": "Empty", "deductions": []}

        score = 100
        deductions = []

        # 1. Missing values penalty
        missing_count = int(df.isna().sum().sum())
        missing_ratio = missing_count / total_cells
        if missing_ratio > 0:
            loss = min(35, int(missing_ratio * 100 * 1.5))
            score -= loss
            deductions.append(f"{loss} points deducted for {round(missing_ratio * 100, 1)}% missing values.")

        # 2. Duplicate rows penalty
        duplicate_count = int(df.duplicated().sum())
        if duplicate_count > 0:
            dup_ratio = duplicate_count / len(df)
            loss = min(20, int(dup_ratio * 50))
            score -= loss
            deductions.append(f"{loss} points deducted for {duplicate_count} duplicate rows.")

        # 3. High cardinality/unusable columns penalty
        high_null_cols = [c for c in df.columns if df[c].isna().mean() > 0.8]
        if high_null_cols:
            score -= len(high_null_cols) * 5
            deductions.append(f"{len(high_null_cols) * 5} points deducted for columns with >80% null values.")

        final_score = max(0, min(100, score))
        rating = "Excellent" if final_score >= 85 else ("Good" if final_score >= 70 else ("Fair" if final_score >= 50 else "Poor"))

        return {
            "health_score": final_score,
            "rating": rating,
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "missing_cells": missing_count,
            "duplicate_rows": duplicate_count,
            "diagnostic_notes": deductions
        }
