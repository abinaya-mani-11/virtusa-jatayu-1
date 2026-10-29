import uuid
from fastapi import APIRouter
from app.schemas.extraction import ExtractRequest, ExtractResponse
from app.nlp.pipeline import nlp_engine

router = APIRouter(prefix="/extract", tags=["Extraction"])

@router.post("", response_model=ExtractResponse)
def extract_clinical_entities(payload: ExtractRequest):
    """Run real-time local clinical NLP extraction on raw speech transcript or typed note."""
    events, warnings, elapsed = nlp_engine.process_note(
        text=payload.text,
        responder_id=payload.responder_id or "EMS-MEDIC-01",
        reference_date=payload.reference_date
    )
    
    return ExtractResponse(
        record_id=str(uuid.uuid4()),
        raw_text=payload.text,
        events=events,
        warnings=warnings,
        execution_time_ms=elapsed,
        model_name=nlp_engine.model_name
    )
