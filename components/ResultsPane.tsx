'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Copy, Download, KeyRound, Search, Sparkles, Star, Target, Trash2, X } from 'lucide-react'
import type { Deliverability, Lead, Tier } from '@/lib/types'
import { TIER_MEANING, fmtCount, fmtInt, fmtMoney, fmtPct, orText } from '@/lib/format'
import { popItem, riseItem, spring, stagger } from '@/lib/motion'
import { Button, Counter, Spinner, StatusPill, TierBadge } from './ui'
import { DeliverabilityBar, ReadyFunnel, TierBars } from './charts'
import { LeadDialog } from './LeadDialog'
import { Pagination, DEFAULT_PAGE_SIZE, PAGE_SIZES, type PageSize } from './Pagination'
import { EnrichDialog, type EnrichRequest } from './EnrichDialog'
import { IcpDialog } from './IcpDialog'
import { describePrefs, isDefaultIcp, type IcpPrefs } from '@/lib/icp'
import { ConfirmDialog } from './Modal'
import { InfoTip } from './InfoTip'
import {
  BOUNCE_EXPLAINER, DUPLICATE_EXPLAINER, FUNNEL_EXPLAINER, PRIORITY_EXPLAINER, VERDICT_EXPLAINER,
} from '@/lib/explainers'
import type { ProviderId } from '@/lib/ai/providers'

export interface Filters {
  tiers: Tier[]
  statuses: Deliverability[]
  minScore: number
  excludeDuplicates: boolean
  query: string
}

function readPageParam(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const n = Number(new URLSearchParams(window.location.search).get(key))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const TIERS: Tier[] = ['A', 'B', 'C', 'D']
const STATUSES: Deliverability[] = ['deliverable', 'risky', 'undeliverable', 'unknown']
const ROW = 46
const COLS = 'grid-cols-[3.25rem_minmax(0,1.5fr)_minmax(0,1.4fr)_7.5rem_4.5rem_5rem]'

export function ResultsPane({
  leads, filters, setFilters, onExport, onReset, onEnrich, enriching,
  onOpenKey, hasKey, providerId, model, aiNote, filename, mergedDuplicates, icp, onSaveIcp,
}: {
  leads: Lead[]
  filters: Filters
  setFilters: (next: Filters) => void
  onExport: (format: 'generic' | 'hubspot' | 'salesforce') => void
  onReset: () => void
  onEnrich: (req: EnrichRequest, visibleIds: string[]) => void
  enriching: boolean
  onOpenKey: () => void
  hasKey: boolean
  providerId: ProviderId
  model: string
  aiNote: string | null
  filename: string

  mergedDuplicates: number

  icp: IcpPrefs
  onSaveIcp: (next: IcpPrefs) => void
}) {
  const [selected, setSelected] = useState<Lead | null>(null)
  const [format, setFormat] = useState<'generic' | 'hubspot' | 'salesforce'>('hubspot')
  const [confirmReset, setConfirmReset] = useState(false)
  const [enrichOpen, setEnrichOpen] = useState(false)
  const [icpOpen, setIcpOpen] = useState(false)

  const [page, setPage] = useState(() => readPageParam('page', 1))
  const [pageSize, setPageSize] = useState<PageSize>(() => {
    const n = readPageParam('rows', DEFAULT_PAGE_SIZE)
    return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const [railHeight, setRailHeight] = useState<number | null>(null)

  useEffect(() => {
    const el = railRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setRailHeight(Math.round(entry.contentRect.height))
    })
    observer.observe(el)
    setRailHeight(el.getBoundingClientRect().height)
    return () => observer.disconnect()
  }, [])

  const deferredFilters = useDeferredValue(filters)

  const stats = useMemo(() => {
    const s = { deliverable: 0, risky: 0, undeliverable: 0, unknown: 0 }
    const t = { A: 0, B: 0, C: 0, D: 0 }
    let duplicates = 0
    let enriched = 0
    let reachable = 0
    let readyToCall = 0
    for (const l of leads) {
      const status = l.verification?.status
      if (status) s[status]++
      if (l.score) t[l.score.tier]++
      if (l.duplicateOf) duplicates++
      if (l.ai) enriched++

      const canReach = status === 'deliverable' || status === 'risky'
      if (canReach) reachable++
      if (canReach && l.score?.tier === 'A' && !l.duplicateOf) readyToCall++
    }
    return {
      s, t, duplicates, enriched, reachable, readyToCall,
      bounce: leads.length ? s.undeliverable / leads.length : 0,
    }
  }, [leads])

  const visible = useMemo(() => {
    const f = deferredFilters
    const q = f.query.trim().toLowerCase()
    const tierSet = new Set(f.tiers)
    const statusSet = new Set(f.statuses)
    return leads
      .filter((l) => {
        if (f.excludeDuplicates && l.duplicateOf) return false
        if (tierSet.size && (!l.score || !tierSet.has(l.score.tier))) return false
        if (statusSet.size && (!l.verification || !statusSet.has(l.verification.status))) return false
        if (f.minScore > 0 && (l.score?.total ?? 0) < f.minScore) return false
        if (q) {
          const hay = [l.companyName, l.contactName, l.title, l.email, l.industry].filter(Boolean).join(' ').toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
  }, [leads, deferredFilters])

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))

  useEffect(() => { setPage((p) => Math.min(p, pageCount)) }, [pageCount])

  const rows = useMemo(
    () => visible.slice((page - 1) * pageSize, page * pageSize),
    [visible, page, pageSize],
  )

  const firstFilterRun = useRef(true)
  useEffect(() => {

    if (firstFilterRun.current) { firstFilterRun.current = false; return }
    setPage(1)
  }, [deferredFilters])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (page > 1) p.set('page', String(page)); else p.delete('page')
    if (pageSize !== DEFAULT_PAGE_SIZE) p.set('rows', String(pageSize)); else p.delete('rows')
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [page, pageSize])

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const active =
    filters.tiers.length > 0 || filters.statuses.length > 0 || filters.minScore > 0 ||
    filters.excludeDuplicates || filters.query.trim().length > 0

  return (
    <m.div variants={stagger(0.03, 0.04)} initial="initial" animate="animate" className="mx-auto w-full max-w-[88rem] px-5 py-5 sm:px-7">
      <m.header variants={riseItem} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="fig truncate text-[15px] font-semibold" translate="no">{filename}</h1>
          <p className="shrink-0 text-[12.5px] text-muted">
            <span className="fig">{fmtInt(leads.length)}</span> leads in your library
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setIcpOpen(true)} title={describePrefs(icp)}>
            <Target className="h-4 w-4" aria-hidden="true" />
            {isDefaultIcp(icp) ? 'Set your ICP' : describePrefs(icp)}
          </Button>
          <Button onClick={() => setEnrichOpen(true)} disabled={enriching}>
            {enriching ? <Spinner className="h-4 w-4" /> : hasKey ? <Sparkles className="h-4 w-4" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
            {enriching
              ? 'Adding context…'
              : stats.enriched > 0
                ? `Context · ${fmtInt(stats.enriched)}`
                : 'Add Context'}
          </Button>
          <label htmlFor="export-format" className="sr-only">Export format</label>
          <select
            id="export-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] text-ink"
          >
            <option value="hubspot">HubSpot</option>
            <option value="salesforce">Salesforce</option>
            <option value="generic">Generic CSV</option>
          </select>
          <Button variant="accent" onClick={() => onExport(format)} disabled={visible.length === 0}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export {fmtInt(visible.length)}
          </Button>
          <Button variant="quiet" size="sm" onClick={() => setConfirmReset(true)}>
            Start over
          </Button>
        </div>
      </m.header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <m.section
          variants={riseItem}
          className="flex flex-col rounded-xl border border-line bg-surface px-5 py-4 shadow-[var(--shadow-card)]"
          aria-labelledby="composition-heading"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="composition-heading" className="text-[13px] font-semibold">Who you can actually reach</h2>
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
              <span className="fig font-semibold text-dead">
                <Counter value={Math.round(stats.bounce * 100)} format={(n) => fmtPct(n / 100)} />
              </span>
              of this list would have bounced
              <InfoTip label="What the bounce figure counts">{BOUNCE_EXPLAINER}</InfoTip>
            </p>
          </div>
          <div className="mt-3 flex flex-1 flex-col justify-center">
            <DeliverabilityBar counts={stats.s} total={leads.length} />
          </div>
          {mergedDuplicates > 0 ? (
            <p className="mt-3 flex items-center gap-1.5 border-t border-line-soft pt-2.5 text-[12px] text-muted">
              <Copy className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
              <span className="fig font-semibold text-ink">{fmtInt(mergedDuplicates)}</span>
              repeat row{mergedDuplicates === 1 ? '' : 's'} merged, so your library holds one copy of each
              <InfoTip label="How duplicates are matched">{DUPLICATE_EXPLAINER}</InfoTip>
            </p>
          ) : null}
        </m.section>

        <m.section
          variants={riseItem}
          className="flex flex-col rounded-xl border border-line bg-surface px-5 py-4 shadow-[var(--shadow-card)]"
          aria-labelledby="priority-heading"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="priority-heading" className="flex items-center gap-1.5 text-[13px] font-semibold">
              What you can work today
              <InfoTip label="How these three numbers are counted">{FUNNEL_EXPLAINER}</InfoTip>
            </h2>
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
              <Star className="h-3.5 w-3.5 text-clear" aria-hidden="true" />
              top tier and reachable
            </p>
          </div>
          <div className="mt-3.5 flex flex-1 flex-col justify-center">
            <ReadyFunnel total={leads.length} reachable={stats.reachable} priority={stats.readyToCall} />
          </div>
        </m.section>
      </div>

      <AnimatePresence>
        {aiNote ? (
          <m.p
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="mt-3 overflow-hidden rounded-lg bg-hold-wash px-3.5 py-2.5 text-[12.5px] text-hold"
          >
            {aiNote} Scoring is unaffected.
          </m.p>
        ) : null}
      </AnimatePresence>

      <div className="mt-5 grid items-start gap-x-6 gap-y-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <m.aside ref={railRef} variants={riseItem} className="space-y-5 lg:sticky lg:top-5 lg:self-start">
          <div>
            <label htmlFor="lead-search" className="mb-1.5 block text-[12.5px] font-medium text-muted">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden="true" />
              <input
                id="lead-search"
                name="lead-search"
                type="search"
                inputMode="search"
                spellCheck={false}
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                placeholder="Company, name or title…"
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-2.5 text-[13px] placeholder:text-faint focus:border-accent"
              />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 flex w-full items-end justify-between gap-3 text-[12.5px] font-medium text-muted">
              <span>Priority</span>
              <TierBars counts={stats.t} />
            </legend>
            <div className="space-y-1">
              {TIERS.map((t) => {
                const on = filters.tiers.includes(t)
                return (
                  <m.button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    whileTap={{ scale: 0.98 }}
                    transition={spring}
                    onClick={() => setFilters({ ...filters, tiers: toggle(filters.tiers, t) })}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left text-[13px] transition-colors duration-150 ${
                      on ? 'border-accent bg-accent-wash text-ink' : 'border-transparent text-muted hover:bg-line-soft'
                    }`}
                  >
                    <TierBadge tier={t} />
                    <span className="flex-1 truncate text-[12.5px]">{TIER_MEANING[t]}</span>
                    <span className="fig text-[12.5px] text-faint">{fmtInt(stats.t[t])}</span>
                  </m.button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[12.5px] font-medium text-muted">Deliverability</legend>
            <div className="space-y-0.5">
              {STATUSES.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-line-soft">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(s)}
                    onChange={() => setFilters({ ...filters, statuses: toggle(filters.statuses, s) })}
                    className="h-3.5 w-3.5 shrink-0 rounded accent-[var(--color-accent)]"
                  />
                  <span className="flex-1 truncate"><StatusPill status={s} /></span>
                  <span className="fig text-[12.5px] text-faint">{fmtInt(stats.s[s])}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="min-score" className="mb-1.5 block text-[12.5px] font-medium text-muted">
              Score at least <span className="fig text-ink">{filters.minScore}</span>
            </label>
            <input
              id="min-score"
              type="range"
              min={0}
              max={100}
              step={5}
              value={filters.minScore}
              onChange={(e) => setFilters({ ...filters, minScore: Number(e.target.value) })}
              className="w-full accent-[var(--color-accent)]"
            />
          </div>

          <AnimatePresence>
            {active ? (
              <m.div variants={popItem} initial="initial" animate="animate" exit="exit">
                <Button size="sm" variant="quiet" onClick={() => setFilters({ tiers: [], statuses: [], minScore: 0, excludeDuplicates: false, query: '' })}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear filters
                </Button>
              </m.div>
            ) : null}
          </AnimatePresence>
        </m.aside>

        <m.section
          variants={riseItem}

          style={railHeight ? ({ '--rail-h': `${railHeight}px` } as React.CSSProperties) : undefined}
          className="flex min-w-0 flex-col self-start overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)] lg:max-h-[var(--rail-h,none)]"
        >
          <div className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] text-muted">
              <span className="fig font-medium text-ink">{fmtInt(visible.length)}</span>
              {visible.length === leads.length ? ' leads' : ` of ${fmtInt(leads.length)} leads`}, highest score first
            </h2>
          </div>

          <p id="lead-row-hint" className="sr-only">
            Each row opens a full score breakdown and verification detail.
          </p>

          <div
            role="table"
            aria-label={`Leads, highest score first. ${fmtInt(visible.length)} matching your filters.`}
            aria-rowcount={visible.length + 1}
            aria-colcount={6}
            className="flex min-h-0 flex-col"
          >
            <div role="rowgroup">
              <div
                role="row"
                aria-rowindex={1}
                className={`grid ${COLS} items-center gap-4 border-b border-line bg-line-soft/60 px-4 py-2 text-[11.5px] font-medium text-muted`}
              >
                <span role="columnheader" aria-colindex={1} className="flex items-center gap-1">
                  Score
                  <InfoTip label="How the score and tiers work">{PRIORITY_EXPLAINER}</InfoTip>
                </span>
                <span role="columnheader" aria-colindex={2}>Company</span>
                <span role="columnheader" aria-colindex={3}>Contact</span>
                <span role="columnheader" aria-colindex={4} className="flex items-center gap-1">
                  Deliverability
                  <InfoTip label="How deliverability is decided">{VERDICT_EXPLAINER}</InfoTip>
                </span>
                <span role="columnheader" aria-colindex={5} className="text-right">Staff</span>
                <span role="columnheader" aria-colindex={6} className="text-right">Revenue</span>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <p className="text-[14px] font-medium">Nothing matches those filters.</p>
                <p className="mt-1 text-[13px] text-muted">Lower the score threshold or clear a filter to bring rows back.</p>
              </div>
            ) : (
              <div
                ref={scrollRef}
                role="rowgroup"
                className="min-h-0 overflow-y-auto"
                style={{ overscrollBehavior: 'contain' }}
              >
                {rows.map((lead, i) => (
                  <button
                    key={lead.id}
                    type="button"
                    role="row"

                    aria-rowindex={(page - 1) * pageSize + i + 2}
                    aria-describedby="lead-row-hint"
                    onClick={() => setSelected(lead)}
                    style={{ height: ROW }}
                    className={`grid ${COLS} w-full items-center gap-4 border-b border-line-soft px-4 text-left text-[13px] transition-colors duration-100 hover:bg-line-soft/70`}
                  >
                    <span role="cell" aria-colindex={1} className="flex items-center gap-1.5">
                      <span className="fig font-semibold">{lead.score?.total ?? 0}</span>
                      {lead.score ? <TierBadge tier={lead.score.tier} /> : null}
                    </span>
                    <span role="cell" aria-colindex={2} className="min-w-0 truncate font-medium">{lead.companyName}</span>
                    <span role="cell" aria-colindex={3} className="min-w-0 truncate text-muted">
                      {orText(lead.contactName, 'No contact named')}
                      {lead.title ? <span className="text-faint">, {lead.title}</span> : null}
                    </span>
                    <span role="cell" aria-colindex={4} className="min-w-0">
                      {lead.verification ? <StatusPill status={lead.verification.status} muted={!!lead.duplicateOf} /> : null}
                    </span>
                    <span role="cell" aria-colindex={5} className="fig truncate text-right text-muted">{fmtCount(lead.employees)}</span>
                    <span role="cell" aria-colindex={6} className="fig truncate text-right text-muted">{fmtMoney(lead.revenue)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={visible.length}
            onPage={(n) => {
              setPage(Math.min(Math.max(1, n), pageCount))

              scrollRef.current?.scrollTo({ top: 0 })
            }}
            onPageSize={(n) => { setPageSize(n); setPage(1) }}
          />
        </m.section>
      </div>

      <LeadDialog lead={selected} onClose={() => setSelected(null)} />

      <EnrichDialog
        open={enrichOpen}
        onClose={() => setEnrichOpen(false)}
        onRun={(req) => onEnrich(req, visible.map((l) => l.id))}
        providerId={providerId}
        model={model}
        hasKey={hasKey}
        onChangeKey={() => { setEnrichOpen(false); onOpenKey() }}
        filteredCount={visible.length}
        totalCount={leads.length}
        alreadyEnriched={stats.enriched}
      />

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={onReset}
        title="Start over?"
        body="This clears the current results. Your file is not deleted, so you can upload it again."
        confirmLabel="Discard results"
        icon={<Trash2 className="h-4 w-4 text-dead" aria-hidden="true" />}
      />

      <IcpDialog
        open={icpOpen}
        onClose={() => setIcpOpen(false)}
        onSave={onSaveIcp}
        prefs={icp}
        leadCount={leads.length}
      />
    </m.div>
  )
}
