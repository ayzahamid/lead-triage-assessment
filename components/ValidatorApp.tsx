'use client'

import { useCallback, useState } from 'react'
import { m } from 'motion/react'
import { ClipboardPaste, Download } from 'lucide-react'
import type { Deliverability, VerificationResult } from '@/lib/types'
import { STATUS_MEANING, fmtInt, fmtPct } from '@/lib/format'
import { riseItem, stagger } from '@/lib/motion'
import { Button, Spinner, StatusPill } from './ui'
import { AppShell } from './AppShell'
import { DeliverabilityBar, STATUS_ICON } from './charts'
import { InfoTip } from './InfoTip'
import { VERDICT_EXPLAINER } from '@/lib/explainers'

interface Row { input: string; verification: VerificationResult }

function dominantReason(v: VerificationResult): string | null {
  const negatives = v.reasons.filter((r) => r.weight < 0)
  if (!negatives.length) return null
  const worst = [...negatives].sort((a, b) => a.weight - b.weight)[0]
  return worst?.label ?? null
}

const SAMPLE = `jane.doe@stripe.com
sales@shopify.com
someone@gmail.com
test@mailinator.com
nobody@this-domain-does-not-exist-zzq.com
not-an-email`

export function ValidatorApp() {
  const [input, setInput] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [stats, setStats] = useState<{ uniqueDomains: number; fromCache: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      const body = (await res.json()) as { results?: Row[]; error?: string; uniqueDomains?: number; fromCache?: number }
      if (!res.ok || !body.results) throw new Error(body.error ?? 'Could not check those addresses.')
      setRows(body.results)
      setStats({ uniqueDomains: body.uniqueDomains ?? 0, fromCache: body.fromCache ?? 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check those addresses.')
      setRows(null)
    } finally {
      setBusy(false)
    }
  }, [input])

  const counts = rows?.reduce<Record<Deliverability, number>>(
    (acc, r) => { acc[r.verification.status]++; return acc },
    { deliverable: 0, risky: 0, undeliverable: 0, unknown: 0 },
  )

  const download = useCallback(() => {
    if (!rows) return
    const head = 'Email,Deliverability,Confidence,Mail Provider,Reason'
    const body = rows.map((r) => {
      const v = r.verification
      const reason = v.reasons.map((x) => x.label).join('; ').replace(/"/g, '""')
      return `${r.input},${v.status},${v.confidence},"${v.provider ?? ''}","${reason}"`
    })
    const blob = new Blob([`﻿${[head, ...body].join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `validated-${rows.length}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [rows])

  return (
    <AppShell>
    <m.div variants={stagger()} initial="initial" animate="animate" className="mx-auto w-full max-w-[60rem] px-5 py-8 sm:px-7">
      <m.header variants={riseItem}>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Check addresses before you send</h1>
        <p className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-muted">
          Paste any list. Each address is checked against live DNS, the same way the full
          pipeline does it, with no file and nothing stored.
        </p>
      </m.header>

      <m.div variants={riseItem} className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div>
          <label htmlFor="addresses" className="mb-1.5 block text-[13px] font-medium">Addresses</label>
          <textarea
            id="addresses"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            rows={10}
            placeholder={'One per line, or separated by commas…'}
            className="fig w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed placeholder:text-faint focus:border-accent"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="accent" onClick={run} disabled={busy || !input.trim()}>
              {busy ? <Spinner className="h-4 w-4" /> : null}
              {busy ? 'Checking…' : 'Check Addresses'}
            </Button>
            <Button onClick={() => setInput(SAMPLE)} disabled={busy}>
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              Use an example
            </Button>
          </div>
          {error ? (
            <p role="alert" className="mt-3 rounded-lg bg-dead-wash px-3.5 py-2.5 text-[13px] text-dead">{error}</p>
          ) : null}
        </div>

        <div>
          {rows && counts ? (
            <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold">
                  <span className="fig">{fmtInt(rows.length)}</span> checked
                </h2>
                <p className="text-[12px] text-muted">
                  <span className="fig">{fmtInt(stats?.uniqueDomains ?? 0)}</span> domains,{' '}
                  <span className="fig">{fmtInt(stats?.fromCache ?? 0)}</span> reused from cache
                </p>
              </div>
              <div className="mt-3">
                <DeliverabilityBar counts={counts} total={rows.length} />
              </div>
              {counts.undeliverable > 0 ? (
                <p className="mt-3 border-t border-line-soft pt-2.5 text-[12.5px] text-dead">
                  <span className="fig font-semibold">{fmtPct(counts.undeliverable / rows.length)}</span> of
                  this list would bounce.
                </p>
              ) : null}
              <Button size="sm" className="mt-3" onClick={download}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download results
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
              <p className="text-[13px] text-muted">Results appear here.</p>
              <p className="mt-1 text-[12px] text-faint">Nothing is uploaded or retained.</p>
            </div>
          )}
        </div>
      </m.div>

      {rows ? (
        <m.section variants={riseItem} className="mt-6 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-[minmax(0,1.6fr)_7.5rem_4.5rem_minmax(0,1.4fr)] items-center gap-4 border-b border-line bg-line-soft/60 px-4 py-2 text-[11.5px] font-medium text-muted">
            <span>Address</span>
            <span className="flex items-center gap-1">
              Verdict
              <InfoTip label="How deliverability is decided">{VERDICT_EXPLAINER}</InfoTip>
            </span>
            <span className="text-right">Conf.</span>
            <span>Why</span>
          </div>
          {rows.map((r) => {
            const Icon = STATUS_ICON[r.verification.status]
            return (
              <div key={r.input} className="grid grid-cols-[minmax(0,1.6fr)_7.5rem_4.5rem_minmax(0,1.4fr)] items-center gap-4 border-b border-line-soft px-4 py-2.5 text-[13px] last:border-b-0">
                <span className="fig min-w-0 truncate" translate="no">{r.input}</span>
                <span><StatusPill status={r.verification.status} /></span>
                <span className="fig text-right text-muted">{r.verification.confidence}</span>
                <span className="min-w-0 truncate text-[12.5px] text-muted" title={r.verification.reasons.map((x) => x.label).join('; ')}>
                  <Icon className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
                  {dominantReason(r.verification) ?? STATUS_MEANING[r.verification.status]}
                </span>
              </div>
            )
          })}
        </m.section>
      ) : null}
    </m.div>
    </AppShell>
  )
}
