import uuid
from typing import Dict, Any, List
from app.schemas.record import ClinicalRecord
from app.schemas.event import ClinicalEvent

def map_event_to_fhir_resource(record: ClinicalRecord, event: ClinicalEvent) -> Dict[str, Any]:
    """Transform ClinicalEvent to a simplified FHIR R4 resource."""
    base_meta = {
        "source": "Field-to-Record-EMS",
        "lastUpdated": record.audit.last_modified_at
    }

    if event.event_type == "medication_administration" and event.medication:
        # FHIR MedicationAdministration
        status_map = {
            "administered": "completed",
            "planned": "in-progress",
            "refused": "not-done",
            "withheld": "not-done",
            "discontinued": "stopped",
            "prior_administration": "completed",
            "mentioned": "unknown"
        }
        fhir_status = status_map.get(event.administration_status, "completed")
        
        resource: Dict[str, Any] = {
            "resourceType": "MedicationAdministration",
            "id": event.event_id,
            "meta": base_meta,
            "status": fhir_status,
            "medicationCodeableConcept": {
                "text": event.medication.name,
                "coding": [
                    {
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": event.medication.code or "unknown",
                        "display": event.medication.name
                    }
                ]
            },
            "subject": {
                "display": "Emergency Patient"
            },
            "performer": [
                {
                    "actor": {
                        "display": event.performer or record.audit.created_by
                    }
                }
            ],
            "dosage": {}
        }
        
        if event.dose and event.dose.value is not None:
            resource["dosage"]["dose"] = {
                "value": event.dose.value,
                "unit": event.dose.unit or "unknown",
                "system": "http://unitsofmeasure.org"
            }
            if event.dose.original_text:
                resource["dosage"]["text"] = event.dose.original_text
                
        if event.route and event.route.normalized:
            resource["dosage"]["route"] = {
                "text": event.route.normalized,
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "display": event.route.normalized
                    }
                ]
            }

        if event.event_time:
            resource["effectiveDateTime"] = event.event_time
            
        if event.administration_status in ["refused", "withheld"]:
            resource["statusReason"] = [
                {
                    "text": f"Status noted as {event.administration_status} on scene"
                }
            ]
            
        return resource

    elif event.event_type == "procedure":
        # FHIR Procedure
        proc_status_map = {
            "administered": "completed",
            "planned": "in-progress",
            "refused": "not-done",
            "withheld": "not-done",
            "discontinued": "stopped",
            "prior_administration": "completed",
            "mentioned": "unknown"
        }
        return {
            "resourceType": "Procedure",
            "id": event.event_id,
            "meta": base_meta,
            "status": proc_status_map.get(event.administration_status, "completed"),
            "code": {
                "text": event.procedure_name or "Emergency Procedure"
            },
            "subject": {
                "display": "Emergency Patient"
            },
            "performedDateTime": event.event_time,
            "performer": [
                {
                    "actor": {
                        "display": event.performer or record.audit.created_by
                    }
                }
            ],
            "note": [
                {"text": f"Method: {event.procedure_method}"} if event.procedure_method else {"text": event.source_span}
            ]
        }

    else:
        # FHIR Observation
        return {
            "resourceType": "Observation",
            "id": event.event_id,
            "meta": base_meta,
            "status": "final",
            "code": {
                "text": event.observation_name or "Clinical Observation"
            },
            "valueString": event.observation_value or event.source_span,
            "effectiveDateTime": event.event_time,
            "performer": [
                {
                    "display": event.performer or record.audit.created_by
                }
            ]
        }

def to_fhir_bundle(record: ClinicalRecord) -> Dict[str, Any]:
    """Convert entire clinical record to FHIR R4 Transaction/Collection Bundle."""
    entries = []
    for event in record.events:
        res = map_event_to_fhir_resource(record, event)
        entries.append({
            "fullUrl": f"urn:uuid:{event.event_id}",
            "resource": res
        })

    return {
        "resourceType": "Bundle",
        "id": record.record_id,
        "type": "collection",
        "timestamp": record.audit.last_modified_at,
        "meta": {
            "versionId": str(record.audit.revision),
            "lastUpdated": record.audit.last_modified_at
        },
        "total": len(entries),
        "entry": entries
    }
