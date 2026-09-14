'use client'

import { AnimatePresence, m } from 'motion/react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { spring } from '@/lib/motion'

export function InfoTip({
  label,
  children,
  className,
}: {

  label: string
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const [pinned, setPinned] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()

  const place = useCallback(() => {
    const el = buttonRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = 300
    const margin = 12

    const left = Math.min(Math.max(margin, r.left + r.width / 2 - width / 2), window.innerWidth - width - margin)
    const below = window.innerHeight - r.bottom
    const top = below > 190 ? r.bottom + 8 : Math.max(margin, r.top - 8 - 180)
    setCoords({ top, left })
  }, [])

  const show = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    place()
    setOpen(true)
  }, [place])

  const hide = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => { if (!pinned) setOpen(false) }, 140)
  }, [pinned])

  const close = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setPinned(false)
    setOpen(false)
  }, [])

  const togglePinned = useCallback(() => {
    if (pinned) { close(); return }
    setPinned(true)
    show()
  }, [pinned, close, show])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onScroll = () => close()

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!buttonRef.current?.contains(t) && !panelRef.current?.contains(t)) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, close])

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={togglePinned}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={`inline-flex shrink-0 items-center justify-center rounded-full text-faint transition-colors duration-150 hover:text-accent ${className ?? ''}`}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && coords ? (
          <m.div
            ref={panelRef}
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={spring}
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: 300, zIndex: 60 }}
            className="rounded-lg border border-line bg-raised px-3.5 py-3 text-[12.5px] leading-relaxed text-muted shadow-[var(--shadow-pop)]"
          >
            {children}
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

export function TipRule({ term, children }: { term: string; children: ReactNode }) {
  return (
    <p className="mt-1.5 first:mt-0">
      <span className="font-semibold text-ink">{term}</span>
      {': '}
      {children}
    </p>
  )
}
