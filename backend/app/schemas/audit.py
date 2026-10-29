import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class AuditEntry(BaseModel):
    entry_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sequence: int = Field(..., description="Monotonically increasing sequence number")
    record_id: str = Field(...)
    event_id: Optional[str] = None
    action_type: str = Field(..., description="Action: CREATE_RECORD, EXTRACT_ENTITIES, UPDATE_EVENT, CONFIRM_EVENT, REJECT_EVENT, APPROVE_RECORD, TAMPER_TEST")
    actor_id: str = Field(...)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    prev_hash: str = Field(..., description="SHA-256 hash of previous block (genesis is 64 zeros)")
    current_hash: str = Field(..., description="SHA-256 hash of this block")
    payload: Dict[str, Any] = Field(default_factory=dict, description="State change or diff")

class AuditVerificationResult(BaseModel):
    is_valid: bool
    total_entries: int
    verified_entries: int
    corrupted_entries: List[int] = Field(default_factory=list)
    tampered_details: List[str] = Field(default_factory=list)
    checked_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    genesis_hash: str
    head_hash: str
    message: str
