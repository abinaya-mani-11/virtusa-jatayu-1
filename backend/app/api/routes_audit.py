import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.db.models import DBAuditTrail
from app.schemas.audit import AuditEntry, AuditVerificationResult
from app.audit.hash_chain import verify_audit_chain, tamper_entry_for_test

router = APIRouter(prefix="/audit", tags=["Audit & Integrity"])

class TamperTestRequest(BaseModel):
    sequence: int
    test_note: Optional[str] = "Unauthorized direct SQL modification test"

@router.get("", response_model=List[AuditEntry])
def get_audit_trail(
    record_id: Optional[str] = Query(None, description="Optional filter by record_id"),
    db: Session = Depends(get_db)
):
    """Retrieve full append-only audit trail ordered by cryptographic sequence number."""
    query = db.query(DBAuditTrail).order_by(DBAuditTrail.sequence.asc())
    if record_id:
        query = query.filter(DBAuditTrail.record_id == record_id)
    entries = query.all()

    result = []
    for e in entries:
        try:
            payload = json.loads(e.payload_json)
        except Exception:
            payload = {}
        result.append(AuditEntry(
            entry_id=e.id,
            sequence=e.sequence,
            record_id=e.record_id,
            event_id=e.event_id,
            action_type=e.action_type,
            actor_id=e.actor_id,
            timestamp=e.timestamp,
            prev_hash=e.prev_hash,
            current_hash=e.current_hash,
            payload=payload
        ))
    return result

@router.post("/verify", response_model=AuditVerificationResult)
def verify_integrity(
    record_id: Optional[str] = Query(None, description="Optional filter by record_id"),
    db: Session = Depends(get_db)
):
    """Run full cryptographic traversal of SHA-256 hash chain to verify audit integrity."""
    return verify_audit_chain(db, record_id)

@router.post("/tamper-test")
def trigger_tamper_test(payload: TamperTestRequest, db: Session = Depends(get_db)):
    """Simulate unauthorized database tampering by altering a payload in SQLite without re-hashing."""
    success = tamper_entry_for_test(db, payload.sequence, payload.test_note)
    if not success:
        raise HTTPException(status_code=404, detail=f"Audit entry with sequence #{payload.sequence} not found")
    return {
        "status": "tampered",
        "message": f"Successfully injected unauthorized payload at sequence #{payload.sequence}. Run /api/audit/verify to see cryptographic detection in action."
    }
