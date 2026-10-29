import pytest
from app.nlp.pipeline import ClinicalNLPEngine

@pytest.fixture
def engine():
    return ClinicalNLPEngine()

def test_epinephrine_extraction(engine):
    note = "At 14:32, patient was conscious but experiencing difficulty breathing. Administered oxygen at 10 liters per minute through a non-rebreather mask. At 14:36, administered 0.3 milligrams of epinephrine intramuscularly. Patient's breathing improved at 14:40."
    events, warnings, elapsed = engine.process_note(note)

    assert len(events) >= 3
    
    # Check Epinephrine
    epi_events = [e for e in events if e.medication and e.medication.name == "Epinephrine"]
    assert len(epi_events) == 1
    epi = epi_events[0]
    assert epi.dose.value == 0.3
    assert epi.dose.unit == "mg"
    assert epi.route.normalized == "intramuscular"
    assert epi.route.original.lower() == "intramuscularly"
    assert epi.event_time == "14:36"
    assert epi.administration_status == "administered"
    assert epi.review_status == "pending"

def test_spoken_dosage_and_abbreviations(engine):
    note = "At 02:15 PM, gave point three milligrams epi IM to 45yo male."
    events, warnings, _ = engine.process_note(note)
    epi_events = [e for e in events if e.medication and e.medication.name == "Epinephrine"]
    assert len(epi_events) == 1
    assert epi_events[0].dose.value == 0.3
    assert epi_events[0].dose.unit == "mg"
    assert epi_events[0].route.normalized == "intramuscular"

def test_negation_and_planned_not_given(engine):
    note = "We prepared morphine but did not administer it due to drop in blood pressure."
    events, warnings, _ = engine.process_note(note)
    morph_events = [e for e in events if e.medication and e.medication.name == "Morphine"]
    assert len(morph_events) == 1
    assert morph_events[0].administration_status in ["planned", "withheld"]

def test_prior_administration_before_arrival(engine):
    note = "Patient had received aspirin before our arrival from family members."
    events, warnings, _ = engine.process_note(note)
    asa_events = [e for e in events if e.medication and e.medication.name == "Aspirin"]
    assert len(asa_events) == 1
    assert asa_events[0].administration_status == "prior_administration"

def test_adversarial_do_not_administer(engine):
    note = "Do not administer morphine."
    events, warnings, _ = engine.process_note(note)
    morph_events = [e for e in events if e.medication and e.medication.name == "Morphine"]
    assert len(morph_events) == 1
    assert morph_events[0].administration_status == "withheld"

def test_adversarial_missing_medication_name(engine):
    note = "Administered 5 mg; medication name not recorded."
    events, warnings, _ = engine.process_note(note)
    assert len(events) >= 1
    assert any(e.dose and e.dose.value == 5.0 for e in events)
    assert any(w.code == "UNNAMED_MEDICATION" for w in warnings)

def test_adversarial_correction(engine):
    note = "At 10:15 gave 0.3 mg epinephrine IM. Correction: the dose was 0.03 mg, not 0.3 mg."
    events, warnings, _ = engine.process_note(note)
    assert len(events) >= 2
    # Verify that one is marked as correction and superseded ID is set
    corrections = [e for e in events if e.is_correction]
    assert len(corrections) >= 1
    assert corrections[0].supersedes_event_id is not None
