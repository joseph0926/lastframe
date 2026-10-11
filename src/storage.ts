import { isFrameUsable, type Frame } from './frame';
import { matchRoute, maskSignature, type ResolvedPolicy } from './policy';

const DB_NAME = 'lastframe';
const DB_VERSION = 1;
const STORE = 'frames';
/** Database of the predecessor package, `@firsttx/prepaint`. Removed on first prune. */
const LEGACY_DB_NAME = 'firsttx-prepaint';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      // Let a newer version of the page upgrade the schema instead of blocking it.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB open is blocked by another tab'));
  });
}

export function readFrame(db: IDBDatabase, key: string): Promise<unknown> {
  const tx = db.transaction(STORE, 'readonly');
  return requestToPromise(tx.objectStore(STORE).get(key));
}

export async function writeFrame(db: IDBDatabase, frame: Frame): Promise<void> {
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(frame);
  await transactionDone(tx);
}

export async function clearFrameStore(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await transactionDone(tx);
}

/**
 * Deletes every frame the current policy would refuse to show, then keeps only the
 * newest `maxFrames`. Returns the number of deleted frames.
 */
export async function pruneFrames(
  db: IDBDatabase,
  policy: ResolvedPolicy | null,
  scope: string | null,
  now = Date.now(),
): Promise<number> {
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const kept: Array<{ key: IDBValidKey; capturedAt: number }> = [];
  let deleted = 0;

  await new Promise<void>((resolve, reject) => {
    const cursorRequest = store.openCursor();
    cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('Frame scan failed'));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) {
        resolve();
        return;
      }
      const value = cursor.value as Partial<Frame> | undefined;
      const route = policy && typeof value?.route === 'string' ? value.route : null;
      const rule = route ? matchRoute(policy, route) : null;
      const usable =
        policy !== null &&
        rule !== null &&
        isFrameUsable(value, {
          policy,
          route: rule,
          key: cursor.primaryKey as string,
          scope,
          maskSignature: maskSignature(rule.mask),
          now,
        });
      if (usable) {
        kept.push({ key: cursor.primaryKey, capturedAt: value.capturedAt });
      } else {
        cursor.delete();
        deleted += 1;
      }
      cursor.continue();
    };
  });

  if (policy && kept.length > policy.maxFrames) {
    kept.sort((a, b) => b.capturedAt - a.capturedAt);
    for (const { key } of kept.slice(policy.maxFrames)) {
      store.delete(key);
      deleted += 1;
    }
  }

  await transactionDone(tx);
  return deleted;
}

export function deleteLegacyDatabase(): void {
  try {
    indexedDB.deleteDatabase(LEGACY_DB_NAME);
  } catch {}
}
