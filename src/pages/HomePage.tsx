import { Link } from 'react-router-dom'
import { IconAdd, IconChart, IconImage } from '../components/Icons'
import { useImageUrl } from '../hooks/useImageUrl'
import type { GoodsEntry } from '../types'
import { fmt, formatTime } from '../utils/format'

function EntryRow({ entry }: { entry: GoodsEntry }) {
  const firstKey = entry.imageKeys.split('|').find(Boolean)
  const thumb = useImageUrl(firstKey)
  return (
    <Link to={`/detail/${entry.id}`} className="entry-row">
      <div className="entry-row__thumb">
        {thumb ? <img src={thumb} alt="" /> : <IconImage size={28} />}
      </div>
      <div className="entry-row__body">
        <div className="entry-row__code">{entry.productCode || '未填货号'}</div>
        <div className="entry-row__meta">
          单价 {fmt(entry.unitPrice)} · 数量 {fmt(entry.quantity)}
        </div>
        <div className="entry-row__meta">{formatTime(entry.createdAt, 'list')}</div>
      </div>
      <div className="entry-row__amount">¥{fmt(entry.totalAmount)}</div>
    </Link>
  )
}

export function HomePage({ entries }: { entries: GoodsEntry[] }) {
  const total = entries.reduce((s, e) => s + e.totalAmount, 0)

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1 className="topbar__title">货记</h1>
          <p className="topbar__sub">简洁记录 · 清晰统计</p>
        </div>
        <Link to="/stats" className="icon-btn" aria-label="统计">
          <IconChart />
        </Link>
      </header>

      <div className="content">
        <div className="banner">
          <div className="banner__label">全部合计</div>
          <div className="banner__total">¥ {fmt(total)}</div>
          <div className="banner__count">{entries.length} 条记录</div>
        </div>

        {entries.length === 0 ? (
          <div className="empty">
            <IconImage size={48} />
            <div className="empty__title">还没有记录</div>
            <div className="empty__sub">点右下角添加第一笔货记</div>
          </div>
        ) : (
          <div className="entry-list">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      <Link to="/entry" className="fab" aria-label="新增">
        <IconAdd />
      </Link>
    </div>
  )
}
