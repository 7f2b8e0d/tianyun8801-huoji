import type { ChartPoint, DateRange, GoodsEntry, PeriodType } from '../types'

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

export function periodRange(type: PeriodType, now = Date.now()): DateRange {
  const cal = new Date(now)
  switch (type) {
    case 'DAY': {
      const start = startOfDay(cal).getTime()
      const endCal = startOfDay(cal)
      endCal.setDate(endCal.getDate() + 1)
      return { start, end: endCal.getTime() - 1 }
    }
    case 'WEEK': {
      // Monday-start week (matches Android Calendar.MONDAY)
      const day = cal.getDay() // 0=Sun ... 6=Sat
      const diffToMonday = day === 0 ? -6 : 1 - day
      const monday = startOfDay(cal)
      monday.setDate(monday.getDate() + diffToMonday)
      const start = monday.getTime()
      const endCal = new Date(monday)
      endCal.setDate(endCal.getDate() + 7)
      return { start, end: endCal.getTime() - 1 }
    }
    case 'MONTH': {
      const start = new Date(cal.getFullYear(), cal.getMonth(), 1).getTime()
      const endCal = new Date(cal.getFullYear(), cal.getMonth() + 1, 1)
      return { start, end: endCal.getTime() - 1 }
    }
    case 'YEAR': {
      const start = new Date(cal.getFullYear(), 0, 1).getTime()
      const endCal = new Date(cal.getFullYear() + 1, 0, 1)
      return { start, end: endCal.getTime() - 1 }
    }
    case 'CUSTOM':
      return { start: 0, end: Number.MAX_SAFE_INTEGER }
  }
}

export function aggregateEntries(
  entries: GoodsEntry[],
  period: PeriodType
): ChartPoint[] {
  if (entries.length === 0) return []
  const groups = new Map<string, GoodsEntry[]>()
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const pad = (n: number) => String(n).padStart(2, '0')

  for (const entry of entries) {
    const d = new Date(entry.createdAt)
    let key: string
    switch (period) {
      case 'DAY':
        key = `${pad(d.getHours())}:00`
        break
      case 'WEEK':
        key = `周${weekDays[d.getDay()]}`
        break
      case 'MONTH':
        key = `${d.getDate()}日`
        break
      case 'YEAR':
        key = `${d.getMonth() + 1}月`
        break
      case 'CUSTOM':
        key = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
        break
    }
    const list = groups.get(key)
    if (list) list.push(entry)
    else groups.set(key, [entry])
  }

  return Array.from(groups.entries()).map(([label, list]) => ({
    label,
    amount: list.reduce((s, e) => s + e.totalAmount, 0),
    quantity: list.reduce((s, e) => s + e.quantity, 0),
    count: list.length,
  }))
}
