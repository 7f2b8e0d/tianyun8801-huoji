import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteEntry as dbDelete,
  getAllEntries,
  getEntry,
  insertEntry,
  saveImageBlob,
  updateEntry,
} from '../db'
import type { DateRange, GoodsEntry, PeriodType, StatsUi } from '../types'
import { aggregateEntries, periodRange } from '../utils/period'

export function useGoods() {
  const [entries, setEntries] = useState<GoodsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodType>('MONTH')
  const [customRange, setCustomRange] = useState<DateRange | null>(null)

  const refresh = useCallback(async () => {
    const list = await getAllEntries()
    setEntries(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const stats: StatsUi = useMemo(() => {
    const range =
      period === 'CUSTOM'
        ? (customRange ?? { start: 0, end: Number.MAX_SAFE_INTEGER })
        : periodRange(period)
    const filtered = entries.filter(
      (e) => e.createdAt >= range.start && e.createdAt <= range.end
    )
    return {
      period,
      customRange,
      points: aggregateEntries(filtered, period),
      filtered,
      totalAmount: filtered.reduce((s, e) => s + e.totalAmount, 0),
      totalQty: filtered.reduce((s, e) => s + e.quantity, 0),
    }
  }, [entries, period, customRange])

  const saveEntry = useCallback(
    async (params: {
      productCode: string
      unitPrice: number
      quantity: number
      note: string
      newBlobs: Blob[]
      keepKeys: string[]
      entryId?: number
    }) => {
      const newKeys = await Promise.all(params.newBlobs.map((b) => saveImageBlob(b)))
      const imageKeys = [...params.keepKeys, ...newKeys].join('|')
      const total = params.unitPrice * params.quantity
      if (params.entryId == null) {
        await insertEntry({
          productCode: params.productCode.trim(),
          unitPrice: params.unitPrice,
          quantity: params.quantity,
          totalAmount: total,
          imageKeys,
          note: params.note.trim(),
          createdAt: Date.now(),
        })
      } else {
        const current = await getEntry(params.entryId)
        await updateEntry({
          id: params.entryId,
          productCode: params.productCode.trim(),
          unitPrice: params.unitPrice,
          quantity: params.quantity,
          totalAmount: total,
          imageKeys,
          note: params.note.trim(),
          createdAt: current?.createdAt ?? Date.now(),
        })
      }
      await refresh()
    },
    [refresh]
  )

  const removeEntry = useCallback(
    async (id: number) => {
      await dbDelete(id)
      await refresh()
    },
    [refresh]
  )

  const setCustom = useCallback((start: number, end: number) => {
    setCustomRange({ start, end })
    setPeriod('CUSTOM')
  }, [])

  return {
    entries,
    loading,
    stats,
    setPeriod,
    setCustom,
    saveEntry,
    removeEntry,
    refresh,
  }
}
