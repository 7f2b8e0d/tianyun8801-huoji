export interface GoodsEntry {
  id: number
  productCode: string
  unitPrice: number
  quantity: number
  totalAmount: number
  /** Pipe-separated image keys stored in IndexedDB */
  imageKeys: string
  note: string
  createdAt: number
}

export type PeriodType = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'

export interface DateRange {
  start: number
  end: number
}

export interface ChartPoint {
  label: string
  amount: number
  quantity: number
  count: number
}

export interface StatsUi {
  period: PeriodType
  customRange: DateRange | null
  points: ChartPoint[]
  filtered: GoodsEntry[]
  totalAmount: number
  totalQty: number
}
