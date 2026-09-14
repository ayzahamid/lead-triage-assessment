'use client'

import { m } from 'motion/react'
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle, type LucideIcon } from 'lucide-react'
import type { Deliverability, Tier } from '@/lib/types'
import { fmtInt, fmtPct } from '@/lib/format'
import { spring } from '@/lib/motion'

export const STATUS_ICON: Record<Deliverability, LucideIcon> = {
  deliverable: CheckCircle2,
  risky: AlertTriangle,
  undeliverable: XCircle,
  unknown: CircleHelp,
}

const STATUS_FILL: Record<Deliverability, string> = {
  deliverable: 'var(--color-clear)',
  risky: 'var(--color-hold)',
  undeliverable: 'var(--color-dead)',
  unknown: 'var(--color-idle)',
}

const STATUS_TEXT: Record<Deliverability, string> = {
  deliverable: 'text-clear',
  risky: 'text-hold',
  undeliverable: 'text-dead',
  unknown: 'text-idle',
}

const ORDER: Deliverability[] = ['deliverable', 'risky', 'undeliverable', 'unknown']

export function DeliverabilityBar({
  counts,
  total,
}: {
  counts: Record<Deliverability, number>
  total: number
}) {
  if (total === 0) return null
  const segments = ORDER.filter((s) => counts[s] > 0)

  return (
    <div>
      <div className="flex h-9 w-full gap-0.5 overflow-hidden rounded-lg" role="img"
        aria-label={ORDER.map((s) => `${fmtInt(counts[s])} ${s}`).join(', ')}>
        {segments.map((s, i) => {
          const share = counts[s] / total
          const Icon = STATUS_ICON[s]
          return (
            <m.div
              key={s}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: share }}
              transition={{ ...spring, delay: 0.05 * i }}
              style={{ backgroundColor: STATUS_FILL[s], flexBasis: 0, minWidth: share > 0.001 ? 4 : 0 }}
              className="relative flex items-center justify-center overflow-hidden first:rounded-l-lg last:rounded-r-lg"
              title={`${fmtInt(counts[s])} ${s} (${fmtPct(share)})`}
            >
              {share > 0.11 ? (
                <span className="flex items-center gap-1 px-2 text-[11.5px] font-semibold text-white mix-blend-normal">
                  <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {fmtPct(share)}
                </span>
              ) : null}
            </m.div>
          )
        })}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {ORDER.map((s) => {
          const Icon = STATUS_ICON[s]
          return (
            <li key={s} className="flex items-center gap-1.5 text-[12px]">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${STATUS_TEXT[s]}`} aria-hidden="true" />
              <span className="capitalize text-muted">{s}</span>
              <span className="fig font-semibold">{fmtInt(counts[s])}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const TIER_FILL: Record<Tier, string> = {
  A: 'var(--color-accent)',
  B: 'color-mix(in oklab, var(--color-accent) 68%, var(--color-surface))',
  C: 'color-mix(in oklab, var(--color-accent) 42%, var(--color-surface))',
  D: 'color-mix(in oklab, var(--color-accent) 22%, var(--color-surface))',
}

export function TierBars({ counts }: { counts: Record<Tier, number> }) {
  const tiers: Tier[] = ['A', 'B', 'C', 'D']
  const max = Math.max(1, ...tiers.map((t) => counts[t]))
  return (
    <div className="flex items-end gap-1" role="img" aria-label={tiers.map((t) => `Tier ${t}: ${counts[t]}`).join(', ')}>
      {tiers.map((t, i) => (
        <m.div
          key={t}
          initial={{ height: 2 }}
          animate={{ height: Math.max(3, (counts[t] / max) * 26) }}
          transition={{ ...spring, delay: 0.04 * i }}
          style={{ backgroundColor: TIER_FILL[t] }}
          className="w-2 rounded-sm"
          title={`Tier ${t}: ${fmtInt(counts[t])}`}
        />
      ))}
    </div>
  )
}

export function ReadyFunnel({
  total,
  reachable,
  priority,
}: {
  total: number
  reachable: number
  priority: number
}) {
  const steps = [
    { label: 'Uploaded', value: total, fill: 'var(--color-line)', text: 'text-muted' },
    { label: 'Reachable', value: reachable, fill: 'color-mix(in oklab, var(--color-accent) 55%, var(--color-surface))', text: 'text-accent' },
    { label: 'Ready to call', value: priority, fill: 'var(--color-clear)', text: 'text-clear' },
  ]
  const max = Math.max(1, total)

  return (
    <ul className="space-y-2">
      {steps.map((step, i) => (
        <li key={step.label} className="flex items-center gap-3">
          <span className="w-[5.5rem] shrink-0 text-[12px] text-muted">{step.label}</span>
          <span className="relative h-5 flex-1 overflow-hidden rounded-md bg-line-soft">
            <m.span
              className="absolute inset-y-0 left-0 rounded-md"
              style={{ backgroundColor: step.fill }}
              initial={{ width: 0 }}
              animate={{ width: `${(step.value / max) * 100}%` }}
              transition={{ ...spring, delay: 0.06 * i }}
            />
          </span>
          <span className={`fig w-12 shrink-0 text-right text-[13px] font-semibold ${step.text}`}>
            {fmtInt(step.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}
