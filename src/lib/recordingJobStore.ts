/**
 * Durable per-user, per-household store for an in-progress recording job, so a page
 * reload or crash mid-upload doesn't lose an unrepeatable conversation.
 *
 * Defensive by design: every operation is wrapped so a missing or blocked
 * IndexedDB can never break recording itself — persistence is belt-and-braces
 * on top of the in-memory provider, not a hard dependency.
 */
import type { JobMetadata, RecordingIdentity } from '@/lib/recordingJob';

const DB_NAME = 'myht-recordings';
const STORE = 'pending';
export const recordingSlot = (identity: RecordingIdentity) => identity.user_id + ':' + identity.household_id;

export interface StoredJob extends RecordingIdentity {
  id: string;
  metadata: JobMetadata;
  ext: string;
  bytes: number;
  /** Present when the audio is still local (upload not yet confirmed). */
  blob?: Blob;
  /** Present once uploaded — retry can skip straight to transcription. */
  storagePath?: string;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<T | null>(resolve => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      let result: T | null = null;
      req.onsuccess = () => { result = req.result as T; };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = tx.onabort = () => { db.close(); resolve(null); };
    } catch {
      resolve(null);
    }
  });
}

export async function persistJob(job: StoredJob): Promise<void> {
  await withStore('readwrite', store => store.put(job, recordingSlot(job)));
}

export async function loadPersistedJob(identity: RecordingIdentity): Promise<StoredJob | null> {
  const job = await withStore<StoredJob>('readonly', store => store.get(recordingSlot(identity)));
  return job?.user_id === identity.user_id && job?.household_id === identity.household_id ? job : null;
}

export async function clearPersistedJob(identity: RecordingIdentity): Promise<void> {
  await withStore('readwrite', store => store.delete(recordingSlot(identity)));
}
