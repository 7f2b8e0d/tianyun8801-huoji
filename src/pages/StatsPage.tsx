import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChartBar } from '../components/ChartBar'
import { IconBack, IconDownload } from '../components/Icons'
import type { GoodsEntry, PeriodType, StatsUi } from '../types'
import { downloadBlob, exportExcel } from '../utils/excel'
import { fmt } from '../utils/format'
import { periodRange } from '../utils/period'

const PERIODS: { type: PeriodType; label: string }[] = [
  { type: 'DAY', label: '日' },
  { type: 'WEEK', label: '周' },
  { type: 'MONTH', label: '月' },
  { type: 'YEAR', label: '年' },
  { type: 'CUSTOM', label: '自定义' },
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toDateInput(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function rangeFromInputs(startVal: string, endVal: string) {
  const start = new Date(`${startVal}T00:00:00`).getTime()
  const end = new Date(`${endVal}T23:59:59`).getTime()
  return { start, end }
}

export function StatsPage({
  stats,
  entries,
  onPeriod,
  onCustomRange,
}: {
  stats: StatsUi
  entries: GoodsEntry[]
  onPeriod: (p: PeriodType) => void
  onCustomRange: (start: number, end: number) => void
}) {
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportStart, setExportStart] = useState('')
  const [exportEnd, setExportEnd] = useState('')
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const [pickingCustom, setPickingCustom] = useState(false)

  const handlePeriodClick = (type: PeriodType) => {
    if (type === 'CUSTOM') {
      setPickingCustom(true)
      requestAnimationFrame(() => startRef.current?.showPicker?.())
      return
    }
    setPickingCustom(false)
    onPeriod(type)
  }

  const applyCustom = () => {
    const startVal = startRef.current?.value
    const endVal = endRef.current?.value
    if (!startVal || !endVal) return
    const { start, end } = rangeFromInputs(startVal, endVal)
    onCustomRange(start, end)
    setPickingCustom(false)
  }

  const openExportDialog = () => {
    const range =
      stats.period === 'CUSTOM' && stats.customRange
        ? stats.customRange
        : periodRange(stats.period)
    setExportStart(toDateInput(range.start))
    setExportEnd(toDateInput(Math.min(range.end, Date.now())))
    setExportOpen(true)
  }

  const exportCount = useMemo(() => {
    if (!exportStart || !exportEnd) return 0
    const { start, end } = rangeFromInputs(exportStart, exportEnd)
    if (Number.isNaN(start) || Number.isNaN(end) || start > end) return 0
    return entries.filter((e) => e.createdAt >= start && e.createdAt <= end).length
  }, [entries, exportStart, exportEnd])

  const handleExport = async () => {
    if (!exportStart || !exportEnd) return
    const { start, end } = rangeFromInputs(exportStart, exportEnd)
    if (Number.isNaN(start) || Number.isNaN(end) || start > end) return
    setExporting(true)
    try {
      const filtered = entries.filter((e) => e.createdAt >= start && e.createdAt <= end)
      const blob = await exportExcel(filtered)
      const stamp = new Date()
      const name = `goods_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.xlsx`
      downloadBlob(blob, name)
      setExportOpen(false)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <IconBack />
        </button>
        <h1 className="topbar__title-single">统计与导出</h1>
      </header>

      <div className="content form">
        <div className="chips">
          {PERIODS.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className={`chip ${stats.period === type ? 'chip--active' : ''}`}
              onClick={() => handlePeriodClick(type)}
            >
              {label}
            </button>
          ))}
        </div>

        {(pickingCustom || stats.period === 'CUSTOM') && (
          <div className="custom-range">
            <label>
              开始
              <input ref={startRef} type="date" />
            </label>
            <label>
              结束
              <input ref={endRef} type="date" onChange={applyCustom} />
            </label>
            <button type="button" className="text-btn" onClick={applyCustom}>
              应用
            </button>
          </div>
        )}

        <div className="stat-row">
          <StatCard label="合计金额" value={`¥ ${fmt(stats.totalAmount)}`} />
          <StatCard label="合计数量" value={fmt(stats.totalQty)} />
        </div>
        <StatCard label="记录数" value={`${stats.filtered.length} 条`} wide />

        <div className="chart-card">
          <div className="chart-card__title">金额趋势</div>
          {stats.points.length === 0 ? (
            <p className="chart-card__empty">当前范围暂无数据</p>
          ) : (
            <ChartBar points={stats.points} />
          )}
        </div>

        <button
          type="button"
          className="primary-btn primary-btn--with-icon"
          onClick={openExportDialog}
        >
          <IconDownload size={20} />
          下载 Excel
        </button>
      </div>

      {exportOpen ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setExportOpen(false)}>
          <div
            className="dialog"
            role="dialog"
            aria-labelledby="export-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="export-title">选择导出时间范围</h2>
            <p>将导出该时间段内的记录（图片保持原清晰度）。</p>
            <div className="custom-range" style={{ marginTop: 14 }}>
              <label>
                开始日期
                <input
                  type="date"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                />
              </label>
              <label>
                结束日期
                <input
                  type="date"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                />
              </label>
            </div>
            <p style={{ marginTop: 12 }}>将导出 {exportCount} 条记录</p>
            <div className="dialog__actions">
              <button type="button" className="text-btn" onClick={() => setExportOpen(false)}>
                取消
              </button>
              <button
                type="button"
                className="text-btn"
                disabled={exporting || exportCount === 0 || !exportStart || !exportEnd}
                onClick={() => void handleExport()}
              >
                {exporting ? '导出中…' : '确认导出'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StatCard({
  label,
  value,
  wide,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={`stat-card ${wide ? 'stat-card--wide' : ''}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
    </div>
  )
}
