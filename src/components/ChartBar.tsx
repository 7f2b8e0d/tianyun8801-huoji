import type { ChartPoint } from '../types'

export function ChartBar({ points }: { points: ChartPoint[] }) {
  if (points.length === 0) return null
  const max = Math.max(...points.map((p) => p.amount), 1)

  return (
    <div className="chart-bar" aria-label="金额趋势图">
      {points.map((point) => {
        const h = (point.amount / max) * 100
        return (
          <div key={point.label} className="chart-bar__col">
            <div className="chart-bar__track">
              <div
                className="chart-bar__fill"
                style={{ height: `${Math.max(h, 2)}%` }}
                title={`¥${point.amount}`}
              />
            </div>
            <span className="chart-bar__label">{point.label}</span>
          </div>
        )
      })}
    </div>
  )
}
