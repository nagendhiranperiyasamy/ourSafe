import { StoredRecordingMeta } from '../types/safety';

const DB_NAME = 'aurasafe_evidence_db_v1';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

export interface StoredRecordingRecord extends StoredRecordingMeta {
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open evidence database.'));
  });
}

export async function saveRecordingToDb(
  record: StoredRecordingRecord
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to store recording.'));
    };
  });
}

export async function listUserRecordings(
  userId: string
): Promise<StoredRecordingRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('userId');
    const req = index.getAll(userId);
    req.onsuccess = () => {
      db.close();
      const items = (req.result as StoredRecordingRecord[]) ?? [];
      items.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      resolve(items);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error('Failed to read recordings.'));
    };
  });
}

export async function updateRecordingSharedFlag(
  id: string,
  sharedWithGuardians: boolean
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as StoredRecordingRecord | undefined;
      if (existing) {
        store.put({ ...existing, sharedWithGuardians });
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to update recording.'));
    };
  });
}

export async function deleteRecordingFromDb(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Failed to delete recording.'));
    };
  });
}

export async function clearUserRecordings(userId: string): Promise<void> {
  const records = await listUserRecordings(userId);
  await Promise.all(records.map((r) => deleteRecordingFromDb(r.id)));
}
