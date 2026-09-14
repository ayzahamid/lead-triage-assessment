'use client'

import { AnimatePresence, m } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { dialogIn } from '@/lib/motion'
import { Button } from './ui'

export function Modal({
  open, onClose, title, icon, children, footer, width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <m.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }} onClick={onClose}
            className="absolute inset-0 bg-[var(--color-scrim)] backdrop-blur-[3px]"
          />
          <m.div
            variants={dialogIn} initial="initial" animate="animate" exit="exit"
            className={`relative flex max-h-[88vh] w-full ${width} flex-col overflow-hidden rounded-xl bg-raised shadow-[var(--shadow-pop)]`}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                {icon}
                <h2 id="modal-title" className="text-[15px] font-semibold">{title}</h2>
              </div>
              <Button variant="quiet" size="sm" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer ? (
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
                {footer}
              </footer>
            ) : null}
          </m.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, body, confirmLabel, icon,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: string
  confirmLabel: string
  icon?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={icon}
      width="max-w-sm"
      footer={
        <>
          <Button size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="accent" onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">{body}</p>
    </Modal>
  )
}
