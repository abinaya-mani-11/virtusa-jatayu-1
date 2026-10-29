import re
from typing import Tuple
from app.schemas.event import ActionStatus

# NegEx / ConText trigger patterns

NEGATION_PATTERNS = [
    r'\b(?:did\s+not|didn\'t|did\s+never)\s+administer\b',
    r'\b(?:do\s+not|don\'t)\s+administer\b',
    r'\bnot\s+administered\b',
    r'\bnot\s+given\b',
    r'\bnever\s+given\b',
    r'\bavoided\b',
    r'\bno\s+(?:medication|drugs|intervention)\s+given\b',
    r'\bheld\s+and\s+not\s+given\b'
]

PLANNED_PATTERNS = [
    r'\bprepared\b.*?\b(?:but\s+did\s+not|not\s+given|not\s+administered)\b',
    r'\bconsidered\b.*?\b(?:but\s+not\s+given|not\s+administered|held)\b',
    r'\bconsidered\b',
    r'\bprepared\b',
    r'\bdrawn\s+up\b',
    r'\bplanned\b',
    r'\bstandby\b',
    r'\border\s+received\s+for\b'
]

REFUSED_PATTERNS = [
    r'\bpatient\s+refused\b',
    r'\brefused\s+by\s+patient\b',
    r'\brefused\b',
    r'\bdeclined\b',
    r'\bdenied\s+consent\b'
]

WITHHELD_PATTERNS = [
    r'\bwithheld\b',
    r'\bheld\b(?:\s+due\s+to|\s+secondary\s+to|\s+because)?',
    r'\bcontraindicated\b',
    r'\bcancelled\b',
    r'\bdeferred\b'
]

DISCONTINUED_PATTERNS = [
    r'\bdiscontinued\b',
    r'\bstopped\b',
    r'\bterminated\b',
    r'\bhalted\b'
]

PRIOR_PATTERNS = [
    r'\bbefore\s+(?:our\s+)?arrival\b',
    r'\bprior\s+to\s+(?:our\s+)?arrival\b',
    r'\bprior\s+to\s+ems\b',
    r'\bhad\s+received\b',
    r'\bhad\s+taken\b',
    r'\btook\s+(?:at\s+home|prior|before)\b',
    r'\bhome\s+med(?:ication)?\b',
    r'\bself-administered\b',
    r'\bgiven\s+by\s+(?:bystander|family|police|first\s+responder)\b'
]

MENTIONED_PATTERNS = [
    r'\ballerg(?:y|ic)\s+to\b',
    r'\basked\s+about\b',
    r'\binquired\s+about\b',
    r'\bhistory\s+of\b',
    r'\bdenies\s+taking\b'
]

ADMINISTERED_PATTERNS = [
    r'\badministered\b',
    r'\bgave\b',
    r'\bpushed\b',
    r'\bdelivered\b',
    r'\bstarted\b',
    r'\binitiated\b',
    r'\bplaced\b',
    r'\binjected\b',
    r'\bapplied\b'
]

def determine_action_status(clause: str) -> Tuple[ActionStatus, float, str]:
    """Analyze sentence/clause context to categorize action status.
    Returns: (ActionStatus, confidence_adjustment, reason_phrase)
    """
    text = clause.lower()

    # 1. Check for Prior Administration (e.g. 'received aspirin before arrival')
    for pat in PRIOR_PATTERNS:
        match = re.search(pat, text)
        if match:
            return "prior_administration", 0.95, f"Identified prior context: '{match.group(0)}'"

    # 2. Check for Refusal
    for pat in REFUSED_PATTERNS:
        match = re.search(pat, text)
        if match:
            return "refused", 0.95, f"Identified refusal context: '{match.group(0)}'"

    # 3. Check for Planned/Prepared but not administered
    for pat in PLANNED_PATTERNS:
        match = re.search(pat, text)
        if match:
            return "planned", 0.92, f"Identified planned/prepared context: '{match.group(0)}'"

    # 4. Check for Withheld/Contraindicated
    for pat in WITHHELD_PATTERNS:
        match = re.search(pat, text)
        if match:
            return "withheld", 0.92, f"Identified withheld context: '{match.group(0)}'"

    # 5. Check for Discontinued
    for pat in DISCONTINUED_PATTERNS:
        match = re.search(pat, text)
        if match:
            return "discontinued", 0.90, f"Identified discontinued context: '{match.group(0)}'"

    # 6. Check for Explicit Negation ('did not administer')
    for pat in NEGATION_PATTERNS:
        match = re.search(pat, text)
        if match:
            return "withheld", 0.95, f"Identified explicit negation: '{match.group(0)}'"

    # 7. Check for Mere Mention / Allergy / History
    for pat in MENTIONED_PATTERNS:
        match = re.search(pat, text)
        if match:
            return "mentioned", 0.90, f"Identified mention-only context: '{match.group(0)}'"

    # 8. Check for Explicit Administered verbs
    for pat in ADMINISTERED_PATTERNS:
        match = re.search(pat, text)
        if match:
            return "administered", 0.95, f"Identified administration verb: '{match.group(0)}'"

    # Default fallback: If dose and route or time present without negation, likely administered
    return "administered", 0.80, "Default active context"
