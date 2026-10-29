import re
from typing import Optional
from app.nlp.clinical_vocab import ROUTE_MAPPINGS

class ParsedRoute:
    def __init__(self, normalized: str, original: str, start_char: int, end_char: int):
        self.normalized = normalized
        self.original = original
        self.start_char = start_char
        self.end_char = end_char

def parse_route(text: str) -> Optional[ParsedRoute]:
    """Find and normalize administration route in text snippet."""
    if not text:
        return None

    # Sort routes by length descending so multi-word routes match before single-word abbreviations
    sorted_routes = sorted(ROUTE_MAPPINGS.keys(), key=lambda r: len(r), reverse=True)
    
    # Word boundary matching
    for route_term in sorted_routes:
        # Use regex word boundary
        pattern = r'\b' + re.escape(route_term) + r'\b'
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            original = match.group(0)
            normalized = ROUTE_MAPPINGS[route_term.lower()]
            return ParsedRoute(
                normalized=normalized,
                original=original,
                start_char=match.start(),
                end_char=match.end()
            )

    return None
