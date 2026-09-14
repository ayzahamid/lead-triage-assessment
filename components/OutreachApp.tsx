'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { m } from 'motion/react'
import { Check, Copy, Mail, MessageSquare, ShieldCheck, Wand2 } from 'lucide-react'
import type { Lead } from '@/lib/types'
import type { Channel, Draft, Tone } from '@/lib/ai/outreach'
import { fmtInt, orText } from '@/lib/format'
import { riseItem, stagger } from '@/lib/motion'
import { Button, Spinner, StatusPill, TierBadge } from './ui'
import { ApiKeyDialog, readCredentials, type Credentials } from './ApiKeyDialog'
import { AppShell } from './AppShell'
import { getWorkspaceId } from '@/lib/workspace'

const MAX_PICK = 10

const TONES: Array<{ id: Tone; label: string; hint: string }> = [
  { id: 'professional', label: 'Professional', hint: 'Measured and businesslike' },
  { id: 'direct', label: 'Direct', hint: 'Short, plain, straight to the point' },
  { id: 'warm', label: 'Warm', hint: 'Friendly without being familiar' },
]

export function OutreachApp() {
  const [datasetId, setDatasetId] = useState('')

  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<Channel>('email')
  const [tone, setTone] = useState<Tone>('professional')
  const [sender, setSender] = useState('')
  const [offer, setOffer] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [creds, setCreds] = useState<Credentials>(() => ({ apiKey: '', providerId: 'gemini', model: '' }))
  const [keyOpen, setKeyOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    setCreds(readCredentials())
    setDatasetId(getWorkspaceId())
  }, [])

  useEffect(() => {
    if (!datasetId) return
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/datasets/${datasetId}/leads`)
      if (cancelled) return
      if (!res.ok) { setLeads([]); return }
      const body = (await res.json()) as { leads: Lead[] }
      if (!cancelled) setLeads(body.leads)
    })()
    return () => { cancelled = true }
  }, [datasetId])

  const reachable = useMemo(() => (leads ?? [])
    .filter((l) => !l.duplicateOf && l.email && l.verification && l.verification.status !== 'undeliverable')
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
    .slice(0, 60), [leads])

  const toggle = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_PICK) next.add(id)
      return next
    })
  }, [])

  const run = useCallback(async () => {
    if (!datasetId || picked.size === 0) return
    setBusy(true); setNote(null); setDrafts([])
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(creds.apiKey ? {
            'x-api-key': creds.apiKey,
            'x-api-provider': creds.providerId,
            'x-api-model': creds.model,
          } : {}),
        },
        body: JSON.stringify({ datasetId, ids: [...picked], channel, tone, sender, offer }),
      })
      const body = (await res.json()) as { drafts?: Draft[]; note?: string; error?: string }
      if (res.status === 428) { setKeyOpen(true); return }
      if (!res.ok) throw new Error(body.error ?? 'Could not write drafts.')
      setDrafts(body.drafts ?? [])
      if (body.note) setNote(body.note)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not write drafts.')
    } finally {
      setBusy(false)
    }
  }, [datasetId, picked, channel, tone, sender, offer, creds])

  const copy = useCallback(async (d: Draft) => {
    const text = d.subject ? `Subject: ${d.subject}\n\n${d.body}` : d.body
    try {
      await navigator.clipboard.writeText(text)
      setCopied(d.leadId)
      setTimeout(() => setCopied(null), 1600)
    } catch {}
  }, [])

  if (leads !== null && reachable.length === 0) {
    return (
      <AppShell libraryCount={leads.length || undefined} onOpenKey={() => setKeyOpen(true)}>
      <div className="mx-auto w-full max-w-2xl px-6 py-20">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Nothing to write to yet</h1>
        <p className="mt-2 max-w-[54ch] text-[14px] leading-relaxed text-muted">
          Drafts are written from verified, scored leads. Add a list in Triage and anything
          reachable will appear here.
        </p>
        <Link href="/" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13.5px] font-medium text-white hover:bg-accent-hi">
          Go to Triage
        </Link>
      </div>
      </AppShell>
    )
  }

  const byLead = new Map(drafts.map((d) => [d.leadId, d]))

  return (
    <AppShell libraryCount={leads?.length || undefined} onOpenKey={() => setKeyOpen(true)}>
    <m.div variants={stagger()} initial="initial" animate="animate" className="mx-auto w-full max-w-[88rem] px-5 py-7 sm:px-7">
      <m.header variants={riseItem}>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Write the first message</h1>
        <p className="mt-1 max-w-[62ch] text-[13.5px] text-muted">
          Only reachable leads appear here. Drafts use the firmographic facts already on the
          row and invent nothing else.
        </p>
      </m.header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <m.section variants={riseItem}>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium">Channel</legend>
              <div className="grid grid-cols-2 gap-2">
                {([['email', 'Email', Mail], ['linkedin', 'LinkedIn note', MessageSquare]] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={channel === id}
                    onClick={() => setChannel(id)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors duration-150 ${
                      channel === id ? 'border-accent bg-accent-wash' : 'border-line hover:border-faint'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="mb-2 text-[13px] font-medium">Tone</legend>
              <div className="space-y-1">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={tone === t.id}
                    onClick={() => setTone(t.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-1.5 text-left transition-colors duration-150 ${
                      tone === t.id ? 'border-accent bg-accent-wash' : 'border-line hover:border-faint'
                    }`}
                  >
                    <span className="flex-1">
                      <span className="block text-[13px] font-medium">{t.label}</span>
                      <span className="block text-[11.5px] text-muted">{t.hint}</span>
                    </span>
                    {tone === t.id ? <Check className="h-4 w-4 text-accent" aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-4">
              <label htmlFor="sender" className="mb-1.5 block text-[13px] font-medium">Who you are</label>
              <input
                id="sender" value={sender} onChange={(e) => setSender(e.target.value)}
                placeholder="Dana at Northwind Logistics"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-faint focus:border-accent"
              />
            </div>
            <div className="mt-3">
              <label htmlFor="offer" className="mb-1.5 block text-[13px] font-medium">What you offer</label>
              <textarea
                id="offer" value={offer} onChange={(e) => setOffer(e.target.value)} rows={3}
                placeholder="Fleet maintenance software that cuts downtime for mid-size carriers"
                className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-faint focus:border-accent"
              />
            </div>

            <Button
              variant="accent" className="mt-4 w-full" onClick={run}
              disabled={busy || picked.size === 0}
            >
              {busy ? <Spinner className="h-4 w-4" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
              {busy ? 'Writing…' : picked.size === 0 ? 'Pick leads below' : `Write ${fmtInt(picked.size)} draft${picked.size === 1 ? '' : 's'}`}
            </Button>
            {note ? (
              <p role="status" className="mt-3 rounded-lg bg-hold-wash px-3 py-2 text-[12.5px] text-hold">{note}</p>
            ) : null}

            <p className="mt-3 flex items-start gap-1.5 border-t border-line-soft pt-3 text-[11.5px] leading-relaxed text-muted">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-clear" aria-hidden="true" />
              <span>
                Sent to the model: company name, contact first name, role, size and industry.
                Never sent: the email address itself. Every draft is yours to edit before it
                goes anywhere.
              </span>
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold">Reachable leads</h2>
              <span className="fig text-[12px] text-muted">{fmtInt(picked.size)} of {MAX_PICK}</span>
            </div>
            <div className="max-h-[22rem] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
              {reachable.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-muted">
                  {leads ? 'No reachable leads in this list.' : 'Loading the list…'}
                </p>
              ) : reachable.map((l) => {
                const on = picked.has(l.id)
                const full = !on && picked.size >= MAX_PICK
                return (
                  <label
                    key={l.id}
                    className={`flex items-center gap-3 border-b border-line-soft px-4 py-2 text-[13px] last:border-b-0 ${full ? 'opacity-45' : 'cursor-pointer hover:bg-line-soft/60'}`}
                  >
                    <input
                      type="checkbox" checked={on} disabled={full}
                      onChange={() => toggle(l.id)}
                      className="h-3.5 w-3.5 shrink-0 rounded accent-[var(--color-accent)]"
                    />
                    {l.score ? <TierBadge tier={l.score.tier} /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.companyName}</span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {orText(l.contactName, 'No contact named')}{l.title ? `, ${l.title}` : ''}
                      </span>
                    </span>
                    {l.verification ? <StatusPill status={l.verification.status} /> : null}
                  </label>
                )
              })}
            </div>
          </div>
        </m.section>

        <m.section variants={riseItem} className="lg:sticky lg:top-7 lg:self-start">
          {drafts.length === 0 ? (
            <div className="flex min-h-[26rem] flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-16 text-center">
              <Wand2 className="h-6 w-6 text-faint" aria-hidden="true" />
              <p className="mt-3 text-[14px] font-medium">Drafts appear here</p>
              <p className="mt-1 max-w-[36ch] text-[12.5px] leading-relaxed text-muted">
                Pick leads, set a tone, and say what you offer. Every draft is editable before it is used.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...picked].map((id) => {
                const lead = reachable.find((l) => l.id === id)
                const draft = byLead.get(id)
                if (!lead || !draft) return null
                return (
                  <article key={id} className="rounded-xl border border-line bg-surface shadow-[var(--shadow-card)]">
                    <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                      <div className="min-w-0">
                        <h3 className="truncate text-[13.5px] font-semibold">{lead.companyName}</h3>
                        <p className="fig truncate text-[11.5px] text-muted" translate="no">{lead.email}</p>
                      </div>
                      <Button size="sm" onClick={() => void copy(draft)}>
                        {copied === id ? <Check className="h-3.5 w-3.5 text-clear" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                        {copied === id ? 'Copied' : 'Copy'}
                      </Button>
                    </header>
                    <div className="px-4 py-3">
                      {draft.subject ? (
                        <p className="mb-2 text-[13px]">
                          <span className="text-muted">Subject: </span>
                          <span className="font-medium">{draft.subject}</span>
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{draft.body}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </m.section>
      </div>

      <ApiKeyDialog
        open={keyOpen} initial={creds}
        onClose={() => setKeyOpen(false)}
        onSaved={(next) => { setCreds(next); setNote(null) }}
      />
    </m.div>
    </AppShell>
  )
}
