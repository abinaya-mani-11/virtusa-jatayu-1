import { DraftNote, ClinicalRecord } from "../types/clinical";

const DB_NAME = "FieldToRecordLocalDB";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains("drafts")) {
        db.createObjectStore("drafts", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("records")) {
        db.createObjectStore("records", { keyPath: "record_id" });
      }
      if (!db.objectStoreNames.contains("pending_queue")) {
        db.createObjectStore("pending_queue", { autoIncrement: true, keyPath: "queue_id" });
      }
    };
  });
}

export async function saveLocalDraft(draft: DraftNote): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    const store = tx.objectStore("drafts");
    const req = store.put(draft);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalDrafts(): Promise<DraftNote[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readonly");
    const store = tx.objectStore("drafts");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalDraft(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    const store = tx.objectStore("drafts");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function cacheLocalRecord(record: ClinicalRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    const store = tx.objectStore("records");
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedLocalRecords(): Promise<ClinicalRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readonly");
    const store = tx.objectStore("records");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function queueOfflineAction(action: { type: string; payload: any }): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_queue", "readwrite");
    const store = tx.objectStore("pending_queue");
    const req = store.add({ ...action, queued_at: new Date().toISOString() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingQueueCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending_queue", "readonly");
    const store = tx.objectStore("pending_queue");
    const req = store.count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}
