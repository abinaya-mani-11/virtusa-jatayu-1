import re
from typing import List, Optional
from app.schemas.event import ClinicalEvent

CORRECTION_PATTERNS = [
    r'\b(?:correction|correcting|errata|amendment):\s*(.*)',
    r'\b(?:correction,\s*the\s+dose\s+was\s+)(.*)',
    r'\b(?:actually,\s*(?:we\s+)?gave\s+)(.*)',
    r'\b(?:correction\s*-\s*)(.*)'
]

def detect_correction(clause: str) -> Optional[str]:
    """Check if the clause contains an explicit correction indicator.
    Returns the corrected statement or None.
    """
    for pat in CORRECTION_PATTERNS:
        match = re.search(pat, clause, re.IGNORECASE)
        if match:
            return match.group(0)
    return None

def resolve_corrections(events: List[ClinicalEvent]) -> List[ClinicalEvent]:
    """Iterate through extracted events. If a later event is marked as a correction,
    link it to the earlier matching event and flag the earlier event as superseded.
    """
    if len(events) < 2:
        return events

    for i in range(len(events) - 1, -1, -1):
        curr = events[i]
        if curr.is_correction:
            # Find the most recent earlier event of the same type / medication
            for j in range(i - 1, -1, -1):
                prev = events[j]
                if (
                    prev.event_type == curr.event_type and
                    (not curr.medication or not prev.medication or curr.medication.name.lower() == prev.medication.name.lower())
                ):
                    curr.supersedes_event_id = prev.event_id
                    prev.review_status = "modified"
                    prev.reviewer_notes = f"Superseded by on-scene correction: event {curr.event_id}"
                    break

    return events
