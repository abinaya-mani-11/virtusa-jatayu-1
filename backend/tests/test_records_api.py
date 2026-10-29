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

def test_create_and_fetch_record(client):
    payload = {
        "text": "At 14:36, administered 0.3 mg epinephrine IM.",
        "source_type": "typed_note",
        "actor_id": "EMS-MEDIC-04"
    }
    res = client.post("/api/records", json=payload)
    assert res.status_code == 201
    data = res.json()
    record_id = data["record_id"]
    assert data["source"]["type"] == "typed_note"
    assert len(data["events"]) >= 1
    
    # Fetch record
    res2 = client.get(f"/api/records/{record_id}")
    assert res2.status_code == 200
    assert res2.json()["record_id"] == record_id

def test_update_and_approve_record(client):
    # Create record
    res = client.post("/api/records", json={
        "text": "At 14:36, administered 0.3 mg epinephrine IM.",
        "actor_id": "MEDIC-1"
    })
    rec = res.json()
    record_id = rec["record_id"]
    assert rec["audit"]["revision"] == 1

    # Edit event
    events = rec["events"]
    events[0]["review_status"] = "confirmed"
    events[0]["reviewer_notes"] = "Verified dosage and route with partner"

    update_payload = {
        "actor_id": "MEDIC-1",
        "reason": "Partner cross-check complete",
        "events": events
    }
    res_up = client.put(f"/api/records/{record_id}", json=update_payload)
    assert res_up.status_code == 200
    assert res_up.json()["audit"]["revision"] == 2
    assert res_up.json()["events"][0]["review_status"] == "confirmed"

    # Approve record
    approve_res = client.post(f"/api/records/{record_id}/approve", json={
        "actor_id": "DR-SUPERVISOR-9",
        "notes": "Medical control approval granted"
    })
    assert approve_res.status_code == 200
    assert approve_res.json()["audit"]["record_status"] == "approved"
    assert approve_res.json()["audit"]["revision"] == 3
