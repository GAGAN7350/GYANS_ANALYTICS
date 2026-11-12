import pytest
from app.services.dataset_service import DatasetService


def test_sample_catalog_available():
    catalog = DatasetService.get_sample_catalog()
    assert len(catalog) >= 4
    sample_ids = {c["id"] for c in catalog}
    assert "retail_sales" in sample_ids
    assert "clinical_health" in sample_ids
    assert "fintech_fraud" in sample_ids
    assert "saas_subscription" in sample_ids

    for c in catalog:
        assert c["rowCount"] > 0
        assert c["colCount"] > 0
        assert len(c["tags"]) > 0
