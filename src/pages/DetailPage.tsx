import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconBack, IconDelete, IconEdit } from '../components/Icons'
import { ImageLightbox } from '../components/ImageLightbox'
import { useImageUrls } from '../hooks/useImageUrl'
import type { GoodsEntry } from '../types'
import { fmt, formatTime } from '../utils/format'

export function DetailPage({
  entries,
  onDelete,
}: {
  entries: GoodsEntry[]
  onDelete: (id: number) => Promise<void>
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const entry = useMemo(
    () => entries.find((e) => e.id === Number(id)),
    [entries, id]
  )
  const imageKeys = useMemo(
    () => entry?.imageKeys.split('|').filter(Boolean) ?? [],
    [entry]
  )
  const urls = useImageUrls(imageKeys)
  const lightboxUrls = useMemo(
    () => urls.filter((u): u is string => Boolean(u)),
    [urls]
  )

  if (!entry) {
    return (
      <div className="page">
        <header className="topbar">
          <button type="button" className="icon-btn" onClick={() => navigate('/')} aria-label="返回">
            <IconBack />
          </button>
          <h1 className="topbar__title-single">记录详情</h1>
        </header>
        <p className="content" style={{ paddingTop: 24 }}>
          记录不存在
        </p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <IconBack />
        </button>
        <h1 className="topbar__title-single">记录详情</h1>
        <div className="topbar__actions">
          <Link to={`/edit/${entry.id}`} className="icon-btn" aria-label="编辑">
            <IconEdit />
          </Link>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setConfirm(true)}
            aria-label="删除"
          >
            <IconDelete />
          </button>
        </div>
      </header>

      <div className="content form">
        {lightboxUrls.length > 0 ? (
          <div className="detail-photos">
            {lightboxUrls.map((url, i) => (
              <button
                key={imageKeys[i] ?? url}
                type="button"
                className="detail-photos__btn"
                onClick={() => setViewerIndex(i)}
                aria-label={`查看图片 ${i + 1}`}
              >
                <img src={url} alt="" className="detail-photos__img" />
              </button>
            ))}
          </div>
        ) : null}

        <InfoBlock label="货号" value={entry.productCode} />
        <div className="field-row">
          <InfoBlock label="单价" value={`¥ ${fmt(entry.unitPrice)}`} />
          <InfoBlock label="数量" value={fmt(entry.quantity)} />
        </div>
        <InfoBlock label="合计" value={`¥ ${fmt(entry.totalAmount)}`} />
        <InfoBlock label="时间" value={formatTime(entry.createdAt, 'detail')} />
        {entry.note.trim() ? <InfoBlock label="备注" value={entry.note} /> : null}
      </div>

      {confirm ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setConfirm(false)}>
          <div
            className="dialog"
            role="alertdialog"
            aria-labelledby="del-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="del-title">删除记录</h2>
            <p>确定删除这条货记吗？此操作不可恢复。</p>
            <div className="dialog__actions">
              <button type="button" className="text-btn" onClick={() => setConfirm(false)}>
                取消
              </button>
              <button
                type="button"
                className="text-btn text-btn--danger"
                onClick={() => {
                  void onDelete(entry.id).then(() => navigate('/'))
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewerIndex != null ? (
        <ImageLightbox
          urls={lightboxUrls}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      ) : null}
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-block">
      <div className="info-block__label">{label}</div>
      <div className="info-block__value">{value}</div>
    </div>
  )
}
