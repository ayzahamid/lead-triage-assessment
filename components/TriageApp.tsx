'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lead } from '@/lib/types'
import { UploadPane } from './UploadPane'
import { ProgressPane, type ProgressState } from './ProgressPane'
import { ResultsPane, type Filters } from './ResultsPane'
import type { EnrichRequest } from './EnrichDialog'
import { ApiKeyDialog, readCredentials, type Credentials } from './ApiKeyDialog'
import { DEFAULT_PROVIDER, PROVIDERS } from '@/lib/ai/providers'
import { getWorkspaceId } from '@/lib/workspace'
import { DEFAULT_PREFS, icpParams, readIcp, writeIcp, type IcpPrefs } from '@/lib/icp'
import { AppShell } from './AppShell'

type Phase = 'idle' | 'uploading' | 'processing' | 'results'

const EMPTY_FILTERS: Filters = { tiers: [], statuses: [], minScore: 0, excludeDuplicates: false, query: '' }

const INITIAL_PROGRESS: ProgressState = {
  phase: 'starting', done: 0, total: 0, uniqueDomains: 0, cacheHits: 0,
  aiBatch: 0, aiBatches: 0, lastDomain: null,
}

function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.tiers.length) p.set('tiers', f.tiers.join(','))
  if (f.statuses.length) p.set('statuses', f.statuses.join(','))
  if (f.minScore > 0) p.set('minScore', String(f.minScore))
  if (f.excludeDuplicates) p.set('duplicates', 'exclude')
  if (f.query.trim()) p.set('q', f.query.trim())
  return p
}

function filtersFromSearch(search: string): Filters {
  const p = new URLSearchParams(search)
  return {
    tiers: (p.get('tiers') ?? '').split(',').filter(Boolean) as Filters['tiers'],
    statuses: (p.get('statuses') ?? '').split(',').filter(Boolean) as Filters['statuses'],
    minScore: Number(p.get('minScore') ?? 0) || 0,
    excludeDuplicates: p.get('duplicates') === 'exclude',
    query: p.get('q') ?? '',
  }
}

export function TriageApp() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [filename, setFilename] = useState('')
  const [datasetId, setDatasetId] = useState('')
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressState>(INITIAL_PROGRESS)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [enriching, setEnriching] = useState(false)
  const [creds, setCreds] = useState<Credentials>(() => ({ apiKey: '', providerId: DEFAULT_PROVIDER, model: '' }))
  const [keyOpen, setKeyOpen] = useState(false)
  const [mergeNote, setMergeNote] = useState<string | null>(null)
  const [mergedDuplicates, setMergedDuplicates] = useState(0)
  const [icp, setIcp] = useState<IcpPrefs>(DEFAULT_PREFS)
  const abortRef = useRef<AbortController | null>(null)

  const icpRef = useRef<IcpPrefs>(DEFAULT_PREFS)

  useEffect(() => {
    setFilters(filtersFromSearch(window.location.search))
    setCreds(readCredentials())
    const stored = readIcp()
    setIcp(stored)
    icpRef.current = stored

    const id = getWorkspaceId()
    setDatasetId(id)

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/datasets/${id}/leads`)
        if (!res.ok || cancelled) return
        const body = (await res.json()) as {
          dataset: { filename: string; mergedDuplicates?: number } | null
          leads: Lead[]
        }
        if (cancelled || !body.leads.length || !body.dataset) return
        setFilename(body.dataset.filename)
        setMergedDuplicates(body.dataset.mergedDuplicates ?? 0)
        setLeads(body.leads)
        setPhase('results')
      } catch {

      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (phase !== 'results') return
    const next = filtersToParams(filters)
    const current = new URLSearchParams(window.location.search)
    for (const key of ['page', 'rows'] as const) {
      const value = current.get(key)
      if (value) next.set(key, value)
    }
    const qs = next.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [filters, phase])

  useEffect(() => () => abortRef.current?.abort(), [])

  const runPipeline = useCallback(async (id: string) => {
    setPhase('processing')
    setProgress(INITIAL_PROGRESS)
    const controller = new AbortController()
    abortRef.current = controller

    try {

      const res = await fetch(`/api/datasets/${id}/process?${icpParams(icpRef.current)}`, {
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Processing failed. Upload the file again.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          const evLine = frame.split('\n').find((l) => l.startsWith('event: '))
          const dataLine = frame.split('\n').find((l) => l.startsWith('data: '))
          if (!evLine || !dataLine) continue
          const event = evLine.slice(7).trim()
          const data = JSON.parse(dataLine.slice(6)) as Record<string, never>

          switch (event) {
            case 'start':
              setProgress((p) => ({ ...p, phase: 'verifying', total: Number(data.total), uniqueDomains: Number(data.uniqueDomains) }))
              break
            case 'cache':
              setProgress((p) => ({ ...p, cacheHits: Number(data.hits) }))
              break
            case 'progress':
              setProgress((p) => ({ ...p, done: Number(data.done), lastDomain: String(data.domain) }))
              break
            case 'verified':
              setProgress((p) => ({ ...p, done: Number(data.done), phase: 'enriching' }))
              break
            case 'ai_progress':
              setProgress((p) => ({ ...p, aiBatch: Number(data.batch), aiBatches: Number(data.total) }))
              break
            case 'ai_done':
              setProgress((p) => ({ ...p, phase: 'saving' }))
              if (data.note) setAiNote(String(data.note))
              break
            case 'complete':
              setLeads(data.leads as unknown as Lead[])
              if (data.aiNote) setAiNote(String(data.aiNote))
              setPhase('results')
              break
            case 'failed':
              throw new Error(String(data.error))
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Processing failed unexpectedly.')
      setPhase('idle')
    }
  }, [])

  const upload = useCallback(async (file: File) => {
    setError(null)
    setAiNote(null)
    setPhase('uploading')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/datasets', {
        method: 'POST',
        body: form,
        headers: { 'x-workspace': getWorkspaceId() },
      })
      const body = (await res.json()) as {
        dataset?: { id: string; filename: string }
        merge?: { added: number; alreadyPresent: number; isFirstUpload: boolean }
        error?: string
      }
      if (!res.ok || !body.dataset) throw new Error(body.error ?? 'Upload failed. Check the file and try again.')
      setDatasetId(body.dataset.id)
      setFilename(body.dataset.filename)

      if (body.merge && body.merge.alreadyPresent > 0) {
        setMergeNote(
          `Added ${body.merge.added} lead${body.merge.added === 1 ? '' : 's'}. ` +
          `${body.merge.alreadyPresent} repeat row${body.merge.alreadyPresent === 1 ? ' was' : 's were'} ` +
          `${body.merge.isFirstUpload ? 'merged, so each contact appears once.' : 'already in your library.'}`,
        )
      }
      setMergedDuplicates((n) => n + (body.merge?.alreadyPresent ?? 0))
      await runPipeline(body.dataset.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed unexpectedly.')
      setPhase('idle')
    }
  }, [runPipeline])

  const loadSample = useCallback(async () => {
    setError(null)
    setPhase('uploading')
    try {
      const res = await fetch('/sample-leads.csv')
      if (!res.ok) throw new Error('Sample dataset is unavailable. Upload your own CSV instead.')
      const blob = await res.blob()
      await upload(new File([blob], 'sample-leads.csv', { type: 'text/csv' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the sample dataset.')
      setPhase('idle')
    }
  }, [upload])

  const enrich = useCallback(async (req: EnrichRequest, visibleIds: string[]) => {
    if (!datasetId) return
    const limit = req.scope === 'top25' ? 25 : req.scope === 'top50' ? 50 : 100
    const payload = {
      limit,
      skipExisting: req.skipExisting,

      ids: req.scope === 'filtered' ? visibleIds.slice(0, 100) : undefined,

      icp: icpRef.current,
    }
    setEnriching(true)
    setAiNote(null)
    try {
      const res = await fetch(`/api/datasets/${datasetId}/enrich`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: creds.apiKey
          ? {
              'x-api-key': creds.apiKey,
              'x-api-provider': creds.providerId,
              'x-api-model': creds.model,
              'Content-Type': 'application/json',
            }
          : { 'Content-Type': 'application/json' },
      })
      const body = (await res.json()) as { leads?: Lead[]; note?: string | null; error?: string }
      if (res.status === 428) { setKeyOpen(true); setEnriching(false); return }
      if (!res.ok || !body.leads) throw new Error(body.error ?? 'Enrichment failed.')
      setLeads(body.leads)
      if (body.note) setAiNote(body.note)
    } catch (err) {
      setAiNote(err instanceof Error ? err.message : 'Enrichment failed unexpectedly.')
    } finally {
      setEnriching(false)
    }
  }, [datasetId, creds])

  const exportCsv = useCallback((format: 'generic' | 'hubspot' | 'salesforce') => {
    const params = filtersToParams(filters)
    params.set('format', format)

    window.location.href = `/api/datasets/${datasetId}/export?${params.toString()}`
  }, [datasetId, filters])

  const saveIcp = useCallback((next: IcpPrefs) => {
    writeIcp(next)
    setIcp(next)
    icpRef.current = next
    if (datasetId && leads.length > 0) void runPipeline(datasetId)
  }, [datasetId, leads.length, runPipeline])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    void fetch(`/api/datasets/${getWorkspaceId()}/leads`, { method: 'DELETE' }).catch(() => {})
    setPhase('idle'); setLeads([]); setFilters(EMPTY_FILTERS)
    setAiNote(null); setError(null); setMergeNote(null); setFilename(''); setMergedDuplicates(0)
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  return (
    <AppShell libraryCount={leads.length || undefined} onOpenKey={() => setKeyOpen(true)}>
      {phase === 'idle' || phase === 'uploading' ? (
        <UploadPane
          onUpload={upload}
          onLoadSample={loadSample}
          busy={phase === 'uploading'}
          error={error}
          note={mergeNote}
        />
      ) : phase === 'processing' ? (
        <ProgressPane state={progress} />
      ) : (
        <ResultsPane
          leads={leads}
          filters={filters}
          setFilters={setFilters}
          onExport={exportCsv}
          onReset={reset}
          onEnrich={enrich}
          enriching={enriching}
          providerId={creds.providerId}
          model={creds.model || PROVIDERS[creds.providerId].defaultModel}
          onOpenKey={() => setKeyOpen(true)}
          hasKey={creds.apiKey.length > 0}
          aiNote={aiNote}
          filename={filename}
          mergedDuplicates={mergedDuplicates}
          icp={icp}
          onSaveIcp={saveIcp}
        />
      )}

      <ApiKeyDialog
        open={keyOpen}
        initial={creds}
        onClose={() => setKeyOpen(false)}
        onSaved={(next) => { setCreds(next); setAiNote(null) }}
      />
    </AppShell>
  )
}
