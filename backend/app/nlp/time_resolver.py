import re
from typing import Optional, Tuple

class ParsedTime:
    def __init__(
        self,
        event_time: str,
        time_precision: str,
        original_text: str,
        start_char: int,
        end_char: int,
        is_approximate: bool = False
    ):
        self.event_time = event_time
        self.time_precision = time_precision
        self.original_text = original_text
        self.start_char = start_char
        self.end_char = end_char
        self.is_approximate = is_approximate

def parse_timestamp(text: str, reference_date: Optional[str] = None) -> Optional[ParsedTime]:
    """Extract clinical event timestamp from text.
    Handles military time '14:32', standard time '2:32 PM', '1432 hours',
    and qualifiers like 'at approximately 14:36'.
    If reference_date is absent, sets precision to 'time_only'.
    """
    if not text:
        return None

    # Check for approximate qualifier
    approx_match = re.search(r'\b(?:approx|approximately|around|about)\b', text, re.IGNORECASE)
    is_approximate = approx_match is not None

    # 1. 24-hour military time with colon: '14:36' or '08:15' or '14:36:00'
    m24 = re.search(r'\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b', text)
    if m24:
        hour = m24.group(1).zfill(2)
        minute = m24.group(2)
        second = m24.group(3) or "00"
        time_str = f"{hour}:{minute}:{second}"
        
        if reference_date:
            event_time = f"{reference_date}T{time_str}"
            precision = "datetime"
        else:
            event_time = f"{hour}:{minute}"
            precision = "time_only"

        # Capture surrounding prefix like 'at 14:36' or 'at approximately 14:36'
        start = m24.start()
        end = m24.end()
        preceding = text[:start]
        prefix_match = re.search(r'(?:at\s+(?:approximately\s+|around\s+|about\s+)?)$', preceding, re.IGNORECASE)
        if prefix_match:
            orig_text = text[prefix_match.start():end]
            start = prefix_match.start()
        else:
            orig_text = m24.group(0)

        return ParsedTime(
            event_time=event_time,
            time_precision=precision,
            original_text=orig_text,
            start_char=start,
            end_char=end,
            is_approximate=is_approximate
        )

    # 2. 12-hour AM/PM time: '2:36 PM' or '2:36pm' or '10 AM'
    m12 = re.search(r'\b(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*(am|pm)\b', text, re.IGNORECASE)
    if m12:
        hour = int(m12.group(1))
        minute = m12.group(2) or "00"
        ampm = m12.group(3).lower()
        if ampm == "pm" and hour < 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
        hour_str = str(hour).zfill(2)
        time_str = f"{hour_str}:{minute}:00"
        
        if reference_date:
            event_time = f"{reference_date}T{time_str}"
            precision = "datetime"
        else:
            event_time = f"{hour_str}:{minute}"
            precision = "time_only"

        return ParsedTime(
            event_time=event_time,
            time_precision=precision,
            original_text=m12.group(0),
            start_char=m12.start(),
            end_char=m12.end(),
            is_approximate=is_approximate
        )

    # 3. Military time without colon: '1436 hours' or '0815 hrs'
    mmil = re.search(r'\b([01]\d|2[0-3])([0-5]\d)\s*(?:hours|hrs)\b', text, re.IGNORECASE)
    if mmil:
        hour = mmil.group(1)
        minute = mmil.group(2)
        event_time = f"{hour}:{minute}"
        return ParsedTime(
            event_time=event_time,
            time_precision="time_only",
            original_text=mmil.group(0),
            start_char=mmil.start(),
            end_char=mmil.end(),
            is_approximate=is_approximate
        )

    return None
