/**
 * Tiny IndexedDB helper. Used for the offline download library (including the
 * actual video bytes) plus watch history / watchlist.
 */
const DB_NAME = 'cinejoy'
const DB_VERSION = 1

export type StoreName = 'blobs' | 'downloads' | 'history' | 'watchlist'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
      if (!db.objectStoreNames.contains('downloads')) db.createObjectStore('downloads', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'mediaId' })
      if (!db.objectStoreNames.contains('watchlist')) db.createObjectStore('watchlist', { keyPath: 'titleId' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'))
  })
  return dbPromise
}

export async function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function idbPut(store: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    const req = key === undefined ? os.put(value) : os.put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function idbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function idbAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve((req.result ?? []) as T[])
    req.onerror = () => reject(req.error)
  })
}

export async function idbClear(store: StoreName): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Rough storage figures for the Downloads screen header. */
export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
    }
  } catch {
    /* ignore */
  }
  return { usage: 0, quota: 0 }
}
