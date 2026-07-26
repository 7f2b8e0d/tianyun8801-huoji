export function fmt(value: number): string {
  if (value % 1 === 0) return String(Math.trunc(value))
  return value.toFixed(2)
}

export function formatTime(ms: number, pattern: 'list' | 'detail'): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const h = pad(d.getHours())
  const min = pad(d.getMinutes())
  if (pattern === 'list') return `${m}/${day} ${h}:${min}`
  return `${y}-${m}-${day} ${h}:${min}`
}
