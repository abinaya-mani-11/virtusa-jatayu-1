from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.event import ClinicalEvent
from app.schemas.record import SourceType

class ExtractionWarning(BaseModel):
    code: str
    message: str
    target_event_id: Optional[str] = None
    severity: str = "warning"  # "info", "warning", "critical"

class ExtractRequest(BaseModel):
    text: str = Field(..., min_length=2, description="First-responder clinical text or speech transcript")
    source_type: SourceType = Field("typed_note")
    responder_id: Optional[str] = "EMS-MEDIC-01"
    reference_date: Optional[str] = None
    audio_duration_seconds: Optional[float] = None
    speech_engine: Optional[str] = None

class ExtractResponse(BaseModel):
    record_id: str
    raw_text: str
    events: List[ClinicalEvent]
    warnings: List[ExtractionWarning]
    execution_time_ms: float
    model_name: str
    schema_version: str = "1.0"
