import json
import os
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import DBClinicalRecord
from app.api.routes_records import db_record_to_schema
from app.schemas.fhir import to_fhir_bundle
from app.export.pdf_generator import generate_clinical_report_pdf
from app.audit.hash_chain import verify_audit_chain

router = APIRouter(prefix="/export", tags=["Export"])

@router.get("/pdf/{record_id}")
def export_pdf(record_id: str, db: Session = Depends(get_db)):
    """Export validated printable clinical event report as PDF."""
    record = db.query(DBClinicalRecord).filter(DBClinicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    schema_record = db_record_to_schema(record)
    verification = verify_audit_chain(db)
    pdf_bytes = generate_clinical_report_pdf(schema_record, integrity_status=verification.is_valid)

    filename = f"Clinical_Report_{record_id[:8]}_rev{record.revision}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/fhir/{record_id}")
def export_fhir(record_id: str, db: Session = Depends(get_db)):
    """Export record as a standardized FHIR R4 Collection Bundle."""
    record = db.query(DBClinicalRecord).filter(DBClinicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    schema_record = db_record_to_schema(record)
    return to_fhir_bundle(schema_record)

@router.get("/json/{record_id}")
def export_json(record_id: str, db: Session = Depends(get_db)):
    """Export native Field-to-Record schema JSON."""
    record = db.query(DBClinicalRecord).filter(DBClinicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    return db_record_to_schema(record)

@router.get("/scenarios")
def get_synthetic_scenarios():
    """Retrieve pre-built first-responder scenarios for live demonstration."""
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_dataset.json")
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load synthetic dataset: {str(e)}")
