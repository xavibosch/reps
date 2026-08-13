/**
 * GIFs live in IndexedDB as Blobs, not in localStorage.
 *
 * localStorage caps out around 5MB and only holds strings, so a handful of
 * base64 GIFs would blow it up. IndexedDB stores the Blob directly, has no
 * practical size ceiling here, and costs nothing: the whole app stays local.
 */

const DB_NAME = 'home-gym'
const DB_VERSION = 1
const STORE = 'media'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const putMedia = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id))
export const getMedia = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id))
export const delMedia = (id: string) => tx('readwrite', (s) => s.delete(id))
