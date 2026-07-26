import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconBack, IconCamera, IconClose } from '../components/Icons'
import { useImageUrl } from '../hooks/useImageUrl'
import { fmt } from '../utils/format'
import type { GoodsEntry } from '../types'

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
}: {
  imageKey: string
  onRemove: () => void
}) {
  const url = useImageUrl(imageKey)
  return (
    <div className="photo-thumb">
      {url ? <img src={url} alt="" /> : null}
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
  const fileRef = useRef<HTMLInputElement>(null)

  const priceV = Number(price) || 0
  const qtyV = Number(qty) || 0
  const total = priceV * qtyV

  const onTakePhoto = () => {
    fileRef.current?.click()
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('需要相机权限才能拍照')
      return
    }
    const preview = URL.createObjectURL(file)
    setNewImages((prev) => [
      ...prev,
      { id: `${Date.now()}_${Math.random()}`, blob: file, preview },
    ])
    setError(null)
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
        <div className="section-label">拍照</div>
        <div className="photo-row">
          <button type="button" className="photo-camera" onClick={onTakePhoto} aria-label="拍照">
            <IconCamera />
          </button>
          {keepKeys.map((key) => (
            <KeepThumb
              key={key}
              imageKey={key}
              onRemove={() => setKeepKeys((prev) => prev.filter((k) => k !== key))}
            />
          ))}
          {newImages.map((img) => (
            <div key={img.id} className="photo-thumb">
              <img src={img.preview} alt="" />
              <button
                type="button"
                className="photo-thumb__remove"
                onClick={() => {
                  URL.revokeObjectURL(img.preview)
                  setNewImages((prev) => prev.filter((i) => i.id !== img.id))
                }}
                aria-label="移除"
              >
                <IconClose />
              </button>
            </div>
          ))}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
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
    </div>
  )
}
