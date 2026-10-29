import uuid
from datetime import datetime, timezone
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from app.schemas.event import ClinicalEvent

SourceType = Literal["typed_note", "audio_transcript", "synthetic_demo"]
RecordStatus = Literal["draft", "pending_review", "approved", "archived"]

class NoteSource(BaseModel):
    type: SourceType = Field("typed_note", description="Input modality")
    original_text: str = Field(..., description="Unaltered raw transcription or typed note")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    audio_duration_seconds: Optional[float] = Field(None, description="Duration in seconds if captured from audio")
    speech_engine: Optional[str] = Field(None, description="Local or browser speech recognition engine used")

class AuditMetadata(BaseModel):
    revision: int = Field(1, description="Sequential version counter for record")
    record_status: RecordStatus = Field("draft", description="Review state of entire record")
    created_by: str = Field("EMS-RESPONDER-01", description="Initial author or responder")
    last_modified_by: str = Field("EMS-RESPONDER-01", description="Last author or reviewer")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_modified_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ClinicalRecord(BaseModel):
    record_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    schema_version: str = Field("1.0", description="Contract schema version")
    source: NoteSource
    events: List[ClinicalEvent] = Field(default_factory=list)
    audit: AuditMetadata = Field(default_factory=AuditMetadata)
    integrity_verified: Optional[bool] = Field(None, description="Current cryptographic hash chain status")
    integrity_last_checked: Optional[str] = Field(None)

class RecordCreateRequest(BaseModel):
    text: str = Field(..., min_length=3, description="Note text to extract from")
    source_type: SourceType = Field("typed_note")
    actor_id: Optional[str] = Field("EMS-RESPONDER-01")
    audio_duration_seconds: Optional[float] = None
    speech_engine: Optional[str] = None
    reference_date: Optional[str] = None

class RecordUpdateRequest(BaseModel):
    actor_id: str = Field(..., description="User performing update")
    reason: Optional[str] = Field(None, description="Reason for modification")
    events: List[ClinicalEvent] = Field(..., description="Full updated list of events")

class RecordApprovalRequest(BaseModel):
    actor_id: str = Field(..., description="Authorizing clinician or paramedic")
    notes: Optional[str] = Field(None, description="Approval confirmation notes")
