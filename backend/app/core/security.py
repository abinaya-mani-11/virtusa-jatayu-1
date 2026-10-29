import hashlib
import json
import re
from typing import Any, Dict

def sanitize_text(text: str) -> str:
    """Sanitize user input against control characters and excess whitespace."""
    if not text:
        return ""
    # Strip null bytes and non-printable characters except standard whitespace
    sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
    return sanitized.strip()

def canonical_json(data: Any) -> str:
    """Produce deterministic, sorted JSON string for cryptographic hashing."""
    return json.dumps(data, sort_keys=True, separators=(',', ':'), default=str)

def compute_sha256(content: str) -> str:
    """Compute SHA-256 hexadecimal digest."""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def compute_audit_hash(
    prev_hash: str,
    record_id: str,
    event_id: str,
    action_type: str,
    actor_id: str,
    timestamp: str,
    payload: Dict[str, Any]
) -> str:
    """Compute hash for audit chain entry:
    H = SHA-256(prev_hash || record_id || event_id || action_type || actor_id || timestamp || canonical_json(payload))
    """
    serialized_payload = canonical_json(payload)
    seed = f"{prev_hash}|{record_id}|{event_id}|{action_type}|{actor_id}|{timestamp}|{serialized_payload}"
    return compute_sha256(seed)
