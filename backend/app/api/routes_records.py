import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import DBClinicalRecord, DBClinicalEvent
from app.schemas.record import (
    ClinicalRecord, NoteSource, AuditMetadata, RecordCreateRequest,
    RecordUpdateRequest, RecordApprovalRequest
)
from app.schemas.event import (
    ClinicalEvent, MedicationDetails, DoseDetails, RouteDetails
)
from app.nlp.pipeline import nlp_engine
from app.audit.hash_chain import append_audit_entry, verify_audit_chain
from app.core.security import canonical_json

router = APIRouter(prefix="/records", tags=["Records"])

def db_event_to_schema(e: DBClinicalEvent) -> ClinicalEvent:
    med = None
    if e.medication_name:
        med = MedicationDetails(
            name=e.medication_name,
            code=e.medication_code,
            original_term=e.medication_original_term
        )
    dose = None
    if e.dose_value is not None or e.dose_original_text is not None:
        dose = DoseDetails(
            value=e.dose_value,
            unit=e.dose_unit,
            original_text=e.dose_original_text
        )
    route = None
    if e.route_normalized or e.route_original:
        route = RouteDetails(
            normalized=e.route_normalized,
            original=e.route_original
        )
    return ClinicalEvent(
        event_id=e.id,
        event_type=e.event_type,
        medication=med,
        dose=dose,
        route=route,
        frequency=e.frequency,
        procedure_name=e.procedure_name,
        procedure_method=e.procedure_method,
        observation_name=e.observation_name,
        observation_value=e.observation_value,
        event_time=e.event_time,
        time_precision=e.time_precision,
        administration_status=e.administration_status,
        performer=e.performer,
        source_span=e.source_span,
        span_start=e.span_start,
        span_end=e.span_end,
        confidence=e.confidence,
        review_status=e.review_status,
        reviewer_notes=e.reviewer_notes,
        is_correction=e.is_correction,
        supersedes_event_id=e.supersedes_event_id
    )

def db_record_to_schema(r: DBClinicalRecord) -> ClinicalRecord:
    events = [db_event_to_schema(e) for e in r.events]
    return ClinicalRecord(
        record_id=r.id,
        schema_version=r.schema_version,
        source=NoteSource(
            type=r.source_type,
            original_text=r.original_text,
            created_at=r.created_at,
            audio_duration_seconds=r.audio_duration_seconds,
            speech_engine=r.speech_engine
        ),
        events=events,
        audit=AuditMetadata(
            revision=r.revision,
            record_status=r.record_status,
            created_by=r.created_by,
            last_modified_by=r.last_modified_by,
            created_at=r.created_at,
            last_modified_at=r.last_modified_at
        ),
        integrity_verified=r.integrity_verified,
        integrity_last_checked=r.integrity_last_checked
    )

@router.get("", response_model=List[ClinicalRecord])
def list_records(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter by status: draft, pending_review, approved")
):
    """Retrieve all emergency clinical care records."""
    query = db.query(DBClinicalRecord).order_by(DBClinicalRecord.created_at.desc())
    if status:
        query = query.filter(DBClinicalRecord.record_status == status)
    records = query.all()
    return [db_record_to_schema(r) for r in records]

@router.post("", response_model=ClinicalRecord, status_code=201)
def create_record(payload: RecordCreateRequest, db: Session = Depends(get_db)):
    """Create new clinical record from raw input, run extraction, and record audit block."""
    record_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    actor = payload.actor_id or "EMS-RESPONDER-01"

    # Run Clinical NLP Extraction
    extracted_events, warnings, _ = nlp_engine.process_note(
        text=payload.text,
        responder_id=actor,
        reference_date=payload.reference_date
    )

    db_record = DBClinicalRecord(
        id=record_id,
        schema_version="1.0",
        source_type=payload.source_type,
        original_text=payload.text,
        audio_duration_seconds=payload.audio_duration_seconds,
        speech_engine=payload.speech_engine,
        revision=1,
        record_status="pending_review",
        created_by=actor,
        last_modified_by=actor,
        created_at=now_iso,
        last_modified_at=now_iso,
        integrity_verified=True,
        integrity_last_checked=now_iso
    )
    db.add(db_record)
    db.flush()

    # Save Events
    for idx, ev in enumerate(extracted_events):
        db_ev = DBClinicalEvent(
            id=ev.event_id,
            record_id=record_id,
            sequence_order=idx,
            event_type=ev.event_type,
            medication_name=ev.medication.name if ev.medication else None,
            medication_code=ev.medication.code if ev.medication else None,
            medication_original_term=ev.medication.original_term if ev.medication else None,
            dose_value=ev.dose.value if ev.dose else None,
            dose_unit=ev.dose.unit if ev.dose else None,
            dose_original_text=ev.dose.original_text if ev.dose else None,
            route_normalized=ev.route.normalized if ev.route else None,
            route_original=ev.route.original if ev.route else None,
            frequency=ev.frequency,
            procedure_name=ev.procedure_name,
            procedure_method=ev.procedure_method,
            observation_name=ev.observation_name,
            observation_value=ev.observation_value,
            event_time=ev.event_time,
            time_precision=ev.time_precision,
            administration_status=ev.administration_status,
            performer=ev.performer,
            source_span=ev.source_span,
            span_start=ev.span_start,
            span_end=ev.span_end,
            confidence=ev.confidence,
            review_status=ev.review_status,
            reviewer_notes=ev.reviewer_notes,
            is_correction=ev.is_correction,
            supersedes_event_id=ev.supersedes_event_id
        )
        db.add(db_ev)

    db.commit()

    # Append Genesis/Initial Block to Audit Trail
    append_audit_entry(
        db=db,
        record_id=record_id,
        action_type="RECORD_CREATED_WITH_NLP_EXTRACTION",
        actor_id=actor,
        payload={
            "source_type": payload.source_type,
            "text_length": len(payload.text),
            "events_extracted": len(extracted_events),
            "warnings_count": len(warnings)
        }
    )

    db.refresh(db_record)
    return db_record_to_schema(db_record)

@router.get("/{record_id}", response_model=ClinicalRecord)
def get_record(record_id: str, db: Session = Depends(get_db)):
    """Fetch record details and verify cryptographic hash chain status."""
    record = db.query(DBClinicalRecord).filter(DBClinicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    # Run check
    verification = verify_audit_chain(db)
    record.integrity_verified = verification.is_valid
    record.integrity_last_checked = verification.checked_at
    db.commit()

    return db_record_to_schema(record)

@router.put("/{record_id}", response_model=ClinicalRecord)
def update_record(record_id: str, payload: RecordUpdateRequest, db: Session = Depends(get_db)):
    """Human-in-the-loop update: Modify extracted events, confirm or reject, bump revision, and append audit block."""
    record = db.query(DBClinicalRecord).filter(DBClinicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    record.revision += 1
    record.last_modified_by = payload.actor_id
    record.last_modified_at = now_iso

    # Replace old events with updated events
    db.query(DBClinicalEvent).filter(DBClinicalEvent.record_id == record_id).delete()

    for idx, ev in enumerate(payload.events):
        db_ev = DBClinicalEvent(
            id=ev.event_id,
            record_id=record_id,
            sequence_order=idx,
            event_type=ev.event_type,
            medication_name=ev.medication.name if ev.medication else None,
            medication_code=ev.medication.code if ev.medication else None,
            medication_original_term=ev.medication.original_term if ev.medication else None,
            dose_value=ev.dose.value if ev.dose else None,
            dose_unit=ev.dose.unit if ev.dose else None,
            dose_original_text=ev.dose.original_text if ev.dose else None,
            route_normalized=ev.route.normalized if ev.route else None,
            route_original=ev.route.original if ev.route else None,
            frequency=ev.frequency,
            procedure_name=ev.procedure_name,
            procedure_method=ev.procedure_method,
            observation_name=ev.observation_name,
            observation_value=ev.observation_value,
            event_time=ev.event_time,
            time_precision=ev.time_precision,
            administration_status=ev.administration_status,
            performer=ev.performer,
            source_span=ev.source_span,
            span_start=ev.span_start,
            span_end=ev.span_end,
            confidence=ev.confidence,
            review_status=ev.review_status,
            reviewer_notes=ev.reviewer_notes,
            is_correction=ev.is_correction,
            supersedes_event_id=ev.supersedes_event_id
        )
        db.add(db_ev)

    db.commit()

    # Append revision audit block
    append_audit_entry(
        db=db,
        record_id=record_id,
        action_type="RECORD_REVISION_UPDATED",
        actor_id=payload.actor_id,
        payload={
            "revision": record.revision,
            "reason": payload.reason or "Human verification / manual edit",
            "events_count": len(payload.events)
        }
    )

    db.refresh(record)
    return db_record_to_schema(record)

@router.post("/{record_id}/approve", response_model=ClinicalRecord)
def approve_record(record_id: str, payload: RecordApprovalRequest, db: Session = Depends(get_db)):
    """Approve record: Marks all pending events as confirmed, transitions status to 'approved', appends audit block."""
    record = db.query(DBClinicalRecord).filter(DBClinicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    record.record_status = "approved"
    record.revision += 1
    record.last_modified_by = payload.actor_id
    record.last_modified_at = now_iso

    # Confirm all events that are not explicitly rejected
    for ev in record.events:
        if ev.review_status == "pending":
            ev.review_status = "confirmed"
            if payload.notes:
                ev.reviewer_notes = payload.notes

    db.commit()

    append_audit_entry(
        db=db,
        record_id=record_id,
        action_type="RECORD_APPROVED_BY_CLINICIAN",
        actor_id=payload.actor_id,
        payload={
            "revision": record.revision,
            "approval_notes": payload.notes,
            "approved_at": now_iso
        }
    )

    db.refresh(record)
    return db_record_to_schema(record)
