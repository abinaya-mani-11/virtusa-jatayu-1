import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.audit.hash_chain import append_audit_entry, verify_audit_chain, tamper_entry_for_test

@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_hash_chain_append_and_verify(test_db):
    # 1. Empty chain should be valid genesis
    res0 = verify_audit_chain(test_db)
    assert res0.is_valid is True
    assert res0.total_entries == 0

    # 2. Append 3 blocks
    b1 = append_audit_entry(test_db, "REC-1", "CREATE_RECORD", "MEDIC-1", payload={"note": "Initial draft"})
    b2 = append_audit_entry(test_db, "REC-1", "EXTRACT_ENTITIES", "MEDIC-1", payload={"events": 2})
    b3 = append_audit_entry(test_db, "REC-1", "APPROVE_RECORD", "DOCTOR-9", payload={"status": "approved"})

    assert b1.sequence == 1
    assert b2.sequence == 2
    assert b3.sequence == 3
    assert b2.prev_hash == b1.current_hash
    assert b3.prev_hash == b2.current_hash

    # 3. Verify intact chain
    res = verify_audit_chain(test_db)
    assert res.is_valid is True
    assert res.total_entries == 3
    assert res.verified_entries == 3
    assert len(res.corrupted_entries) == 0

def test_tamper_detection_catches_unauthorized_change(test_db):
    # Append entries
    append_audit_entry(test_db, "REC-100", "CREATE_RECORD", "MEDIC-1", payload={"dose": 0.3})
    append_audit_entry(test_db, "REC-100", "UPDATE_EVENT", "MEDIC-1", payload={"dose": 0.5})
    append_audit_entry(test_db, "REC-100", "APPROVE_RECORD", "CHIEF-1", payload={"ok": True})

    # Intentionally corrupt sequence #2 in the database
    tampered = tamper_entry_for_test(test_db, sequence=2, fake_payload_note="Malicious dose change to 10.0mg")
    assert tampered is True

    # Run cryptographic verification
    check = verify_audit_chain(test_db)
    assert check.is_valid is False
    assert 2 in check.corrupted_entries
    assert len(check.tampered_details) >= 1
    assert "Payload Tampering Detected at Sequence #2" in check.tampered_details[0]
