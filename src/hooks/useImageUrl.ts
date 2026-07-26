import { useEffect, useState } from 'react'
import { getImageBlob } from '../db'

const urlCache = new Map<string, string>()

export function useImageUrl(key: string | undefined | null): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    key ? (urlCache.get(key) ?? null) : null
  )

  useEffect(() => {
    if (!key) {
      setUrl(null)
      return
    }
    const cached = urlCache.get(key)
    if (cached) {
      setUrl(cached)
      return
    }
    let cancelled = false
    void getImageBlob(key).then((blob) => {
      if (cancelled || !blob) return
      const objectUrl = URL.createObjectURL(blob)
      urlCache.set(key, objectUrl)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
    }
  }, [key])

  return url
}

export function useImageUrls(keys: string[]): (string | null)[] {
  const [urls, setUrls] = useState<(string | null)[]>(() =>
    keys.map((k) => urlCache.get(k) ?? null)
  )

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      keys.map(async (key) => {
        const cached = urlCache.get(key)
        if (cached) return cached
        const blob = await getImageBlob(key)
        if (!blob) return null
        const objectUrl = URL.createObjectURL(blob)
        urlCache.set(key, objectUrl)
        return objectUrl
      })
    ).then((result) => {
      if (!cancelled) setUrls(result)
    })
    return () => {
      cancelled = true
    }
  }, [keys.join('|')])

  return urls
}
