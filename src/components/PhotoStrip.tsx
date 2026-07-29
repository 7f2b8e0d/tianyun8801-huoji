import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react'

export type PhotoStripHandle = {
  scrollToEnd: () => void
}

/** Horizontally scrollable photo/action strip; supports touch and mouse drag. */
export const PhotoStrip = forwardRef<PhotoStripHandle, {
  children: ReactNode
  className?: string
}>(function PhotoStrip({ children, className = 'photo-row' }, ref) {
  const elRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    pointerId: number
    startX: number
    scrollLeft: number
    moved: boolean
  } | null>(null)

  useImperativeHandle(ref, () => ({
    scrollToEnd: () => {
      const el = elRef.current
      if (!el) return
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    },
  }))

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const onPointerDown = (e: PointerEvent) => {
      // Touch/pen: use native overflow scrolling. Mouse: drag-to-scroll.
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('.photo-thumb__remove')) return
      drag.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        scrollLeft: el.scrollLeft,
        moved: false,
      }
      el.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      const dx = e.clientX - d.startX
      if (Math.abs(dx) > 4) d.moved = true
      if (d.moved) {
        el.scrollLeft = d.scrollLeft - dx
        e.preventDefault()
      }
    }

    const end = (e: PointerEvent) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      if (d.moved) {
        const blockClick = (ev: Event) => {
          ev.stopPropagation()
          ev.preventDefault()
          el.removeEventListener('click', blockClick, true)
        }
        el.addEventListener('click', blockClick, true)
      }
      drag.current = null
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
    }
  }, [])

  return (
    <div ref={elRef} className={className}>
      {children}
    </div>
  )
})
