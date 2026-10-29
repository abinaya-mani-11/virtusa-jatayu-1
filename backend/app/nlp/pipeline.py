import re
import time
import uuid
from typing import List, Tuple, Optional, Dict, Any
from app.schemas.event import (
    ClinicalEvent, MedicationDetails, DoseDetails, RouteDetails,
    ActionStatus, TimePrecision, ReviewStatus
)
from app.schemas.extraction import ExtractionWarning, ExtractResponse
from app.nlp.clinical_vocab import (
    MEDICATION_VOCABULARY, PROCEDURES_VOCABULARY, ROUTE_MAPPINGS, STANDARDIZED_UNITS
)
from app.nlp.dosage_parser import parse_dosage
from app.nlp.route_normalizer import parse_route
from app.nlp.time_resolver import parse_timestamp
from app.nlp.negation_detector import determine_action_status
from app.nlp.correction_handler import detect_correction, resolve_corrections

class ClinicalNLPEngine:
    def __init__(self):
        self.model_name = "FieldToRecord-LocalRuleEngine-v1.0"
        # Compile medication regex patterns with word boundaries
        self.med_patterns = []
        for term, meta in sorted(MEDICATION_VOCABULARY.items(), key=lambda x: len(x[0]), reverse=True):
            pat = re.compile(r'\b' + re.escape(term) + r'\b', re.IGNORECASE)
            self.med_patterns.append((pat, term, meta))
            
        # Compile procedure patterns
        self.proc_patterns = []
        for term, meta in sorted(PROCEDURES_VOCABULARY.items(), key=lambda x: len(x[0]), reverse=True):
            pat = re.compile(r'\b' + re.escape(term) + r'\b', re.IGNORECASE)
            self.proc_patterns.append((pat, term, meta))

    def split_sentences_with_spans(self, text: str) -> List[Tuple[str, int, int]]:
        """Split text into sentences/clauses while accurately preserving character offsets.
        Protects decimal numbers (e.g. 0.3, .03) and standard abbreviations from splitting.
        """
        segments = []
        if not text:
            return segments

        # Regex for sentence boundaries:
        # 1. Period that is NOT between two digits, followed by whitespace or end
        # 2. Exclamation or question mark followed by whitespace
        # 3. Newline characters
        # Note: We do NOT split on semicolons alone because EMS notes often use them inside a single action statement
        sentence_end_pattern = r'(?:(?<!\d)\.(?!\d)|[!?\n])+'
        
        last_end = 0
        for match in re.finditer(sentence_end_pattern, text):
            end_boundary = match.end()
            raw_seg = text[last_end:end_boundary]
            seg_text = raw_seg.strip()
            if seg_text:
                # Find start offset of stripped text
                offset = raw_seg.find(seg_text)
                start_char = last_end + offset
                end_char = start_char + len(seg_text)
                segments.append((seg_text, start_char, end_char))
            last_end = end_boundary

        # Remaining tail
        if last_end < len(text):
            raw_seg = text[last_end:]
            seg_text = raw_seg.strip()
            if seg_text:
                offset = raw_seg.find(seg_text)
                start_char = last_end + offset
                end_char = start_char + len(seg_text)
                segments.append((seg_text, start_char, end_char))

        # Fallback if no punctuation was present
        if not segments and text.strip():
            segments.append((text.strip(), 0, len(text.strip())))

        return segments

    def extract_performer(self, text: str) -> Optional[str]:
        """Detect explicit responder/clinician identifier in text."""
        # e.g. Medic 4, Paramedic Smith, Squad 12, Officer Chen
        m = re.search(r'\b(?:by|medic|paramedic|officer|squad|unit)\s+([A-Za-z0-9\-]+)\b', text, re.IGNORECASE)
        if m:
            return m.group(0).strip()
        return None

    def extract_observations(self, clause: str, start_offset: int, end_offset: int, current_time: Optional[str]) -> List[ClinicalEvent]:
        """Identify patient symptoms, breathing status, vital signs, or observations."""
        obs_events = []
        obs_patterns = [
            (r'\b(?:difficulty\s+breathing|shortness\s+of\s+breath|dyspnea)\b', "Respiratory Status", "Difficulty breathing"),
            (r'\b(?:breathing\s+improved|respiratory\s+effort\s+improved)\b', "Respiratory Status", "Breathing improved"),
            (r'\b(?:conscious|alert|unconscious|unresponsive|lethargic)\b', "Consciousness Level", None),
            (r'\b(?:bp|blood\s+pressure)\s*(\d{2,3}\s*/\s*\d{2,3})\b', "Blood Pressure", None),
            (r'\b(?:pulse|heart\s+rate|hr)\s*(\d{2,3})\b', "Heart Rate", None),
            (r'\b(?:spo2|pulse\s+ox|oxygen\s+saturation)\s*(\d{1,3}\s*%?)\b', "SpO2", None)
        ]

        for pat, obs_name, fixed_val in obs_patterns:
            m = re.search(pat, clause, re.IGNORECASE)
            if m:
                val = fixed_val if fixed_val else m.group(0)
                obs_events.append(ClinicalEvent(
                    event_id=str(uuid.uuid4()),
                    event_type="observation",
                    observation_name=obs_name,
                    observation_value=val,
                    event_time=current_time,
                    time_precision="time_only" if current_time else "unknown",
                    administration_status="administered",
                    source_span=clause,
                    span_start=start_offset,
                    span_end=end_offset,
                    confidence=0.88,
                    review_status="pending"
                ))
        return obs_events

    def process_note(
        self,
        text: str,
        responder_id: Optional[str] = "EMS-MEDIC-01",
        reference_date: Optional[str] = None
    ) -> Tuple[List[ClinicalEvent], List[ExtractionWarning], float]:
        """Execute full clinical information extraction pipeline over note."""
        start_time = time.time()
        events: List[ClinicalEvent] = []
        warnings: List[ExtractionWarning] = []

        segments = self.split_sentences_with_spans(text)
        current_context_time: Optional[str] = None
        current_time_precision: str = "unknown"

        for clause, start_char, end_char in segments:
            # 1. Resolve explicit timestamps in clause
            parsed_time = parse_timestamp(clause, reference_date)
            if parsed_time:
                current_context_time = parsed_time.event_time
                current_time_precision = parsed_time.time_precision

            # Check if this clause is an explicit correction
            correction_text = detect_correction(clause)
            is_correction = correction_text is not None

            # Detect performer
            performer = self.extract_performer(clause) or responder_id

            # 2. Extract Procedures & Interventions with Overlapping Span Deduplication
            raw_matched_procs = []
            for pat, proc_term, proc_meta in self.proc_patterns:
                for m in pat.finditer(clause):
                    raw_matched_procs.append((m.start(), m.end(), proc_term, proc_meta))

            raw_matched_procs.sort(key=lambda x: (x[1] - x[0]), reverse=True)
            matched_procedures = []
            proc_occupied_spans = []
            for start_p, end_p, proc_term, proc_meta in raw_matched_procs:
                overlaps = any(not (end_p <= occ_s or start_p >= occ_e) for occ_s, occ_e in proc_occupied_spans)
                if not overlaps:
                    proc_occupied_spans.append((start_p, end_p))
                    matched_procedures.append((proc_term, proc_meta))

            # 3. Extract Medications with Non-Maximum Suppression (Overlapping span deduplication)
            raw_matched_meds = []
            for pat, med_term, med_meta in self.med_patterns:
                for m in pat.finditer(clause):
                    raw_matched_meds.append((m.start(), m.end(), m, med_term, med_meta))

            # Sort by span length descending so longer phrases (e.g. "normal saline") take precedence over "saline"
            raw_matched_meds.sort(key=lambda x: (x[1] - x[0]), reverse=True)
            matched_meds = []
            occupied_spans = []

            for start_pos, end_pos, match_obj, med_term, med_meta in raw_matched_meds:
                # Check if this span overlaps with an already accepted longer span
                overlaps = any(not (end_pos <= occ_s or start_pos >= occ_e) for occ_s, occ_e in occupied_spans)
                if not overlaps:
                    occupied_spans.append((start_pos, end_pos))
                    matched_meds.append((match_obj, med_term, med_meta))

            # 4. Handle Case: Medication Name Not Recorded Adversarial/Edge Case
            # e.g., "Administered 5 mg; medication name not recorded."
            unnamed_med_match = re.search(
                r'\b(?:medication\s+(?:name\s+)?not\s+recorded|unknown\s+medication|unspecified\s+medication)\b',
                clause,
                re.IGNORECASE
            )
            parsed_dose_unnamed = parse_dosage(clause)
            if unnamed_med_match and parsed_dose_unnamed and not matched_meds:
                # Create an event for the unnamed medication
                status, _, _ = determine_action_status(clause)
                parsed_route = parse_route(clause)
                ev = ClinicalEvent(
                    event_id=str(uuid.uuid4()),
                    event_type="medication_administration",
                    medication=MedicationDetails(
                        name="Unknown / Unrecorded Medication",
                        code=None,
                        original_term="not recorded"
                    ),
                    dose=DoseDetails(
                        value=parsed_dose_unnamed.value,
                        unit=parsed_dose_unnamed.unit,
                        original_text=parsed_dose_unnamed.original_text
                    ),
                    route=RouteDetails(
                        normalized=parsed_route.normalized if parsed_route else None,
                        original=parsed_route.original if parsed_route else None
                    ) if parsed_route else None,
                    event_time=current_context_time,
                    time_precision=current_time_precision if current_context_time else "unknown",
                    administration_status=status,
                    performer=performer,
                    source_span=clause,
                    span_start=start_char,
                    span_end=end_char,
                    confidence=0.45,
                    review_status="pending",
                    is_correction=is_correction
                )
                events.append(ev)
                warnings.append(ExtractionWarning(
                    code="UNNAMED_MEDICATION",
                    message="Dose identified but medication name is missing or explicitly not recorded. Critical human review required.",
                    target_event_id=ev.event_id,
                    severity="critical"
                ))

            # Process Identified Medications
            # Group or handle each medication in this clause
            for match_obj, med_term, med_meta in matched_meds:
                # Determine action status (administered, planned, refused, withheld, prior, mentioned)
                action_status, status_conf, status_reason = determine_action_status(clause)
                
                # Parse dose
                dose_info = parse_dosage(clause)
                
                # Parse route
                route_info = parse_route(clause)

                # Calculate confidence score
                conf = 0.85
                if dose_info and dose_info.value is not None:
                    conf += 0.05
                else:
                    conf -= 0.10  # Missing dose penalty

                if route_info:
                    conf += 0.05
                else:
                    conf -= 0.05  # Missing route penalty

                if current_context_time:
                    conf += 0.04
                else:
                    conf -= 0.05  # Missing timestamp penalty

                if action_status in ["refused", "withheld", "planned", "prior_administration"]:
                    conf = min(conf, status_conf)

                conf = max(0.25, min(0.98, round(conf, 2)))

                med_event = ClinicalEvent(
                    event_id=str(uuid.uuid4()),
                    event_type="medication_administration",
                    medication=MedicationDetails(
                        name=med_meta["canonical"],
                        code=med_meta.get("code"),
                        original_term=match_obj.group(0)
                    ),
                    dose=DoseDetails(
                        value=dose_info.value,
                        unit=dose_info.unit,
                        original_text=dose_info.original_text
                    ) if dose_info else None,
                    route=RouteDetails(
                        normalized=route_info.normalized,
                        original=route_info.original
                    ) if route_info else None,
                    event_time=current_context_time,
                    time_precision=current_time_precision if current_context_time else "unknown",
                    administration_status=action_status,
                    performer=performer,
                    source_span=clause,
                    span_start=start_char,
                    span_end=end_char,
                    confidence=conf,
                    review_status="pending",
                    is_correction=is_correction
                )
                events.append(med_event)

                # Check warnings for medication
                if not med_event.dose and action_status == "administered":
                    warnings.append(ExtractionWarning(
                        code="MISSING_DOSE",
                        message=f"Medication '{med_meta['canonical']}' administered without explicit dose.",
                        target_event_id=med_event.event_id,
                        severity="warning"
                    ))
                if not med_event.route and action_status == "administered":
                    warnings.append(ExtractionWarning(
                        code="MISSING_ROUTE",
                        message=f"Medication '{med_meta['canonical']}' administered without explicit route.",
                        target_event_id=med_event.event_id,
                        severity="warning"
                    ))
                if not med_event.event_time:
                    warnings.append(ExtractionWarning(
                        code="MISSING_TIMESTAMP",
                        message=f"Medication '{med_meta['canonical']}' does not have an explicit event time.",
                        target_event_id=med_event.event_id,
                        severity="info"
                    ))
                if is_correction:
                    warnings.append(ExtractionWarning(
                        code="INLINE_CORRECTION",
                        message=f"Clause contains an on-scene amendment/correction.",
                        target_event_id=med_event.event_id,
                        severity="info"
                    ))

            # Handle Case: Correction Clause with Dose but without repeated drug name
            # e.g., "Correction: the dose was 0.03 mg, not 0.3 mg."
            if is_correction and not matched_meds:
                correction_dose = parse_dosage(clause)
                prev_med_events = [e for e in events if e.event_type == "medication_administration" and e.medication]
                if correction_dose and prev_med_events:
                    target_prev = prev_med_events[-1]
                    corr_event = ClinicalEvent(
                        event_id=str(uuid.uuid4()),
                        event_type="medication_administration",
                        medication=target_prev.medication,
                        dose=DoseDetails(
                            value=correction_dose.value,
                            unit=correction_dose.unit,
                            original_text=correction_dose.original_text
                        ),
                        route=target_prev.route,
                        event_time=target_prev.event_time or current_context_time,
                        time_precision=target_prev.time_precision,
                        administration_status=target_prev.administration_status,
                        performer=performer,
                        source_span=clause,
                        span_start=start_char,
                        span_end=end_char,
                        confidence=0.92,
                        review_status="pending",
                        is_correction=True,
                        supersedes_event_id=target_prev.event_id
                    )
                    events.append(corr_event)
                    warnings.append(ExtractionWarning(
                        code="INLINE_CORRECTION",
                        message=f"On-scene correction of prior medication dose applied to {target_prev.medication.name}.",
                        target_event_id=corr_event.event_id,
                        severity="info"
                    ))

            # Process Identified Procedures
            for proc_term, proc_meta in matched_procedures:
                # If procedure is 'oxygen' and already parsed as medication, don't duplicate unless it specifies delivery mask/device
                if proc_term == "oxygen" and any(e.medication and e.medication.name == "Oxygen" for e in events if e.source_span == clause):
                    continue

                action_status, status_conf, status_reason = determine_action_status(clause)
                
                # Check for rate or device
                dose_info = parse_dosage(clause)
                method = None
                if "mask" in clause.lower() or "cannula" in clause.lower() or "nrb" in clause.lower():
                    m_dev = re.search(r'(non-rebreather(?:\s+mask)?|nasal\s+cannula|bvm|bag-valve-mask)', clause, re.IGNORECASE)
                    if m_dev:
                        method = m_dev.group(0)

                proc_event = ClinicalEvent(
                    event_id=str(uuid.uuid4()),
                    event_type="procedure",
                    procedure_name=proc_meta["canonical"],
                    procedure_method=method,
                    dose=DoseDetails(
                        value=dose_info.value,
                        unit=dose_info.unit,
                        original_text=dose_info.original_text
                    ) if dose_info else None,
                    event_time=current_context_time,
                    time_precision=current_time_precision if current_context_time else "unknown",
                    administration_status=action_status,
                    performer=performer,
                    source_span=clause,
                    span_start=start_char,
                    span_end=end_char,
                    confidence=0.90,
                    review_status="pending",
                    is_correction=is_correction
                )
                events.append(proc_event)

            # 5. Extract Observations (vital signs / clinical status)
            obs = self.extract_observations(clause, start_char, end_char, current_context_time)
            events.extend(obs)

        # 6. Resolve Errata and Corrections Across the Note
        events = resolve_corrections(events)

        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return events, warnings, elapsed_ms

# Global singleton engine instance
nlp_engine = ClinicalNLPEngine()
