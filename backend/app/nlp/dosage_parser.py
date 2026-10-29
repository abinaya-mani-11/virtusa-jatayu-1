import re
from typing import Optional, Tuple
from app.nlp.clinical_vocab import SPOKEN_NUMBERS, STANDARDIZED_UNITS

# Regex for numbers: e.g. 0.3, .3, 10, 250, 1,000, 1.5
NUMERIC_PATTERN = r'(?:\d+(?:\.\d+)?|\.\d+)'

# Regex for common unit expressions
UNIT_PATTERN = r'(?:mg|milligrams?|mcg|micrograms?|g|grams?|l/min|liters?\s+per\s+minute|lpm|ml|milliliters?|meq|milliequivalents?|puffs?|tablets?|tabs?|%|percent)'

class ParsedDose:
    def __init__(
        self,
        value: Optional[float],
        unit: Optional[str],
        original_text: str,
        start_char: int,
        end_char: int
    ):
        self.value = value
        self.unit = unit
        self.original_text = original_text
        self.start_char = start_char
        self.end_char = end_char

def parse_dosage(text: str) -> Optional[ParsedDose]:
    """Extract dosage value and unit from a text clause or window.
    Handles numeric formats ('0.3 mg', '10 L/min') and spoken formats ('point three milligrams').
    """
    if not text:
        return None

    # 1. First attempt: Spoken number pattern followed by unit
    # Sort spoken numbers by length descending so multi-word numbers match first
    sorted_spoken = sorted(SPOKEN_NUMBERS.keys(), key=lambda s: len(s), reverse=True)
    spoken_re = r'\b(' + '|'.join(re.escape(k) for k in sorted_spoken) + r')\s+(' + UNIT_PATTERN + r')\b'
    match = re.search(spoken_re, text, re.IGNORECASE)
    if match:
        spoken_num_str = match.group(1).lower()
        unit_str = match.group(2).lower()
        val = SPOKEN_NUMBERS.get(spoken_num_str)
        norm_unit = STANDARDIZED_UNITS.get(unit_str, unit_str)
        return ParsedDose(
            value=val,
            unit=norm_unit,
            original_text=match.group(0),
            start_char=match.start(),
            end_char=match.end()
        )

    # 2. Second attempt: Digits followed by unit (with optional whitespace or hyphen)
    digit_unit_re = r'\b(' + NUMERIC_PATTERN + r')\s*(-|to)?\s*(' + UNIT_PATTERN + r')\b'
    match = re.search(digit_unit_re, text, re.IGNORECASE)
    if match:
        val_str = match.group(1)
        unit_str = match.group(3).lower()
        try:
            val = float(val_str)
        except ValueError:
            val = None
        norm_unit = STANDARDIZED_UNITS.get(unit_str, unit_str)
        return ParsedDose(
            value=val,
            unit=norm_unit,
            original_text=match.group(0),
            start_char=match.start(),
            end_char=match.end()
        )

    # 3. Third attempt: Standalone spoken number if in dosage context ("gave point three")
    match = re.search(r'\b(' + '|'.join(re.escape(k) for k in sorted_spoken) + r')\b', text, re.IGNORECASE)
    if match:
        spoken_num_str = match.group(1).lower()
        # Avoid matching generic small words unless they are preceded by dose words like dose, gave, administered
        preceding = text[:match.start()].lower()
        if any(w in preceding for w in ["dose", "administered", "gave", "of", "bolus"]):
            val = SPOKEN_NUMBERS.get(spoken_num_str)
            return ParsedDose(
                value=val,
                unit=None,
                original_text=match.group(0),
                start_char=match.start(),
                end_char=match.end()
            )

    # 4. Fourth attempt: Digits without units if preceded by explicit dose keyword ("dose was 5")
    match = re.search(r'\b(?:dose|amount|bolus|rate)\s+(?:of\s+|was\s+)?(' + NUMERIC_PATTERN + r')\b', text, re.IGNORECASE)
    if match:
        try:
            val = float(match.group(1))
        except ValueError:
            val = None
        return ParsedDose(
            value=val,
            unit=None,
            original_text=match.group(1),
            start_char=match.start(1),
            end_char=match.end(1)
        )

    return None
