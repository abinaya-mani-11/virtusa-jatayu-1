import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db.database import Base, get_db

@pytest.fixture
def client():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_export_pdf_and_fhir(client):
    # 1. Create a record
    res = client.post("/api/records", json={
        "text": "At 14:32, administered oxygen at 10 liters per minute through a non-rebreather mask. At 14:36, administered 0.3 mg epinephrine intramuscularly.",
        "actor_id": "EMS-MEDIC-01"
    })
    record_id = res.json()["record_id"]

    # 2. Test PDF export
    pdf_res = client.get(f"/api/export/pdf/{record_id}")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF-")
    assert len(pdf_res.content) > 1000

    # 3. Test FHIR R4 Bundle export
    fhir_res = client.get(f"/api/export/fhir/{record_id}")
    assert fhir_res.status_code == 200
    bundle = fhir_res.json()
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "collection"
    assert len(bundle["entry"]) >= 2
    
    # Check that entries have valid FHIR resourceType
    resource_types = [e["resource"]["resourceType"] for e in bundle["entry"]]
    assert "MedicationAdministration" in resource_types

    # 4. Test Synthetic Scenarios
    scenarios_res = client.get("/api/export/scenarios")
    assert scenarios_res.status_code == 200
    scenarios = scenarios_res.json()
    assert len(scenarios) >= 10
