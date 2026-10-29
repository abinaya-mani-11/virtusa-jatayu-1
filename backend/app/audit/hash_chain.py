import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session
from app.db.models import DBAuditTrail
from app.schemas.audit import AuditVerificationResult
from app.core.security import compute_audit_hash, canonical_json

GENESIS_HASH = "0" * 64

def get_latest_hash(db: Session, record_id: Optional[str] = None) -> str:
    """Get current top hash in the audit chain.
    If database has entries, returns the current_hash of the latest sequence entry.
    Otherwise returns GENESIS_HASH.
    """
    query = db.query(DBAuditTrail)
    if record_id:
        query = query.filter(DBAuditTrail.record_id == record_id)
    latest = query.order_by(DBAuditTrail.sequence.desc()).first()
    return latest.current_hash if latest else GENESIS_HASH

def get_next_sequence(db: Session) -> int:
    """Get next global sequence integer for audit entry."""
    latest = db.query(DBAuditTrail).order_by(DBAuditTrail.sequence.desc()).first()
    return (latest.sequence + 1) if latest else 1

def append_audit_entry(
    db: Session,
    record_id: str,
    action_type: str,
    actor_id: str,
    event_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None
) -> DBAuditTrail:
    """Append a new tamper-evident block to the audit hash chain."""
    prev_hash = get_latest_hash(db)
    seq = get_next_sequence(db)
    timestamp = datetime.now(timezone.utc).isoformat()
    safe_payload = payload or {}

    current_hash = compute_audit_hash(
        prev_hash=prev_hash,
        record_id=record_id,
        event_id=event_id or "",
        action_type=action_type,
        actor_id=actor_id,
        timestamp=timestamp,
        payload=safe_payload
    )

    entry = DBAuditTrail(
        record_id=record_id,
        event_id=event_id,
        sequence=seq,
        action_type=action_type,
        actor_id=actor_id,
        timestamp=timestamp,
        prev_hash=prev_hash,
        current_hash=current_hash,
        payload_json=canonical_json(safe_payload)
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

def verify_audit_chain(db: Session, record_id: Optional[str] = None) -> AuditVerificationResult:
    """Verify integrity of the audit log by traversing each entry and checking:
    1. Continuity: each entry's prev_hash must equal the preceding entry's current_hash.
    2. Content Integrity: recomputing hash from payload must equal stored current_hash.
    """
    query = db.query(DBAuditTrail).order_by(DBAuditTrail.sequence.asc())
    if record_id:
        query = query.filter(DBAuditTrail.record_id == record_id)
        
    entries: List[DBAuditTrail] = query.all()
    
    if not entries:
        return AuditVerificationResult(
            is_valid=True,
            total_entries=0,
            verified_entries=0,
            corrupted_entries=[],
            tampered_details=[],
            genesis_hash=GENESIS_HASH,
            head_hash=GENESIS_HASH,
            message="Audit chain is empty. Genesis state intact."
        )

    corrupted_seqs = []
    tampered_details = []
    expected_prev = GENESIS_HASH

    for i, entry in enumerate(entries):
        # 1. Verify prev_hash link
        # Note: If filtering by record_id, prev_hash may link to global preceding block,
        # so for global check we check full sequence continuity.
        if entry.prev_hash != expected_prev and not record_id:
            corrupted_seqs.append(entry.sequence)
            tampered_details.append(
                f"Broken Chain Link at Sequence #{entry.sequence} (Record {entry.record_id}): "
                f"Expected prev_hash '{expected_prev[:12]}...', found '{entry.prev_hash[:12]}...'"
            )

        # 2. Recompute current_hash from stored payload and metadata
        try:
            payload_dict = json.loads(entry.payload_json)
        except Exception:
            payload_dict = {}

        recomputed_hash = compute_audit_hash(
            prev_hash=entry.prev_hash,
            record_id=entry.record_id,
            event_id=entry.event_id or "",
            action_type=entry.action_type,
            actor_id=entry.actor_id,
            timestamp=entry.timestamp,
            payload=payload_dict
        )

        if recomputed_hash != entry.current_hash:
            corrupted_seqs.append(entry.sequence)
            tampered_details.append(
                f"Payload Tampering Detected at Sequence #{entry.sequence} (Record {entry.record_id}, Action {entry.action_type}): "
                f"Stored hash '{entry.current_hash[:12]}...' does not match recomputed payload hash '{recomputed_hash[:12]}...'"
            )

        expected_prev = entry.current_hash

    is_valid = len(corrupted_seqs) == 0
    msg = (
        f"Audit chain verification succeeded. {len(entries)} cryptographically linked entries verified."
        if is_valid
        else f"CRITICAL: Audit chain tampering detected in {len(corrupted_seqs)} block(s)!"
    )

    return AuditVerificationResult(
        is_valid=is_valid,
        total_entries=len(entries),
        verified_entries=len(entries) - len(corrupted_seqs),
        corrupted_entries=corrupted_seqs,
        tampered_details=tampered_details,
        genesis_hash=GENESIS_HASH,
        head_hash=entries[-1].current_hash,
        message=msg
    )

def tamper_entry_for_test(db: Session, sequence: int, fake_payload_note: str) -> bool:
    """Demonstration utility: Intentionally alters an audit entry's payload in SQLite
    to prove that the cryptographic verification algorithm catches manual tampering.
    """
    entry = db.query(DBAuditTrail).filter(DBAuditTrail.sequence == sequence).first()
    if not entry:
        return False
    # Directly modify stored payload without updating current_hash
    tampered_payload = {"tampered": True, "unauthorized_change": fake_payload_note}
    entry.payload_json = json.dumps(tampered_payload)
    db.commit()
    return True
