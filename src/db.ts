import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { GoodsEntry } from './types'
import { ensurePersistentStorage } from './utils/persist'

interface LedgerDB extends DBSchema {
  entries: {
    key: number
    value: GoodsEntry
    indexes: { 'by-createdAt': number }
  }
  images: {
    key: string
    value: { key: string; blob: Blob }
  }
  meta: {
    key: string
    value: { key: string; value: number }
  }
}

const DB_NAME = 'goods_ledger'
const DB_VERSION = 1
const ENTRIES_BACKUP_KEY = 'goods_ledger_entries_v1'
const IMAGE_CACHE = 'goods-ledger-images-v1'

let dbPromise: Promise<IDBPDatabase<LedgerDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<LedgerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const entries = db.createObjectStore('entries', {
          keyPath: 'id',
          autoIncrement: true,
        })
        entries.createIndex('by-createdAt', 'createdAt')
        db.createObjectStore('images', { keyPath: 'key' })
        db.createObjectStore('meta', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

async function nextId(): Promise<number> {
  const db = await getDb()
  const current = (await db.get('meta', 'nextId'))?.value ?? 1
  await db.put('meta', { key: 'nextId', value: current + 1 })
  return current
}

async function mirrorImageToCache(key: string, blob: Blob): Promise<void> {
  try {
    if (!('caches' in globalThis)) return
    const cache = await caches.open(IMAGE_CACHE)
    await cache.put(`/__ledger_img__/${encodeURIComponent(key)}`, new Response(blob))
  } catch {
    // best-effort
  }
}

async function readImageFromCache(key: string): Promise<Blob | undefined> {
  try {
    if (!('caches' in globalThis)) return undefined
    const cache = await caches.open(IMAGE_CACHE)
    const res = await cache.match(`/__ledger_img__/${encodeURIComponent(key)}`)
    return res ? await res.blob() : undefined
  } catch {
    return undefined
  }
}

async function deleteImageFromCache(key: string): Promise<void> {
  try {
    if (!('caches' in globalThis)) return
    const cache = await caches.open(IMAGE_CACHE)
    await cache.delete(`/__ledger_img__/${encodeURIComponent(key)}`)
  } catch {
    // ignore
  }
}

async function backupEntries(entries: GoodsEntry[]): Promise<void> {
  try {
    localStorage.setItem(
      ENTRIES_BACKUP_KEY,
      JSON.stringify({ v: 1, savedAt: Date.now(), entries })
    )
  } catch {
    // quota / private mode
  }
}

function readEntriesBackup(): GoodsEntry[] | null {
  try {
    const raw = localStorage.getItem(ENTRIES_BACKUP_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { entries?: GoodsEntry[] }
    if (!Array.isArray(parsed.entries)) return null
    return parsed.entries
  } catch {
    return null
  }
}

/** Restore from localStorage + Cache API if IndexedDB was wiped by the browser. */
async function restoreFromBackupIfEmpty(): Promise<void> {
  const db = await getDb()
  const existing = await db.getAll('entries')
  if (existing.length > 0) return

  const backup = readEntriesBackup()
  if (!backup || backup.length === 0) return

  let maxId = 0
  for (const entry of backup) {
    maxId = Math.max(maxId, entry.id)
    await db.put('entries', entry)
    const keys = entry.imageKeys.split('|').filter(Boolean)
    for (const key of keys) {
      const cached = await readImageFromCache(key)
      if (cached) {
        await db.put('images', { key, blob: cached })
      }
    }
  }
  const meta = await db.get('meta', 'nextId')
  const next = Math.max(meta?.value ?? 1, maxId + 1)
  await db.put('meta', { key: 'nextId', value: next })
}

async function snapshotBackup(): Promise<void> {
  const db = await getDb()
  const all = await db.getAll('entries')
  await backupEntries(all)
}

export async function initDb(): Promise<void> {
  await ensurePersistentStorage()
  await getDb()
  await restoreFromBackupIfEmpty()
}

export async function getAllEntries(): Promise<GoodsEntry[]> {
  await initDb()
  const db = await getDb()
  const all = await db.getAll('entries')
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getEntry(id: number): Promise<GoodsEntry | undefined> {
  const db = await getDb()
  return db.get('entries', id)
}

export async function insertEntry(
  entry: Omit<GoodsEntry, 'id'>
): Promise<number> {
  await ensurePersistentStorage()
  const db = await getDb()
  const id = await nextId()
  await db.put('entries', { ...entry, id })
  await snapshotBackup()
  return id
}

export async function updateEntry(entry: GoodsEntry): Promise<void> {
  await ensurePersistentStorage()
  const db = await getDb()
  await db.put('entries', entry)
  await snapshotBackup()
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb()
  const entry = await db.get('entries', id)
  if (entry) {
    const keys = entry.imageKeys.split('|').filter(Boolean)
    await Promise.all(
      keys.map(async (k) => {
        await db.delete('images', k)
        await deleteImageFromCache(k)
      })
    )
  }
  await db.delete('entries', id)
  await snapshotBackup()
}

export async function saveImageBlob(blob: Blob): Promise<string> {
  await ensurePersistentStorage()
  const db = await getDb()
  const key = `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  await db.put('images', { key, blob })
  await mirrorImageToCache(key, blob)
  return key
}

export async function getImageBlob(key: string): Promise<Blob | undefined> {
  const db = await getDb()
  const fromDb = (await db.get('images', key))?.blob
  if (fromDb) return fromDb
  const fromCache = await readImageFromCache(key)
  if (fromCache) {
    await db.put('images', { key, blob: fromCache })
    return fromCache
  }
  return undefined
}

export async function deleteImage(key: string): Promise<void> {
  const db = await getDb()
  await db.delete('images', key)
  await deleteImageFromCache(key)
}
