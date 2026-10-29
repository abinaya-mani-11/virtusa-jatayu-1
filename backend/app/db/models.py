import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.db.database import Base

class DBClinicalRecord(Base):
    __tablename__ = "clinical_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    schema_version = Column(String(10), default="1.0", nullable=False)
    source_type = Column(String(32), default="typed_note", nullable=False)
    original_text = Column(Text, nullable=False)
    audio_duration_seconds = Column(Float, nullable=True)
    speech_engine = Column(String(64), nullable=True)
    
    revision = Column(Integer, default=1, nullable=False)
    record_status = Column(String(32), default="draft", nullable=False)
    created_by = Column(String(64), default="EMS-RESPONDER-01", nullable=False)
    last_modified_by = Column(String(64), default="EMS-RESPONDER-01", nullable=False)
    created_at = Column(String(32), default=lambda: datetime.now(timezone.utc).isoformat(), nullable=False)
    last_modified_at = Column(String(32), default=lambda: datetime.now(timezone.utc).isoformat(), nullable=False)
    
    integrity_verified = Column(Boolean, nullable=True)
    integrity_last_checked = Column(String(32), nullable=True)

    events = relationship("DBClinicalEvent", back_populates="record", cascade="all, delete-orphan", order_by="DBClinicalEvent.sequence_order")

class DBClinicalEvent(Base):
    __tablename__ = "clinical_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    record_id = Column(String(36), ForeignKey("clinical_records.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_order = Column(Integer, default=0, nullable=False)
    
    event_type = Column(String(32), nullable=False)  # medication_administration, procedure, observation
    
    # Medication
    medication_name = Column(String(128), nullable=True)
    medication_code = Column(String(64), nullable=True)
    medication_original_term = Column(String(128), nullable=True)
    
    # Dose
    dose_value = Column(Float, nullable=True)
    dose_unit = Column(String(32), nullable=True)
    dose_original_text = Column(String(64), nullable=True)
    
    # Route
    route_normalized = Column(String(64), nullable=True)
    route_original = Column(String(64), nullable=True)
    frequency = Column(String(64), nullable=True)
    
    # Procedure
    procedure_name = Column(String(128), nullable=True)
    procedure_method = Column(String(128), nullable=True)
    
    # Observation
    observation_name = Column(String(128), nullable=True)
    observation_value = Column(String(128), nullable=True)
    
    # Timing
    event_time = Column(String(64), nullable=True)
    time_precision = Column(String(32), default="time_only", nullable=False)
    
    # Action Status
    administration_status = Column(String(32), default="administered", nullable=False)
    performer = Column(String(64), nullable=True)
    
    # Traceability
    source_span = Column(Text, nullable=False)
    span_start = Column(Integer, nullable=True)
    span_end = Column(Integer, nullable=True)
    confidence = Column(Float, default=0.85, nullable=False)
    
    # Review
    review_status = Column(String(32), default="pending", nullable=False)
    reviewer_notes = Column(Text, nullable=True)
    
    # Errata / Correction
    is_correction = Column(Boolean, default=False, nullable=False)
    supersedes_event_id = Column(String(36), nullable=True)

    record = relationship("DBClinicalRecord", back_populates="events")

class DBAuditTrail(Base):
    __tablename__ = "audit_trail"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sequence = Column(Integer, primary_key=False, autoincrement=True, unique=True, index=True)
    record_id = Column(String(36), nullable=False, index=True)
    event_id = Column(String(36), nullable=True)
    action_type = Column(String(64), nullable=False)
    actor_id = Column(String(64), nullable=False)
    timestamp = Column(String(32), default=lambda: datetime.now(timezone.utc).isoformat(), nullable=False)
    prev_hash = Column(String(64), nullable=False)
    current_hash = Column(String(64), nullable=False)
    payload_json = Column(Text, nullable=False)

Index("idx_audit_rec_seq", DBAuditTrail.record_id, DBAuditTrail.sequence)
