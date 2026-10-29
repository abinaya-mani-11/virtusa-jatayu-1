import uuid
from typing import Optional, Literal
from pydantic import BaseModel, Field

EventType = Literal["medication_administration", "procedure", "observation"]
ActionStatus = Literal[
    "administered",
    "planned",
    "refused",
    "withheld",
    "discontinued",
    "prior_administration",
    "mentioned"
]
TimePrecision = Literal["datetime", "time_only", "unknown"]
ReviewStatus = Literal["pending", "confirmed", "rejected", "modified"]

class MedicationDetails(BaseModel):
    name: str = Field(..., description="Canonical or extracted medication name")
    code: Optional[str] = Field(None, description="Standard RxNorm or SNOMED-CT code if mapped")
    original_term: Optional[str] = Field(None, description="Exact medication term found in the source text")

class DoseDetails(BaseModel):
    value: Optional[float] = Field(None, description="Extracted numerical dosage value")
    unit: Optional[str] = Field(None, description="Normalized dosage unit (e.g., mg, mcg, L/min, mL)")
    original_text: Optional[str] = Field(None, description="Exact dosage expression in source text")

class RouteDetails(BaseModel):
    normalized: Optional[str] = Field(None, description="Standardized route code: intramuscular, intravenous, etc.")
    original: Optional[str] = Field(None, description="Exact route expression in source text: IM, intramuscularly")

class ClinicalEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: EventType = Field(..., description="Type of clinical event")
    
    # Medication fields
    medication: Optional[MedicationDetails] = None
    dose: Optional[DoseDetails] = None
    route: Optional[RouteDetails] = None
    frequency: Optional[str] = Field(None, description="Administration frequency if explicitly mentioned")
    
    # Procedure fields
    procedure_name: Optional[str] = Field(None, description="Name of intervention or procedure")
    procedure_method: Optional[str] = Field(None, description="Method or device used, e.g., non-rebreather mask")
    
    # Observation fields
    observation_name: Optional[str] = Field(None, description="Observation or symptom name, e.g., breathing, SpO2")
    observation_value: Optional[str] = Field(None, description="Observed status or measurement")
    
    # Timing fields
    event_time: Optional[str] = Field(None, description="Extracted event time or ISO timestamp")
    time_precision: TimePrecision = Field("time_only", description="Precision of event_time")
    
    # Clinical governance & status
    administration_status: ActionStatus = Field(
        "administered",
        description="Clinical status of administration or procedure"
    )
    performer: Optional[str] = Field(None, description="Medic or clinician who performed the action")
    
    # Traceability & evidence
    source_span: str = Field(..., description="Exact segment of original note corresponding to this extraction")
    span_start: Optional[int] = Field(None, description="Start character offset in note")
    span_end: Optional[int] = Field(None, description="End character offset in note")
    confidence: float = Field(0.85, ge=0.0, le=1.0, description="Extraction confidence score (0.0 - 1.0)")
    
    # Human-in-the-loop review
    review_status: ReviewStatus = Field("pending", description="Status of human verification")
    reviewer_notes: Optional[str] = Field(None, description="Notes from human reviewer")
    
    # Errata / Correction handling
    is_correction: bool = Field(False, description="Flag if this event supersedes an earlier statement in the note")
    supersedes_event_id: Optional[str] = Field(None, description="ID of event superseded by this correction")
