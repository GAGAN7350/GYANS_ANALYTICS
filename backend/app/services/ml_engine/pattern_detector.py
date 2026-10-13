import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


class PatternRecognitionEngine:
    """
    100% Free, local Machine Learning pattern recognition engine.
    Detects anomalies, clusters data points, and computes statistical correlations.
    """

    @staticmethod
    def detect_anomalies(df: pd.DataFrame, contamination: float = 0.05) -> Dict[str, Any]:
        """
        Detects anomalous rows and spikes using Isolation Forest on numerical features.
        Returns indices of anomalous rows, anomaly count, and feature contributions.
        """
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not numeric_cols or len(df) < 5:
            return {
                "detected": False,
                "message": "Insufficient numerical data (minimum 5 rows and 1 numeric column required).",
                "anomaly_count": 0,
                "anomalous_rows": []
            }

        # Handle missing values with median imputation for ML
        clean_numeric = df[numeric_cols].fillna(df[numeric_cols].median())
        
        # Guard against zero variance columns
        std = clean_numeric.std()
        valid_cols = std[std > 0].index.tolist()
        if not valid_cols:
            return {
                "detected": False,
                "message": "Numerical columns have zero variance.",
                "anomaly_count": 0,
                "anomalous_rows": []
            }

        try:
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(clean_numeric[valid_cols])
            
            # Isolation Forest
            iso = IsolationForest(
                contamination=contamination,
                random_state=42,
                n_estimators=100
            )
            predictions = iso.fit_predict(X_scaled)
            scores = iso.decision_function(X_scaled)

            # -1 indicates anomaly
            anomaly_mask = predictions == -1
            anomaly_indices = df.index[anomaly_mask].tolist()
            
            anomalous_samples = []
            for idx in anomaly_indices[:15]: # return top 15 anomalous examples
                row_dict = df.loc[idx].to_dict()
                # serialize timestamps or nan
                clean_dict = {
                    k: (str(v) if pd.api.types.is_datetime64_any_dtype(type(v)) else (None if pd.isna(v) else v))
                    for k, v in row_dict.items()
                }
                anomalous_samples.append({
                    "row_index": int(idx),
                    "anomaly_score": float(round(-scores[df.index.get_loc(idx)], 4)),
                    "row_data": clean_dict
                })

            return {
                "detected": len(anomaly_indices) > 0,
                "anomaly_count": int(len(anomaly_indices)),
                "anomaly_percentage": float(round((len(anomaly_indices) / len(df)) * 100, 2)),
                "evaluated_columns": valid_cols,
                "anomalous_samples": anomalous_samples
            }
        except Exception as e:
            return {
                "detected": False,
                "error": str(e),
                "anomaly_count": 0,
                "anomalous_rows": []
            }

    @staticmethod
    def discover_clusters(df: pd.DataFrame, max_clusters: int = 4) -> Dict[str, Any]:
        """
        Unsupervised customer/data segmentation using K-Means.
        Identifies natural behavioral clusters and segment profiles.
        """
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(numeric_cols) < 2 or len(df) < 10:
            return {
                "clustered": False,
                "message": "At least 2 numerical features and 10 rows required for clustering.",
                "clusters": []
            }

        clean_numeric = df[numeric_cols].fillna(df[numeric_cols].median())
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(clean_numeric)

        # Dynamic number of clusters
        k = min(max_clusters, max(2, len(df) // 10))
        try:
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(X_scaled)
            
            clusters_summary = []
            for cluster_id in range(k):
                mask = cluster_labels == cluster_id
                count = int(np.sum(mask))
                percentage = float(round((count / len(df)) * 100, 1))
                
                # Mean values for numeric features in this cluster
                cluster_df = clean_numeric[mask]
                means = cluster_df.mean().round(2).to_dict()

                clusters_summary.append({
                    "cluster_id": cluster_id,
                    "name": f"Segment {cluster_id + 1}",
                    "size": count,
                    "percentage": percentage,
                    "feature_averages": means
                })

            return {
                "clustered": True,
                "k": k,
                "features_used": numeric_cols,
                "clusters": clusters_summary
            }
        except Exception as e:
            return {"clustered": False, "error": str(e), "clusters": []}

    @staticmethod
    def evaluate_correlations(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculates Pearson correlation matrix and identifies top positive/negative drivers.
        """
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(numeric_cols) < 2:
            return {
                "has_correlations": False,
                "message": "At least 2 numerical columns required to evaluate correlations.",
                "key_drivers": []
            }

        corr_matrix = df[numeric_cols].corr()
        
        # Find top pairs
        pairs = []
        for i in range(len(numeric_cols)):
            for j in range(i + 1, len(numeric_cols)):
                col1 = numeric_cols[i]
                col2 = numeric_cols[j]
                val = corr_matrix.loc[col1, col2]
                if not np.isnan(val):
                    pairs.append({
                        "feature_a": col1,
                        "feature_b": col2,
                        "correlation": float(round(val, 4)),
                        "strength": "strong" if abs(val) >= 0.7 else ("moderate" if abs(val) >= 0.4 else "weak"),
                        "relationship": "positive" if val > 0 else "negative"
                    })

        # Sort by absolute correlation
        pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)

        # Sanitize NaN → None so it's JSON-serializable
        corr_dict = {}
        for col, row_vals in corr_matrix.round(3).to_dict().items():
            corr_dict[col] = {
                k: (None if (v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v)))) else float(v))
                for k, v in row_vals.items()
            }

        return {
            "has_correlations": len(pairs) > 0,
            "top_drivers": pairs[:10],
            "correlation_matrix": corr_dict
        }

    @staticmethod
    def analyze_dataset_patterns(df: pd.DataFrame) -> Dict[str, Any]:
        """Runs the entire pattern recognition pipeline on a DataFrame."""
        return {
            "anomalies": PatternRecognitionEngine.detect_anomalies(df),
            "clusters": PatternRecognitionEngine.discover_clusters(df),
            "correlations": PatternRecognitionEngine.evaluate_correlations(df)
        }
