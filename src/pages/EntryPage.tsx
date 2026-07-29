import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconBack, IconCamera, IconClose, IconGallery } from '../components/Icons'
import { ImageLightbox } from '../components/ImageLightbox'
import { PhotoStrip, type PhotoStripHandle } from '../components/PhotoStrip'
import { useImageUrl, useImageUrls } from '../hooks/useImageUrl'
import { fmt } from '../utils/format'
import type { GoodsEntry } from '../types'

function isLikelyImageFile(file: File): boolean {
  // Many mobile cameras return an empty MIME type after capture.
  if (!file.type) return true
  return file.type.startsWith('image/')
}

type Props = {
  entries: GoodsEntry[]
  onSave: (params: {
    productCode: string
    unitPrice: number
    quantity: number
    note: string
    newBlobs: Blob[]
    keepKeys: string[]
    entryId?: number
  }) => Promise<void>
}

type NewImage = { id: string; blob: Blob; preview: string }

function KeepThumb({
  imageKey,
  onRemove,
  onOpen,
}: {
  imageKey: string
  onRemove: () => void
  onOpen: () => void
}) {
  const url = useImageUrl(imageKey)
  return (
    <div className="photo-thumb">
      {url ? (
        <button type="button" className="photo-thumb__open" onClick={onOpen} aria-label="查看图片">
          <img src={url} alt="" />
        </button>
      ) : null}
      <button type="button" className="photo-thumb__remove" onClick={onRemove} aria-label="移除">
        <IconClose />
      </button>
    </div>
  )
}

export function EntryPage({ entries, onSave }: Props) {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const existing = useMemo(
    () => (id ? entries.find((e) => e.id === Number(id)) : undefined),
    [entries, id]
  )

  const [code, setCode] = useState(existing?.productCode ?? '')
  const [price, setPrice] = useState(
    existing ? String(existing.unitPrice) : ''
  )
  const [qty, setQty] = useState(existing ? String(existing.quantity) : '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [keepKeys, setKeepKeys] = useState(
    () => existing?.imageKeys.split('|').filter(Boolean) ?? []
  )
  const [newImages, setNewImages] = useState<NewImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const stripRef = useRef<PhotoStripHandle>(null)

  const keepUrls = useImageUrls(keepKeys)
  const lightboxUrls = useMemo(
    () =>
      [...keepUrls.map((u) => u ?? ''), ...newImages.map((i) => i.preview)].filter(
        Boolean
      ),
    [keepUrls, newImages]
  )

  const priceV = Number(price) || 0
  const qtyV = Number(qty) || 0
  const total = priceV * qtyV
  const photoCount = keepKeys.length + newImages.length

  useEffect(() => {
    if (photoCount > 0) {
      // Wait a frame so new thumbs are laid out, then reveal them.
      requestAnimationFrame(() => stripRef.current?.scrollToEnd())
    }
  }, [photoCount])

  const addFiles = (files: File[]) => {
    if (!files.length) return
    const next: NewImage[] = []
    files.forEach((file) => {
      if (!isLikelyImageFile(file)) return
      next.push({
        id: `${Date.now()}_${Math.random()}`,
        blob: file,
        preview: URL.createObjectURL(file),
      })
    })
    if (next.length === 0) {
      setError('请选择图片文件')
      return
    }
    setNewImages((prev) => [...prev, ...next])
    setError(null)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    // Copy File references before clearing the input (required on some mobiles).
    const copied = input.files ? Array.from(input.files) : []
    input.value = ''
    addFiles(copied)
  }

  const handleSave = async () => {
    if (!code.trim()) {
      setError('请填写货号')
      return
    }
    if (priceV <= 0 || qtyV <= 0) {
      setError('请填写有效的单价和数量')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave({
        productCode: code,
        unitPrice: priceV,
        quantity: qtyV,
        note,
        newBlobs: newImages.map((i) => i.blob),
        keepKeys,
        entryId: isEdit ? Number(id) : undefined,
      })
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && !existing && entries.length > 0) {
    return (
      <div className="page">
        <header className="topbar">
          <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
            <IconBack />
          </button>
          <h1 className="topbar__title-single">记录不存在</h1>
        </header>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <IconBack />
        </button>
        <h1 className="topbar__title-single">{isEdit ? '编辑记录' : '新建货记'}</h1>
      </header>

      <div className="content form">
        <div className="section-label">图片</div>
        <PhotoStrip ref={stripRef}>
          <button
            type="button"
            className="photo-camera"
            onClick={() => cameraRef.current?.click()}
            aria-label="拍照"
          >
            <IconCamera />
            <span className="photo-camera__label">拍照</span>
          </button>
          <button
            type="button"
            className="photo-camera"
            onClick={() => galleryRef.current?.click()}
            aria-label="相册"
          >
            <IconGallery />
            <span className="photo-camera__label">相册</span>
          </button>
          {keepKeys.map((key, i) => (
            <KeepThumb
              key={key}
              imageKey={key}
              onOpen={() => setViewerIndex(i)}
              onRemove={() => setKeepKeys((prev) => prev.filter((k) => k !== key))}
            />
          ))}
          {newImages.map((img, i) => (
            <div key={img.id} className="photo-thumb">
              <button
                type="button"
                className="photo-thumb__open"
                onClick={() => setViewerIndex(keepKeys.length + i)}
                aria-label="查看图片"
              >
                <img src={img.preview} alt="" />
              </button>
              <button
                type="button"
                className="photo-thumb__remove"
                onClick={() => {
                  URL.revokeObjectURL(img.preview)
                  setNewImages((prev) => prev.filter((item) => item.id !== img.id))
                }}
                aria-label="移除"
              >
                <IconClose />
              </button>
            </div>
          ))}
        </PhotoStrip>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onFileChange}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={onFileChange}
        />

        <label className="field">
          <span>货号</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="货号"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>单价</span>
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) =>
                setPrice(e.target.value.replace(/[^\d.]/g, ''))
              }
              placeholder="单价"
            />
          </label>
          <label className="field">
            <span>数量</span>
            <input
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="数量"
            />
          </label>
        </div>

        <div className="total-box">
          <span>合计</span>
          <strong>¥ {fmt(total)}</strong>
        </div>

        <label className="field">
          <span>备注（可选）</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="备注（可选）"
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button
          type="button"
          className="primary-btn"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {isEdit ? '保存修改' : '保存记录'}
        </button>
      </div>

      {viewerIndex != null && lightboxUrls.length > 0 ? (
        <ImageLightbox
          urls={lightboxUrls}
          index={Math.min(viewerIndex, lightboxUrls.length - 1)}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      ) : null}
    </div>
  )
}
