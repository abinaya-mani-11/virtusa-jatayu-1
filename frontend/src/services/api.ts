import {
  ClinicalRecord,
  ExtractResponse,
  AuditEntry,
  AuditVerificationResult,
  SyntheticScenario,
  ClinicalEvent
} from "../types/clinical";
import { cacheLocalRecord, getCachedLocalRecords, queueOfflineAction } from "./offlineStorage";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function extractEntities(
  text: string,
  responderId: string = "EMS-MEDIC-01"
): Promise<ExtractResponse> {
  const res = await fetch(`${API_BASE_URL}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      source_type: "typed_note",
      responder_id: responderId
    })
  });
  if (!res.ok) {
    throw new Error(`Extraction failed: ${res.statusText}`);
  }
  return res.json();
}

export async function listRecords(status?: string): Promise<ClinicalRecord[]> {
  try {
    const url = status ? `${API_BASE_URL}/records?status=${status}` : `${API_BASE_URL}/records`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load records from server");
    const data: ClinicalRecord[] = await res.json();
    // Cache records locally for offline browsing
    for (const rec of data) {
      await cacheLocalRecord(rec);
    }
    return data;
  } catch (err) {
    console.warn("API unavailable, loading cached local records from IndexedDB:", err);
    return getCachedLocalRecords();
  }
}

export async function getRecord(id: string): Promise<ClinicalRecord> {
  try {
    const res = await fetch(`${API_BASE_URL}/records/${id}`);
    if (!res.ok) throw new Error("Failed to load record");
    const data: ClinicalRecord = await res.json();
    await cacheLocalRecord(data);
    return data;
  } catch (err) {
    console.warn("API unavailable, finding record in IndexedDB cache:", err);
    const cached = await getCachedLocalRecords();
    const found = cached.find((r) => r.record_id === id);
    if (found) return found;
    throw err;
  }
}

export async function createRecord(
  text: string,
  sourceType: "typed_note" | "audio_transcript" | "synthetic_demo" = "typed_note",
  actorId: string = "EMS-RESPONDER-01",
  audioDuration?: number
): Promise<ClinicalRecord> {
  try {
    const res = await fetch(`${API_BASE_URL}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source_type: sourceType,
        actor_id: actorId,
        audio_duration_seconds: audioDuration,
        speech_engine: sourceType === "audio_transcript" ? "Browser-Speech-Recognition" : undefined
      })
    });
    if (!res.ok) throw new Error(`Creation failed: ${res.statusText}`);
    const data = await res.json();
    await cacheLocalRecord(data);
    return data;
  } catch (err) {
    console.warn("Backend offline during record creation, queuing for sync:", err);
    await queueOfflineAction({
      type: "CREATE_RECORD",
      payload: { text, sourceType, actorId, audioDuration }
    });
    throw err;
  }
}

export async function updateRecord(
  recordId: string,
  events: ClinicalEvent[],
  reason: string = "Human verification / manual edit",
  actorId: string = "EMS-RESPONDER-01"
): Promise<ClinicalRecord> {
  const res = await fetch(`${API_BASE_URL}/records/${recordId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actor_id: actorId,
      reason,
      events
    })
  });
  if (!res.ok) throw new Error(`Update failed: ${res.statusText}`);
  const data = await res.json();
  await cacheLocalRecord(data);
  return data;
}

export async function approveRecord(
  recordId: string,
  notes: string = "Field review and clinical sign-off complete",
  actorId: string = "EMS-PARAMEDIC-01"
): Promise<ClinicalRecord> {
  const res = await fetch(`${API_BASE_URL}/records/${recordId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actor_id: actorId,
      notes
    })
  });
  if (!res.ok) throw new Error(`Approval failed: ${res.statusText}`);
  const data = await res.json();
  await cacheLocalRecord(data);
  return data;
}

export async function getAuditTrail(recordId?: string): Promise<AuditEntry[]> {
  const url = recordId ? `${API_BASE_URL}/audit?record_id=${recordId}` : `${API_BASE_URL}/audit`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load audit trail");
  return res.json();
}

export async function verifyAuditTrail(recordId?: string): Promise<AuditVerificationResult> {
  const url = recordId ? `${API_BASE_URL}/audit/verify?record_id=${recordId}` : `${API_BASE_URL}/audit/verify`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error("Failed to verify audit trail");
  return res.json();
}

export async function runTamperTest(sequence: number, note?: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/audit/tamper-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sequence,
      test_note: note || "Simulated unauthorized modification"
    })
  });
  if (!res.ok) throw new Error("Tamper test request failed");
  return res.json();
}

export async function getScenarios(): Promise<SyntheticScenario[]> {
  const res = await fetch(`${API_BASE_URL}/export/scenarios`);
  if (!res.ok) throw new Error("Failed to load scenarios");
  return res.json();
}

export function getPdfExportUrl(recordId: string): string {
  return `${API_BASE_URL}/export/pdf/${recordId}`;
}

export async function getFhirBundle(recordId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/export/fhir/${recordId}`);
  if (!res.ok) throw new Error("Failed to load FHIR bundle");
  return res.json();
}

export async function getNativeJson(recordId: string): Promise<ClinicalRecord> {
  const res = await fetch(`${API_BASE_URL}/export/json/${recordId}`);
  if (!res.ok) throw new Error("Failed to load record JSON");
  return res.json();
}
