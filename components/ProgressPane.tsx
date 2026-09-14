'use client'

import { m } from 'motion/react'
import { fmtInt } from '@/lib/format'
import { riseItem, spring, stagger } from '@/lib/motion'

export interface ProgressState {
  phase: 'starting' | 'verifying' | 'enriching' | 'saving'
  done: number
  total: number
  uniqueDomains: number
  cacheHits: number
  aiBatch: number
  aiBatches: number
  lastDomain: string | null
}

const PHASE_COPY: Record<ProgressState['phase'], string> = {
  starting: 'Reading the list…',
  verifying: 'Checking every address against live DNS…',
  enriching: 'Adding context to your strongest leads…',
  saving: 'Saving…',
}

function GhostRow() {
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1.4fr)_minmax(0,1.2fr)_6rem] items-center gap-4 border-b border-line-soft px-4 py-3">
      {[2, 10, 8, 4.5].map((w, i) => (
        <div key={i} className="sweep rounded bg-line-soft" style={{ height: 10, width: `${w}rem` }} />
      ))}
    </div>
  )
}

export function ProgressPane({ state }: { state: ProgressState }) {
  const pct = state.total > 0 ? Math.min(100, Math.round((state.done / state.total) * 100)) : 0

  return (
    <m.div variants={stagger()} initial="initial" animate="animate" className="mx-auto w-full max-w-4xl px-6 py-16">
      <m.div variants={riseItem} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-[18px] font-semibold tracking-[-0.015em]">{PHASE_COPY[state.phase]}</h1>
        <p className="fig text-[13px] text-muted">
          {fmtInt(state.done)} of {fmtInt(state.total)}
        </p>
      </m.div>

      <div aria-live="polite" className="sr-only">
        {PHASE_COPY[state.phase]} {fmtInt(state.done)} of {fmtInt(state.total)} leads processed.
      </div>

      <m.div
        variants={riseItem}
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-line-soft"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Verification progress"
      >
        <m.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={spring}
        />
      </m.div>

      <m.dl variants={riseItem} className="mt-6 flex flex-wrap gap-x-9 gap-y-3 text-[13px]">
        <div className="flex items-baseline gap-2">
          <dt className="text-muted">Unique domains</dt>
          <dd className="fig font-medium">{fmtInt(state.uniqueDomains)}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-muted">Reused from cache</dt>
          <dd className="fig font-medium">{fmtInt(state.cacheHits)}</dd>
        </div>
        {state.phase === 'enriching' && state.aiBatches > 0 ? (
          <div className="flex items-baseline gap-2">
            <dt className="text-muted">Batch</dt>
            <dd className="fig font-medium">{fmtInt(state.aiBatch)} of {fmtInt(state.aiBatches)}</dd>
          </div>
        ) : state.lastDomain ? (
          <div className="flex min-w-0 items-baseline gap-2">
            <dt className="text-muted">Resolving</dt>
            <m.dd
              key={state.lastDomain}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="fig min-w-0 truncate font-medium"
              translate="no"
            >
              {state.lastDomain}
            </m.dd>
          </div>
        ) : null}
      </m.dl>

      <m.div
        variants={riseItem}
        className="mt-9 overflow-hidden rounded-xl border border-line bg-surface"
        aria-hidden="true"
      >
        {Array.from({ length: 7 }, (_, i) => <GhostRow key={i} />)}
      </m.div>

      <m.p variants={riseItem} className="mt-5 max-w-[58ch] text-[12.5px] leading-relaxed text-muted">
        Addresses are grouped by domain before any lookup runs, so a list of several hundred
        usually needs only a few dozen queries.
      </m.p>
    </m.div>
  )
}
