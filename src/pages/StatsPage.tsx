import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChartBar } from '../components/ChartBar'
import { IconBack, IconDownload } from '../components/Icons'
import type { PeriodType, StatsUi } from '../types'
import { downloadBlob, exportExcel } from '../utils/excel'
import { fmt } from '../utils/format'

const PERIODS: { type: PeriodType; label: string }[] = [
  { type: 'DAY', label: '日' },
  { type: 'WEEK', label: '周' },
  { type: 'MONTH', label: '月' },
  { type: 'YEAR', label: '年' },
  { type: 'CUSTOM', label: '自定义' },
]

export function StatsPage({
  stats,
  onPeriod,
  onCustomRange,
}: {
  stats: StatsUi
  onPeriod: (p: PeriodType) => void
  onCustomRange: (start: number, end: number) => void
}) {
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const [pickingCustom, setPickingCustom] = useState(false)

  const handlePeriodClick = (type: PeriodType) => {
    if (type === 'CUSTOM') {
      setPickingCustom(true)
      // Delay so the date inputs mount, then open start picker
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
    const start = new Date(`${startVal}T00:00:00`).getTime()
    const end = new Date(`${endVal}T23:59:59`).getTime()
    onCustomRange(start, end)
    setPickingCustom(false)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportExcel(stats.filtered)
      const stamp = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const name = `goods_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.xlsx`
      downloadBlob(blob, name)
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
          disabled={exporting}
          onClick={() => void handleExport()}
        >
          <IconDownload size={20} />
          下载 Excel
        </button>
      </div>
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
