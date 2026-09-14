'use client'

import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { FileUp, ShieldCheck, Sparkles, Upload } from 'lucide-react'
import { riseItem, spring, stagger } from '@/lib/motion'
import { Button, Spinner } from './ui'

const SAMPLES = [
  { verdict: 'deliverable', tone: 'text-clear', dot: 'bg-clear', email: 'j.whitfield@acme-freight.com', why: 'Live mail exchanger, no reputation flags' },
  { verdict: 'risky', tone: 'text-hold', dot: 'bg-hold', email: 'sales@acme-freight.com', why: 'Shared inbox that reaches a queue, not a decision maker' },
  { verdict: 'undeliverable', tone: 'text-dead', dot: 'bg-dead', email: 'j.whitfield@acme-frieght.com', why: 'Domain does not exist; this one would have bounced' },
]

export function UploadPane({
  onUpload, onLoadSample, busy, error, note,
}: {
  onUpload: (file: File) => void
  onLoadSample: () => void
  busy: boolean
  error: string | null

  note?: string | null
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const take = useCallback((files: FileList | null) => {
    const file = files?.[0]
    if (file) onUpload(file)
  }, [onUpload])

  return (
    <m.div
      variants={stagger(0.06, 0.05)}
      initial="initial"
      animate="animate"
      className="mx-auto w-full max-w-3xl px-6 pb-20 pt-16 sm:pt-24"
    >
      <m.h1 variants={riseItem} className="max-w-xl text-pretty text-[32px] font-semibold leading-[1.1] tracking-[-0.028em] sm:text-[40px]">
        Find out which of these leads can actually be reached.
      </m.h1>

      <m.p variants={riseItem} className="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-muted">
        Drop in a scraped list. Every address is checked against live DNS, every company is
        scored against your ideal customer profile, and what comes back is ordered by who to
        call first. Uploads add to your library rather than replacing it, and anything already
        there is recognised instead of duplicated.
      </m.p>

      <m.div
        variants={riseItem}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); take(e.dataTransfer.files) }}
        animate={{ scale: dragging ? 1.012 : 1 }}
        transition={spring}
        className={`mt-9 rounded-2xl border-2 border-dashed p-8 text-center transition-colors duration-200 sm:p-11 ${
          dragging ? 'border-accent bg-accent-wash' : 'border-line bg-surface'
        }`}
      >
        <m.div
          animate={dragging ? { y: -4 } : { y: 0 }}
          transition={spring}
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent-wash"
        >
          <Upload className="h-5 w-5 text-accent" aria-hidden="true" />
        </m.div>
        <p className="mt-4 text-[15px] font-medium">Drop a CSV here</p>
        <p className="mt-1 text-[13px] text-muted">
          Exports from SaaSquatch, Apollo, Hunter or a plain spreadsheet all work.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Button variant="accent" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <FileUp className="h-4 w-4" aria-hidden="true" />}
            {busy ? 'Reading the file…' : 'Choose CSV File'}
          </Button>
          <Button onClick={onLoadSample} disabled={busy}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Load Sample Dataset
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="Upload a lead CSV file"
          onChange={(e) => { take(e.target.files); e.target.value = '' }}
        />
      </m.div>

      <AnimatePresence>
        {note ? (
          <m.p
            role="status"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={spring}
            className="mt-4 overflow-hidden rounded-lg bg-clear-wash px-3.5 py-2.5 text-[13px] text-clear"
          >
            {note}
          </m.p>
        ) : null}
        {error ? (
          <m.p
            role="alert"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="mt-4 overflow-hidden rounded-lg bg-dead-wash px-3.5 py-2.5 text-[13px] text-dead"
          >
            {error}
          </m.p>
        ) : null}
      </AnimatePresence>

      <m.section variants={riseItem} className="mt-14">
        <h2 className="text-[13px] font-medium text-muted">What comes back</h2>
        <dl className="mt-3 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
          {SAMPLES.map((s, i) => (
            <div
              key={s.email}
              className={`grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-4 px-4 py-3 sm:grid-cols-[7.5rem_17rem_minmax(0,1fr)] ${
                i < SAMPLES.length - 1 ? 'border-b border-line-soft' : ''
              }`}
            >
              <dt className={`flex items-center gap-1.5 text-[12.5px] font-medium ${s.tone}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
                {s.verdict}
              </dt>
              <dd className="fig min-w-0 truncate text-[12.5px]" translate="no">{s.email}</dd>
              <dd className="col-span-2 text-[12.5px] text-muted sm:col-span-1">{s.why}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-clear" aria-hidden="true" />
          Nothing is scraped. The tool only reads the list you give it.
        </p>
      </m.section>
    </m.div>
  )
}
