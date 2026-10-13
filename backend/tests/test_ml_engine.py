import pandas as pd
from app.services.ml_engine.pattern_detector import PatternRecognitionEngine
from app.services.ml_engine.decision_engine import DecisionEngine
from app.services.ml_engine.rag_service import DomainRAGService


def test_anomaly_detection():
    df = pd.DataFrame({
        "revenue": [100.0, 105.0, 98.0, 102.0, 1000.0],
        "orders": [10, 11, 10, 9, 150],
    })
    res = PatternRecognitionEngine.detect_anomalies(df, contamination=0.2)
    assert "anomaly_count" in res
    assert res["anomaly_count"] >= 1
    assert "anomaly_percentage" in res


def test_correlation_evaluation():
    df = pd.DataFrame({
        "a": [1.0, 2.0, 3.0, 4.0, 5.0],
        "b": [2.0, 4.0, 6.0, 8.0, 10.0],
    })
    res = PatternRecognitionEngine.evaluate_correlations(df)
    assert "top_drivers" in res
    drivers = res["top_drivers"]
    assert len(drivers) > 0
    assert abs(drivers[0]["correlation"]) > 0.95


def test_clustering():
    df = pd.DataFrame({
        "x": [1.0, 1.1, 1.2, 1.0, 0.9, 1.1, 10.0, 10.1, 10.2, 10.0, 9.9, 10.1],
        "y": [1.0, 0.9, 1.1, 1.0, 1.1, 0.9, 10.0, 9.9, 10.1, 10.0, 10.1, 9.9],
    })
    res = PatternRecognitionEngine.discover_clusters(df, max_clusters=2)
    assert "k" in res
    assert "clusters" in res
    assert len(res["clusters"]) == 2


def test_data_health():
    df = pd.DataFrame({
        "col1": [1, 2, 3, 4, 5],
        "col2": ["a", "b", "c", "d", "e"],
    })
    health = DecisionEngine.calculate_data_health(df)
    assert "health_score" in health
    assert health["health_score"] >= 80
    assert "rating" in health


def test_domain_inference():
    rag = DomainRAGService.get_instance()
    
    # Education
    edu_cols = ["math_score", "reading_score", "writing_score"]
    assert rag.infer_domain(columns=edu_cols) == "education"
    
    # Healthcare
    health_cols = ["patient_id", "glucose", "blood_pressure"]
    assert rag.infer_domain(columns=health_cols) == "healthcare"
    
    # Finance
    fin_cols = ["loan_amount", "credit_score", "interest_rate"]
    assert rag.infer_domain(columns=fin_cols) == "finance"
    
    # General Operations fallback
    generic_cols = ["feature_1", "feature_2", "dimension_3"]
    assert rag.infer_domain(columns=generic_cols) == "general_operations"
