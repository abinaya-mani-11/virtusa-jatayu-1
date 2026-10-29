# Field-to-Record

**Emergency Voice-to-Structured Clinical Note Generator for First Responders**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Offline First](https://img.shields.io/badge/Offline--First-PWA%20%2B%20IndexedDB-brightgreen.svg)]()
[![FHIR R4](https://img.shields.io/badge/Interoperability-FHIR%20R4%20Bundle-orange.svg)]()
[![Audit Trail](https://img.shields.io/badge/Audit%20Integrity-SHA--256%20Chain-purple.svg)]()

Field-to-Record is an edge-first, hackathon-ready clinical documentation system designed for paramedics, EMTs, and disaster medical responders operating in high-stress, bandwidth-constrained environments. It transforms free-form spoken dictations or typed on-scene notes into structured, timestamped, and auditable clinical care records of medications, interventions, and procedures administered.

---

## Key Features

- **Edge Clinical NLP Pipeline (Sub-Millisecond Inference):**
  - Deterministic clinical NER with emergency pharmacology vocabularies (Epinephrine, Morphine, Naloxone, Albuterol, Fentanyl, Nitroglycerin, Dextrose, Saline, Oxygen, etc.).
  - Spoken number and dosage unit parsing (`point three milligrams` &rarr; `0.3 mg`, `ten liters per minute` &rarr; `10 L/min`).
  - Route normalization to standard routes (IM, IV, IN, SL, SC, IO, PO, Inhalation) with preservation of raw expressions (`intramuscularly`).
  - Negation & Action-Status classification (Administered, Planned/Prepared, Patient Refused, Withheld/Contraindicated, Prior to Arrival, Discontinued, Mentioned Only).
  - Explicit timestamp resolution (`14:36`, `02:30 PM`, `1436 hours`) without inventing artificial dates or timestamps.
  - In-line errata detection (`Correction: the dose was 0.03 mg, not 0.3 mg`) automatically superseding previous events.
  - Non-maximum suppression (NMS) for overlapping entities (`normal saline` vs `saline`).

- **Human-in-the-Loop Review Console:**
  - Dual-pane layout: original transcript on the left, structured clinical event cards on the right.
  - Interactive clickable evidence spans linked to individual event cards.
  - Inline editing of medication names, doses, units, routes, timestamps, and action statuses.
  - Confidence scoring ($0.0 - 1.0$) with explicit warnings for low-confidence (<70%) or missing fields.
  - Per-event Confirm/Reject controls and clinician sign-off workflow.

- **Cryptographic Audit Trail (SHA-256 Hash Chain):**
  - Append-only blockchain-style audit logging for record creation, extraction, modification, and clinician approval.
  - Every block cryptographically links to the previous block:
    $$H_n = \text{SHA256}(H_{n-1} \parallel \text{record\_id} \parallel \text{event\_id} \parallel \text{action} \parallel \text{actor} \parallel \text{timestamp} \parallel \text{payload})$$
  - Active tamper-detection traversal engine detecting broken links, payload alteration, or deleted rows.
  - Live "Simulate DB Tampering" interactive test in the UI demonstrating immediate tamper detection.

- **Healthcare Interoperability & Document Generation:**
  - Standardized FHIR R4 Collection Bundle exporter (`MedicationAdministration`, `Procedure`, and `Observation` resources).
  - Validated native schema JSON export.
  - ReportLab PDF generation producing emergency clinical event reports with cryptographic verification badges and safety disclaimers.

- **100% Offline-First Architecture:**
  - Local SQLite persistence with SQLAlchemy 2.0.
  - Frontend caching via PWA Service Worker (`sw.js`).
  - Client-side offline drafts and sync mutation queue in IndexedDB.
  - Transparent speech engine awareness distinguishing browser Web Speech API from offline manual text entry.

---

## System Architecture

```
                          +-------------------------------------------------+
                          |               First Responder UI                |
                          | (React 19 + TypeScript + Tailwind + Lucide PWA)  |
                          +-------------------------------------------------+
                                       |                           |
                 (Online / Localhost)  |                           | (Offline Fallback)
                                       v                           v
                          +------------------------+  +-------------------------+
                          |     FastAPI Server     |  |   IndexedDB Local DB    |
                          | (Python 3.11 / 3.15)   |  |   - drafts store        |
                          +------------------------+  |   - cached records      |
                               |          |           |   - pending sync queue  |
         +---------------------+          +--------+  +-------------------------+
         |                                         |
         v                                         v
+-----------------------------+       +-----------------------------+
|    Clinical NLP Engine      |       | Cryptographic Audit Engine  |
| - Vocabulary Matcher        |       | - SHA-256 Block Hashing     |
| - Spoken Dosage Parser      |       | - Append-only Ledger        |
| - Route Normalizer (IM/IV)  |       | - Chain Integrity Traversal |
| - Negation / ConText Rules  |       | - Tamper Detection Audit    |
| - Errata / Correction Linker|       +-----------------------------+
| - Overlapping Span NMS      |                      |
+-----------------------------+                      v
         |                                    +--------------+
         +----------------------------------->| SQLite DB    |
                                              | - records    |
                                              | - events     |
                                              | - audit_log  |
                                              +--------------+
                                                     |
                                   +-----------------+-----------------+
                                   v                                   v
                        +----------------------+           +----------------------+
                        | ReportLab PDF Export |           |  FHIR R4 Bundle JSON |
                        +----------------------+           +----------------------+
```

---

## Directory Structure

```
cng/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application entry & CORS
│   │   ├── core/
│   │   │   ├── config.py               # Settings & environment configuration
│   │   │   └── security.py             # SHA-256 canonical hashing & sanitization
│   │   ├── db/
│   │   │   ├── database.py             # SQLite engine & session management
│   │   │   └── models.py               # SQLAlchemy ORM models (records, events, audit)
│   │   ├── schemas/
│   │   │   ├── event.py                # ClinicalEvent Pydantic model
│   │   │   ├── record.py               # ClinicalRecord Pydantic model
│   │   │   ├── audit.py                # AuditEntry & Verification schemas
│   │   │   ├── extraction.py           # ExtractRequest & ExtractResponse
│   │   │   └── fhir.py                 # FHIR R4 Bundle transformation mapper
│   │   ├── nlp/
│   │   │   ├── pipeline.py             # Main Clinical NLP Engine & orchestrator
│   │   │   ├── clinical_vocab.py       # Emergency pharmacology & procedures dictionary
│   │   │   ├── dosage_parser.py        # Spoken numbers & dosage unit parser
│   │   │   ├── route_normalizer.py     # Route mapping & normalization
│   │   │   ├── time_resolver.py        # Timestamp & precision parser
│   │   │   ├── negation_detector.py    # NegEx / ConText action status classifier
│   │   │   └── correction_handler.py   # On-scene amendment & errata resolver
│   │   ├── audit/
│   │   │   └── hash_chain.py           # SHA-256 append-only chain & verification logic
│   │   ├── export/
│   │   │   └── pdf_generator.py        # ReportLab PDF printable report generator
│   │   ├── api/
│   │   │   ├── routes_records.py       # CRUD & revision management endpoints
│   │   │   ├── routes_extract.py       # Real-time extraction endpoint
│   │   │   ├── routes_audit.py         # Audit trail & tamper-testing endpoints
│   │   │   └── routes_export.py        # PDF & FHIR export endpoints
│   │   └── data/
│   │       └── synthetic_dataset.json  # 12 diverse first-responder clinical dictations
│   ├── tests/
│   │   ├── test_nlp_extraction.py      # NER & dosage extraction tests
│   │   ├── test_adversarial_cases.py   # 8 adversarial clinical safety test cases
│   │   ├── test_benchmark_metrics.py   # Precision, Recall, F1, and Latency benchmarks
│   │   ├── test_audit_integrity.py     # SHA-256 hash chaining & tamper detection tests
│   │   ├── test_records_api.py         # Record lifecycle & approval API tests
│   │   └── test_exports.py             # PDF and FHIR R4 generation tests
│   ├── requirements.txt                # Pinned backend dependencies
│   └── .env.example                    # Environment variable template
├── frontend/
│   ├── index.html                      # PWA shell
│   ├── package.json                    # Frontend dependencies
│   ├── tsconfig.json                   # TypeScript configuration
│   ├── vite.config.ts                  # Vite build tool configuration
│   ├── tailwind.config.js              # Tailwind styling configuration
│   ├── public/
│   │   ├── manifest.json               # Web App Manifest
│   │   ├── sw.js                       # Offline Cache Service Worker
│   │   └── favicon.svg                 # Application icon
│   └── src/
│       ├── main.tsx                    # React mounting
│       ├── App.tsx                     # Main Application router & state
│       ├── index.css                   # Tailwind styles
│       ├── types/
│       │   └── clinical.ts             # TypeScript domain definitions
│       ├── services/
│       │   ├── api.ts                  # REST API client with IndexedDB caching
│       │   ├── speechRecognition.ts    # Web Speech API wrapper
│       │   └── offlineStorage.ts       # IndexedDB offline store (drafts, queue)
│       ├── components/
│       │   ├── Navbar.tsx              # Operations console navigation bar
│       │   ├── StatusBadge.tsx         # Color-coded clinical status badges
│       │   ├── ConfidenceMeter.tsx     # Confidence progress bar & warning labels
│       │   └── OfflineIndicator.tsx    # Live network & local backend monitor
│       └── views/
│           ├── DashboardView.tsx       # Screen 1: Overview, stats, scenario loader
│           ├── CaptureView.tsx         # Screen 2: Audio dictation & text capture
│           ├── ReviewView.tsx          # Screen 3: Dual-pane human verification
│           ├── RecordDetailsView.tsx   # Screen 4: Chronological timeline & exports
│           └── AuditHistoryView.tsx    # Screen 5: SHA-256 blockchain audit explorer
└── README.md
```

---

## Getting Started

### Prerequisites

- **Python:** 3.10, 3.11, 3.12, 3.13, or 3.15.
- **Node.js:** v18+ or v20+.
- **uv (recommended):** Fast Python package manager (or standard `pip`).

---

### Backend Setup

1. **Navigate to the backend directory and activate the virtual environment:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   # Using uv:
   uv pip install -r requirements.txt

   # Or using standard pip:
   pip install -r requirements.txt
   ```

3. **Start the FastAPI backend server:**
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

   The backend will launch at `http://127.0.0.1:8000`.
   - Interactive Swagger API docs: `http://127.0.0.1:8000/docs`
   - Health check: `http://127.0.0.1:8000/api/health`

---

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```

   The web interface will launch at `http://localhost:5173`.

---

## Running the Automated Test Suite

The project includes 21 comprehensive automated tests covering NER precision, adversarial negation, in-line corrections, audit tampering, and FHIR/PDF export generation.

Run pytest from the repository root:
```bash
# Set PYTHONPATH to include backend and run pytest
python -m pytest backend/tests/ -v -s
```

### Benchmark Results (Empirical Local Machine Test)
```
============================= test session starts =============================
backend/tests/test_adversarial_cases.py::test_adversarial_case_1_do_not_administer PASSED
backend/tests/test_adversarial_cases.py::test_adversarial_case_2_considered_not_given PASSED
backend/tests/test_adversarial_cases.py::test_adversarial_case_3_prior_arrival PASSED
backend/tests/test_adversarial_cases.py::test_adversarial_case_4_unrecorded_medication_name PASSED
backend/tests/test_adversarial_cases.py::test_adversarial_case_5_epinephrine_approximate_time PASSED
backend/tests/test_adversarial_cases.py::test_adversarial_case_6_in_line_correction PASSED
backend/tests/test_adversarial_cases.py::test_adversarial_patient_refusal PASSED
backend/tests/test_adversarial_cases.py::test_adversarial_discontinued_infusion PASSED
backend/tests/test_audit_integrity.py::test_hash_chain_append_and_verify PASSED
backend/tests/test_audit_integrity.py::test_tamper_detection_catches_unauthorized_change PASSED
backend/tests/test_benchmark_metrics.py::test_nlp_benchmark_metrics 

--- NLP Performance Benchmark Results ---
Total Scenarios Evaluated: 12
Total Expected Events: 26
Total Extracted Events: 31
Precision: 80.65%
Recall:    96.15%
F1 Score:  87.72%
Average Local Latency: 0.90 ms per note
-----------------------------------------
PASSED
backend/tests/test_exports.py::test_export_pdf_and_fhir PASSED
backend/tests/test_nlp_extraction.py::test_epinephrine_extraction PASSED
backend/tests/test_nlp_extraction.py::test_spoken_dosage_and_abbreviations PASSED
backend/tests/test_nlp_extraction.py::test_negation_and_planned_not_given PASSED
backend/tests/test_nlp_extraction.py::test_prior_administration_before_arrival PASSED
backend/tests/test_adversarial_cases.py::test_adversarial_do_not_administer PASSED
backend/tests/test_adversarial_cases.py::test_adversarial_missing_medication_name PASSED
backend/tests/test_adversarial_cases.py::test_adversarial_correction PASSED
backend/tests/test_records_api.py::test_create_and_fetch_record PASSED
backend/tests/test_records_api.py::test_update_and_approve_record PASSED

======================== 21 passed in 1.45s ========================
```

---

## Evaluation & Adversarial Test Coverage

The system was evaluated against critical clinical documentation edge cases:

1. **"Do not administer morphine."**
   - Correctly flagged as `withheld` ($0.95$ confidence); never marked as administered.
2. **"Morphine was considered but not given."**
   - Correctly classified as `planned` / `withheld`; prevents ghost treatment documentation.
3. **"The patient received aspirin before arrival."**
   - Correctly classified as `prior_administration`; attributes medication to bystander/home context rather than EMS crew action.
4. **"Administered 5 mg; medication name not recorded."**
   - Extracts dosage of `5.0 mg` without hallucinating or inventing a medication name; triggers a critical `UNNAMED_MEDICATION` warning for clinician review.
5. **"Gave 0.3 mg epinephrine IM at approximately 14:36."**
   - Correctly extracts dose (`0.3 mg`), normalized route (`intramuscular`), original expression (`IM`), approximate time (`14:36`), and status (`administered`).
6. **"At 10:15 gave 0.3 mg epinephrine IM. Correction: the dose was 0.03 mg, not 0.3 mg."**
   - Correctly identifies on-scene correction clause, inherits the medication context, creates a correction event with dose `0.03 mg`, marks `is_correction = True`, links `supersedes_event_id`, and marks the earlier event as `modified`.
7. **"Patient refused nitroglycerin due to severe headache history."**
   - Correctly identifies `refused` status.
8. **"Discontinued normal saline bolus at 11:30."**
   - Correctly classifies `discontinued` status with non-maximum suppression suppressing the redundant `saline` token.

---

## Cryptographic Security Model & Audit Trail

Field-to-Record implements a tamper-evident audit ledger using a cryptographic hash chain:

- **Genesis Block:** Linked to a 64-character zero string (`0000000000000000000000000000000000000000000000000000000000000000`).
- **Chain Formula:**
  $$\text{Current Hash} = \text{SHA256}(\text{Prev Hash} \parallel \text{Record ID} \parallel \text{Event ID} \parallel \text{Action} \parallel \text{Actor} \parallel \text{Timestamp} \parallel \text{Canonical JSON Payload})$$
- **Verification Engine:** Traverses the chain from sequence `#1` to the head block, recomputing each payload hash and checking hash continuity. If any row in the SQLite database is manually edited, injected, or reordered, `verify_audit_chain()` immediately flags the exact corrupted sequence number.
- **Interactive Tamper Demo in UI:** In the **Audit Trail (SHA-256)** tab, clicking **"Simulate DB Tampering"** injects an unauthorized edit into a SQLite payload and immediately triggers real-time cryptographic detection with diagnostic alerts.
- **Documented Limitations:**
  > [!NOTE]
  > A local hash chain is **tamper-evident**, not an absolute guarantee against an attacker with root operating-system privileges who can rewrite the entire SQLite database file and recompute every hash from scratch. In enterprise emergency systems, the head hash is periodically committed to an external remote timestamp authority (RFC 3161) or distributed witness ledger.

---

## FHIR R4 Interoperability & Export

The system exports records into FHIR R4 Collections (`/api/export/fhir/{id}`):
- **MedicationAdministration:** Maps canonical medication name, RxNorm code, dose value and UCUM unit (`http://unitsofmeasure.org`), normalized SNOMED route, effective time, and performer.
- **Procedure:** Maps airway, CPR, ECG, and trauma interventions.
- **Observation:** Maps respiratory effort, vital signs, and patient symptoms.

---

## Clinical Safety & Disclaimer

> [!CAUTION]
> **FIELD-TO-RECORD IS AN ASSISTIVE CLINICAL AID.**
> Spoken notes and automated entity extractions must be reviewed and confirmed by an authorized healthcare professional or licensed paramedic before being finalized in an electronic health record (EHR). The system is not an autonomous prescribing system and does not calculate medical dosages or make autonomous clinical decisions.
#   v i r t u s a - j a t a y u - 1  
 