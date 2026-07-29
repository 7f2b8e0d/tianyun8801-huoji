/** Ask the browser to keep site data (IndexedDB) instead of evicting under storage pressure. */
export async function ensurePersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist()
    }
  } catch {
    // ignore — best-effort
  }
}
