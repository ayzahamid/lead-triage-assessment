'use client'

import { useMemo, useState } from 'react'
import { Check, Eye, EyeOff, Sparkles, X } from 'lucide-react'
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers'
import { fmtInt } from '@/lib/format'
import { Button } from './ui'
import { Modal } from './Modal'

export type EnrichScope = 'top25' | 'top50' | 'top100' | 'filtered'

export interface EnrichRequest {
  scope: EnrichScope

  skipExisting: boolean
}

const SECONDS_PER_BATCH: Record<ProviderId, number> = {
  gemini: 8,
  'opencode-go': 150,
}
const BATCH_SIZE = 25
const CONCURRENCY = 4

export function EnrichDialog({
  open, onClose, onRun, providerId, model, hasKey, onChangeKey,
  filteredCount, totalCount, alreadyEnriched,
}: {
  open: boolean
  onClose: () => void
  onRun: (req: EnrichRequest) => void
  providerId: ProviderId
  model: string
  hasKey: boolean
  onChangeKey: () => void
  filteredCount: number
  totalCount: number
  alreadyEnriched: number
}) {
  const [scope, setScope] = useState<EnrichScope>('top25')
  const [skipExisting, setSkipExisting] = useState(true)

  const options: Array<{ id: EnrichScope; label: string; count: number; hint: string }> = useMemo(() => [
    { id: 'top25', label: 'Top 25 by score', count: Math.min(25, totalCount), hint: 'One batch. Enough to plan a morning of calls.' },
    { id: 'top50', label: 'Top 50 by score', count: Math.min(50, totalCount), hint: 'Two batches.' },
    { id: 'top100', label: 'Top 100 by score', count: Math.min(100, totalCount), hint: 'Four batches. The practical ceiling.' },
    { id: 'filtered', label: 'Everything on screen', count: Math.min(100, filteredCount), hint: filteredCount > 100 ? 'Capped at the first 100 of your filtered list.' : 'Your current filters, highest score first.' },
  ], [totalCount, filteredCount])

  const chosen = options.find((o) => o.id === scope) ?? options[0]!
  const batches = Math.max(1, Math.ceil(chosen.count / BATCH_SIZE))
  const rounds = Math.ceil(batches / CONCURRENCY)
  const seconds = rounds * (SECONDS_PER_BATCH[providerId] ?? 30)
  const estimate = seconds < 90 ? `about ${Math.max(5, Math.round(seconds / 5) * 5)} seconds` : `about ${Math.ceil(seconds / 60)} minutes`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add AI context"
      icon={<Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />}
      footer={
        <>
          <Button size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            variant="accent"
            disabled={!hasKey || chosen.count === 0}
            onClick={() => { onRun({ scope, skipExisting }); onClose() }}
          >
            {hasKey ? `Enrich ${fmtInt(chosen.count)} leads` : 'Add a key first'}
          </Button>
        </>
      }
    >
      <section>
        <h3 className="text-[13px] font-medium">How many leads</h3>
        <div className="mt-2 space-y-1">
          {options.map((o) => {
            const on = o.id === scope
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                disabled={o.count === 0}
                onClick={() => setScope(o.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors duration-150 disabled:opacity-40 ${
                  on ? 'border-accent bg-accent-wash' : 'border-line hover:border-faint'
                }`}
              >
                <span className="flex-1">
                  <span className="block text-[13px] font-medium">{o.label}</span>
                  <span className="block text-[11.5px] text-muted">{o.hint}</span>
                </span>
                <span className="fig text-[13px] font-semibold">{fmtInt(o.count)}</span>
                {on ? <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> : <span className="w-4" />}
              </button>
            )
          })}
        </div>

        {alreadyEnriched > 0 ? (
          <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-[var(--color-accent)]"
            />
            Skip the <span className="fig font-semibold text-ink">{fmtInt(alreadyEnriched)}</span> already enriched
          </label>
        ) : null}
      </section>

      <section className="mt-5 rounded-lg border border-line bg-surface px-3.5 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-[13px] font-medium">Model</h3>
          <Button variant="quiet" size="sm" className="-mr-1.5" onClick={onChangeKey}>
            {hasKey ? 'Change key or model' : 'Add a key'}
          </Button>
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted">
          <span className="font-medium text-ink">{PROVIDERS[providerId].label}</span>
          {' · '}
          <span className="fig">{model}</span>
        </p>
        <p className="mt-1.5 text-[12.5px] text-muted">
          {chosen.count === 0
            ? 'Nothing to enrich with the current filters.'
            : <>Roughly <span className="font-medium text-ink">{estimate}</span> for {fmtInt(chosen.count)} leads, running {CONCURRENCY} batches at a time.</>}
        </p>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-clear-wash px-3 py-2.5">
          <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-clear">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            What it sends
          </h3>
          <ul className="mt-1.5 space-y-0.5 text-[12px] leading-snug text-clear">
            <li>Company name</li>
            <li>Job title</li>
            <li>Employee count and revenue</li>
            <li>Industry</li>
          </ul>
        </div>
        <div className="rounded-lg bg-dead-wash px-3 py-2.5">
          <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-dead">
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            What it never sends
          </h3>
          <ul className="mt-1.5 space-y-0.5 text-[12px] leading-snug text-dead">
            <li>Email addresses</li>
            <li>Phone numbers</li>
            <li>Contact names</li>
            <li>Your uploaded file</li>
          </ul>
        </div>
      </section>

      <section className="mt-4">
        <h3 className="text-[13px] font-medium">What you get back</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          A fit rating from 1 to 5, a signal of growth, stable, risk or unknown, and one line
          of reasoning. Leads are sent in batches of 25 and judgments are cached by company
          domain, so running it again on the same companies costs nothing.
        </p>
      </section>

      <section className="mt-3 flex items-start gap-2 rounded-lg bg-hold-wash px-3 py-2.5">
        <X className="mt-px h-3.5 w-3.5 shrink-0 text-hold" aria-hidden="true" />
        <p className="text-[12px] leading-relaxed text-hold">
          It does not change the priority score or the deliverability verdict. Those stay
          deterministic and reproducible, and the tool works fully without this step.
        </p>
      </section>
    </Modal>
  )
}
