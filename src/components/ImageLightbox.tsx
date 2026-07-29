import { useCallback, useEffect, useRef, useState } from 'react'
import { IconClose } from './Icons'

type Props = {
  urls: string[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

type Transform = { scale: number; x: number; y: number }

const MIN_SCALE = 1
const MAX_SCALE = 8

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function ImageLightbox({ urls, index, onClose, onIndexChange }: Props) {
  const url = urls[index]
  const stageRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef(transform)
  transformRef.current = transform

  const pinchRef = useRef<{
    dist: number
    scale: number
    x: number
    y: number
    focalX: number
    focalY: number
  } | null>(null)
  const panRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const lastTapRef = useRef(0)

  const resetTransform = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 })
  }, [])

  useEffect(() => {
    resetTransform()
  }, [index, resetTransform])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < urls.length - 1) onIndexChange(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, urls.length, onClose, onIndexChange])

  const stageSize = () => {
    const rect = stageRef.current?.getBoundingClientRect()
    return { w: rect?.width ?? 0, h: rect?.height ?? 0, left: rect?.left ?? 0, top: rect?.top ?? 0 }
  }

  const relativeFocal = (clientX: number, clientY: number) => {
    const { left, top } = stageSize()
    return { x: clientX - left, y: clientY - top }
  }

  /** Zoom around a stage-local focal point; image uses center transform-origin. */
  const zoomAt = (
    t: Transform,
    newScale: number,
    focalX: number,
    focalY: number
  ): Transform => {
    const { w, h } = stageSize()
    const cx = w / 2
    const cy = h / 2
    const scale = clamp(newScale, MIN_SCALE, MAX_SCALE)
    if (scale === 1) return { scale: 1, x: 0, y: 0 }
    const ratio = scale / t.scale
    return {
      scale,
      x: focalX - cx - (focalX - cx - t.x) * ratio,
      y: focalY - cy - (focalY - cy - t.y) * ratio,
    }
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      panRef.current = null
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
      const mid = relativeFocal((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
      const t = transformRef.current
      pinchRef.current = {
        dist: Math.max(dist, 1),
        scale: t.scale,
        x: t.x,
        y: t.y,
        focalX: mid.x,
        focalY: mid.y,
      }
      return
    }
    if (e.touches.length === 1 && transformRef.current.scale > 1) {
      pinchRef.current = null
      const t = e.touches[0]
      panRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        origX: transformRef.current.x,
        origY: transformRef.current.y,
      }
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.max(Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), 1)
      const mid = relativeFocal((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
      const start = pinchRef.current
      const newScale = start.scale * (dist / start.dist)
      setTransform(
        zoomAt(
          { scale: start.scale, x: start.x, y: start.y },
          newScale,
          mid.x,
          mid.y
        )
      )
      return
    }
    if (e.touches.length === 1 && panRef.current && transformRef.current.scale > 1) {
      e.preventDefault()
      const t = e.touches[0]
      const p = panRef.current
      setTransform((prev) => ({
        ...prev,
        x: p.origX + (t.clientX - p.startX),
        y: p.origY + (t.clientY - p.startY),
      }))
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null
    if (e.touches.length === 0) {
      panRef.current = null
      if (transformRef.current.scale <= 1.02) resetTransform()
    }
  }

  const onDoubleTap = (clientX: number, clientY: number) => {
    const t = transformRef.current
    if (t.scale > 1) {
      resetTransform()
      return
    }
    const focal = relativeFocal(clientX, clientY)
    setTransform(zoomAt(t, 2.5, focal.x, focal.y))
  }

  const onClickStage = (e: React.MouseEvent) => {
    const now = Date.now()
    if (now - lastTapRef.current < 280) {
      onDoubleTap(e.clientX, e.clientY)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const t = transformRef.current
    const focal = relativeFocal(e.clientX, e.clientY)
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(zoomAt(t, t.scale * factor, focal.x, focal.y))
  }

  if (!url) return null

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="查看图片">
      <button type="button" className="lightbox__close" onClick={onClose} aria-label="关闭">
        <IconClose size={22} />
      </button>
      {urls.length > 1 ? (
        <div className="lightbox__counter">
          {index + 1} / {urls.length}
        </div>
      ) : null}
      {index > 0 ? (
        <button
          type="button"
          className="lightbox__nav lightbox__nav--prev"
          onClick={() => onIndexChange(index - 1)}
          aria-label="上一张"
        >
          ‹
        </button>
      ) : null}
      {index < urls.length - 1 ? (
        <button
          type="button"
          className="lightbox__nav lightbox__nav--next"
          onClick={() => onIndexChange(index + 1)}
          aria-label="下一张"
        >
          ›
        </button>
      ) : null}
      <div
        ref={stageRef}
        className="lightbox__stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onClickStage}
        onWheel={onWheel}
      >
        <img
          src={url}
          alt=""
          className="lightbox__img"
          draggable={false}
          style={{
            transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        />
      </div>
    </div>
  )
}
