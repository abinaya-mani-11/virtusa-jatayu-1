import pytest
from app.nlp.pipeline import ClinicalNLPEngine

@pytest.fixture
def engine():
    return ClinicalNLPEngine()

def test_adversarial_case_1_do_not_administer(engine):
    """'Do not administer morphine.' -> Must be classified as withheld/negated, NOT administered."""
    note = "Do not administer morphine."
    events, warnings, _ = engine.process_note(note)
    assert len(events) == 1
    ev = events[0]
    assert ev.medication.name == "Morphine"
    assert ev.administration_status in ["withheld", "refused"]
    assert ev.administration_status != "administered"

def test_adversarial_case_2_considered_not_given(engine):
    """'Morphine was considered but not given.' -> Must be classified as planned/withheld."""
    note = "Morphine was considered but not given."
    events, warnings, _ = engine.process_note(note)
    assert len(events) == 1
    ev = events[0]
    assert ev.medication.name == "Morphine"
    assert ev.administration_status in ["planned", "withheld"]
    assert ev.administration_status != "administered"

def test_adversarial_case_3_prior_arrival(engine):
    """'The patient received aspirin before arrival.' -> Must be classified as prior_administration."""
    note = "The patient received aspirin before arrival."
    events, warnings, _ = engine.process_note(note)
    assert len(events) == 1
    ev = events[0]
    assert ev.medication.name == "Aspirin"
    assert ev.administration_status == "prior_administration"

def test_adversarial_case_4_unrecorded_medication_name(engine):
    """'Administered 5 mg; medication name not recorded.' -> Must flag unnamed medication with warning."""
    note = "Administered 5 mg; medication name not recorded."
    events, warnings, _ = engine.process_note(note)
    assert len(events) == 1
    ev = events[0]
    assert ev.dose.value == 5.0
    assert ev.medication.name == "Unknown / Unrecorded Medication"
    assert any(w.code == "UNNAMED_MEDICATION" for w in warnings)

def test_adversarial_case_5_epinephrine_approximate_time(engine):
    """'Gave 0.3 mg epinephrine IM at approximately 14:36.' -> Extracts 0.3mg, IM, 14:36, administered."""
    note = "Gave 0.3 mg epinephrine IM at approximately 14:36."
    events, warnings, _ = engine.process_note(note)
    assert len(events) == 1
    ev = events[0]
    assert ev.medication.name == "Epinephrine"
    assert ev.dose.value == 0.3
    assert ev.dose.unit == "mg"
    assert ev.route.normalized == "intramuscular"
    assert ev.event_time == "14:36"
    assert ev.administration_status == "administered"

def test_adversarial_case_6_in_line_correction(engine):
    """'Correction: the dose was 0.03 mg, not 0.3 mg.' -> Supersedes earlier event."""
    note = "At 10:15 gave 0.3 mg epinephrine IM. Correction: the dose was 0.03 mg, not 0.3 mg."
    events, warnings, _ = engine.process_note(note)
    assert len(events) == 2
    # First event should have 0.3 mg, second should have 0.03 mg and be marked as correction
    first = events[0]
    second = events[1]
    assert first.dose.value == 0.3
    assert second.dose.value == 0.03
    assert second.is_correction is True
    assert second.supersedes_event_id == first.event_id
    assert first.review_status == "modified"

def test_adversarial_patient_refusal(engine):
    """'Patient refused nitroglycerin due to severe headache.' -> Must be classified as refused."""
    note = "Patient refused nitroglycerin due to severe headache."
    events, warnings, _ = engine.process_note(note)
    assert len(events) == 1
    assert events[0].administration_status == "refused"

def test_adversarial_discontinued_infusion(engine):
    """'Discontinued normal saline bolus at 11:30.' -> Must be classified as discontinued."""
    note = "Discontinued normal saline bolus at 11:30."
    events, warnings, _ = engine.process_note(note)
    saline_events = [e for e in events if e.medication and "Saline" in e.medication.name]
    assert len(saline_events) == 1
    assert saline_events[0].administration_status == "discontinued"
