import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { GoodsEntry } from './types'

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

export async function getAllEntries(): Promise<GoodsEntry[]> {
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
  const db = await getDb()
  const id = await nextId()
  await db.put('entries', { ...entry, id })
  return id
}

export async function updateEntry(entry: GoodsEntry): Promise<void> {
  const db = await getDb()
  await db.put('entries', entry)
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb()
  const entry = await db.get('entries', id)
  if (entry) {
    const keys = entry.imageKeys.split('|').filter(Boolean)
    await Promise.all(keys.map((k) => db.delete('images', k)))
  }
  await db.delete('entries', id)
}

export async function saveImageBlob(blob: Blob): Promise<string> {
  const db = await getDb()
  const key = `img_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  await db.put('images', { key, blob })
  return key
}

export async function getImageBlob(key: string): Promise<Blob | undefined> {
  const db = await getDb()
  return (await db.get('images', key))?.blob
}

export async function deleteImage(key: string): Promise<void> {
  const db = await getDb()
  await db.delete('images', key)
}
