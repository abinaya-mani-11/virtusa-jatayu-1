export type EventType = "medication_administration" | "procedure" | "observation";

export type ActionStatus = 
  | "administered"
  | "planned"
  | "refused"
  | "withheld"
  | "discontinued"
  | "prior_administration"
  | "mentioned";

export type TimePrecision = "datetime" | "time_only" | "unknown";
export type ReviewStatus = "pending" | "confirmed" | "rejected" | "modified";
export type RecordStatus = "draft" | "pending_review" | "approved" | "archived";
export type SourceType = "typed_note" | "audio_transcript" | "synthetic_demo";

export interface MedicationDetails {
  name: string;
  code?: string | null;
  original_term?: string | null;
}

export interface DoseDetails {
  value?: number | null;
  unit?: string | null;
  original_text?: string | null;
}

export interface RouteDetails {
  normalized?: string | null;
  original?: string | null;
}

export interface ClinicalEvent {
  event_id: string;
  event_type: EventType;
  medication?: MedicationDetails | null;
  dose?: DoseDetails | null;
  route?: RouteDetails | null;
  frequency?: string | null;
  procedure_name?: string | null;
  procedure_method?: string | null;
  observation_name?: string | null;
  observation_value?: string | null;
  event_time?: string | null;
  time_precision: TimePrecision;
  administration_status: ActionStatus;
  performer?: string | null;
  source_span: string;
  span_start?: number | null;
  span_end?: number | null;
  confidence: number;
  review_status: ReviewStatus;
  reviewer_notes?: string | null;
  is_correction: boolean;
  supersedes_event_id?: string | null;
}

export interface NoteSource {
  type: SourceType;
  original_text: string;
  created_at: string;
  audio_duration_seconds?: number | null;
  speech_engine?: string | null;
}

export interface AuditMetadata {
  revision: number;
  record_status: RecordStatus;
  created_by: string;
  last_modified_by: string;
  created_at: string;
  last_modified_at: string;
}

export interface ClinicalRecord {
  record_id: string;
  schema_version: string;
  source: NoteSource;
  events: ClinicalEvent[];
  audit: AuditMetadata;
  integrity_verified?: boolean | null;
  integrity_last_checked?: string | null;
}

export interface ExtractionWarning {
  code: string;
  message: string;
  target_event_id?: string | null;
  severity: "info" | "warning" | "critical";
}

export interface ExtractResponse {
  record_id: string;
  raw_text: string;
  events: ClinicalEvent[];
  warnings: ExtractionWarning[];
  execution_time_ms: number;
  model_name: string;
  schema_version: string;
}

export interface AuditEntry {
  entry_id: string;
  sequence: number;
  record_id: string;
  event_id?: string | null;
  action_type: string;
  actor_id: string;
  timestamp: string;
  prev_hash: string;
  current_hash: string;
  payload: Record<string, any>;
}

export interface AuditVerificationResult {
  is_valid: boolean;
  total_entries: number;
  verified_entries: number;
  corrupted_entries: number[];
  tampered_details: string[];
  checked_at: string;
  genesis_hash: string;
  head_hash: string;
  message: string;
}

export interface SyntheticScenario {
  id: string;
  title: string;
  category: string;
  text: string;
  expected_events: number;
  highlight: string;
}

export interface DraftNote {
  id: string;
  text: string;
  saved_at: string;
  source_type: SourceType;
  audio_duration?: number;
}
