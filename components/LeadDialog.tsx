'use client'

import { AnimatePresence, m } from 'motion/react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { Lead } from '@/lib/types'
import { STATUS_MEANING, TIER_MEANING, fmtCount, fmtMoney, orText } from '@/lib/format'
import { dialogIn, spring, stagger } from '@/lib/motion'
import { Button, StatusPill, TierBadge } from './ui'

export function LeadDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  useEffect(() => {
    if (!lead) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [lead, onClose])

  return (
    <AnimatePresence>
      {lead ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="lead-dialog-title">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="absolute inset-0 bg-[var(--color-scrim)] backdrop-blur-[3px]"
          />
          <m.div
            variants={dialogIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-raised shadow-[var(--shadow-pop)]"
            style={{ overscrollBehavior: 'contain' }}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 id="lead-dialog-title" className="truncate text-[16px] font-semibold tracking-[-0.015em]">
                  {lead.companyName}
                </h2>
                <p className="truncate text-[13px] text-muted">
                  {orText(lead.contactName, 'No contact named')}
                  {lead.title ? `, ${lead.title}` : ''}
                </p>
              </div>
              <Button variant="quiet" size="sm" onClick={onClose} aria-label="Close lead details">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                {lead.verification ? <StatusPill status={lead.verification.status} /> : null}
                {lead.verification ? (
                  <span className="text-[12.5px] text-muted">
                    <span className="fig font-medium text-ink">{lead.verification.confidence}</span>% confidence,{' '}
                    {STATUS_MEANING[lead.verification.status].toLowerCase()}
                  </span>
                ) : null}
                {lead.score ? (
                  <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-muted">
                    <TierBadge tier={lead.score.tier} />
                    {TIER_MEANING[lead.score.tier]}
                  </span>
                ) : null}
              </div>

              <section className="mt-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[13px] font-semibold">How this score was built</h3>
                  <span className="fig text-[17px] font-semibold">{lead.score?.total ?? 0}</span>
                </div>
                <m.div variants={stagger(0.06, 0.05)} initial="initial" animate="animate" className="mt-2.5 space-y-2.5">
                  {lead.score?.dimensions.map((d) => (
                    <m.div key={d.key} variants={{ initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0, transition: spring } }}>
                      <div className="flex items-baseline gap-3">
                        <span className="w-[9.5rem] shrink-0 text-[12.5px]">{d.label}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft" aria-hidden="true">
                          <m.span
                            className="block h-full rounded-full bg-accent"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: d.max > 0 ? d.points / d.max : 0 }}
                            transition={{ ...spring, delay: 0.1 }}
                            style={{ transformOrigin: 'left' }}
                          />
                        </span>
                        <span className="fig w-11 shrink-0 text-right text-[12px] text-muted">{d.points}/{d.max}</span>
                      </div>
                      <p className="mt-0.5 pl-[10.6rem] text-[11.5px] text-faint">{d.detail}</p>
                    </m.div>
                  ))}
                </m.div>
              </section>

              <section className="mt-6">
                <h3 className="text-[13px] font-semibold">What the check found</h3>
                <ul className="mt-2 space-y-1.5">
                  {lead.verification?.reasons.map((r) => (
                    <li key={r.code} className="flex items-baseline gap-2.5 text-[12.5px]">
                      <span aria-hidden="true" className={`fig w-7 shrink-0 text-right text-[11.5px] ${r.weight < 0 ? 'text-dead' : 'text-clear'}`}>
                        {r.weight < 0 ? r.weight : '✓'}
                      </span>
                      <span className="text-muted">{r.label}</span>
                    </li>
                  ))}
                </ul>
                {lead.verification?.mxHosts.length ? (
                  <p className="fig mt-2 truncate rounded-lg bg-line-soft px-2.5 py-1.5 text-[11px] text-faint" translate="no">
                    {lead.verification.mxHosts.slice(0, 3).join('   ')}
                  </p>
                ) : null}
              </section>

              {lead.ai ? (
                <section className="mt-6">
                  <h3 className="text-[13px] font-semibold">Added context</h3>
                  <p className="mt-1.5 text-[12.5px] text-muted">
                    Fit <span className="fig text-ink">{lead.ai.fit}</span>/<span className="fig">5</span>, signal {lead.ai.signal}. {lead.ai.reason}
                  </p>
                </section>
              ) : null}

              <section className="mt-6">
                <h3 className="text-[13px] font-semibold">Record</h3>
                <dl className="mt-2 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-1.5 text-[12.5px]">
                  {([
                    ['Email', orText(lead.email, 'Not on the record'), true],
                    ['Domain', orText(lead.domain, 'Not on the record'), true],
                    ['Industry', orText(lead.industry, 'Not listed'), false],
                    ['Employees', fmtCount(lead.employees), true],
                    ['Revenue', fmtMoney(lead.revenue), true],
                    ['Location', orText(lead.location, 'Not listed'), false],
                    ['Phone', orText(lead.phone, 'Not listed'), true],
                  ] as Array<[string, string, boolean]>).map(([k, v, mono]) => (
                    <div key={k} className="contents">
                      <dt className="text-faint">{k}</dt>
                      <dd className={`min-w-0 truncate ${mono ? 'fig' : ''}`} translate={mono ? 'no' : undefined}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </m.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
