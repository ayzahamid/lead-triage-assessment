import { randomUUID } from 'node:crypto'
import type { AiInsight, Lead, Signal } from '../types'
import { PROVIDERS, type Provider, type ProviderId } from './providers'
import { callModel } from './transport'

const BATCH_CONCURRENCY = 4

export const BATCH_SIZE = 25

export const MAX_ENRICHED = BATCH_SIZE * BATCH_CONCURRENCY

const REQUEST_TIMEOUT_MS = 50_000

export type AiOutcome =
  | { ok: true; insights: Map<string, AiInsight>; batches: number }
  | { ok: false; reason: string; insights: Map<string, AiInsight>; batches: number }

const SIGNALS: readonly Signal[] = ['growth', 'stable', 'risk', 'unknown']

interface RawInsight { id?: unknown; fit?: unknown; signal?: unknown; reason?: unknown }

function coerce(raw: RawInsight): { id: string; insight: AiInsight } | null {
  const id = typeof raw.id === 'string' ? raw.id : typeof raw.id === 'number' ? String(raw.id) : null
  if (!id) return null
  const fitNum = Number(raw.fit)
  const fit = Number.isFinite(fitNum) ? Math.min(5, Math.max(1, Math.round(fitNum))) : 3
  const signalRaw = typeof raw.signal === 'string' ? raw.signal.toLowerCase() : ''
  const signal = (SIGNALS as readonly string[]).includes(signalRaw) ? (signalRaw as Signal) : 'unknown'
  const reason = typeof raw.reason === 'string' ? raw.reason.trim().slice(0, 140) : ''
  return { id, insight: { fit, signal, reason } }
}

function buildPrompt(leads: Lead[], icpSummary: string): string {
  const lines = leads.map((l) => {
    const bits = [
      `id=${l.id}`,
      l.companyName,
      l.title ?? 'unknown title',
      l.employees != null ? `${l.employees} staff` : 'size unknown',
      l.industry ?? 'industry unknown',
      l.revenue != null ? `$${Math.round(l.revenue / 1000)}k revenue` : 'revenue unknown',
    ]
    return bits.join(' | ')
  })
  return [
    'You assess B2B sales leads for an outbound team.',
    `Ideal customer profile: ${icpSummary}.`,
    'For each lead return an object with:',
    '  id     - the id exactly as given',
    '  fit    - integer 1 to 5, how well the lead matches the profile',
    '  signal - one of: growth, stable, risk, unknown',
    '  reason - at most 12 words, concrete, no filler',
    'Return only a JSON array, one object per lead, no prose.',
    '',
    'Leads:',
    ...lines,
  ].join('\n')
}

async function callBatch(
  leads: Lead[], icpSummary: string, apiKey: string, provider: Provider, model: string, sessionId: string,
): Promise<Map<string, AiInsight>> {
  const result = await callModel({
    provider, model, apiKey, sessionId,
    prompt: buildPrompt(leads, icpSummary),
    timeoutMs: REQUEST_TIMEOUT_MS,
  })
  if (!result.ok) throw new Error(result.reason)

  const out = new Map<string, AiInsight>()
  for (const item of result.items) {
    const c = coerce(item as RawInsight)
    if (c) out.set(c.id, c.insight)
  }
  return out
}

export interface EnrichOptions {
  apiKey: string
  providerId: ProviderId
  model: string

  limit?: number

  onlyIds?: Set<string>

  skipExisting?: boolean
  onProgress?: (done: number, total: number) => void
}

export async function enrichLeads(
  leads: Lead[],
  icpSummary: string,
  { apiKey, providerId, model, limit, onlyIds, skipExisting, onProgress }: EnrichOptions,
): Promise<AiOutcome> {
  const insights = new Map<string, AiInsight>()
  const provider = PROVIDERS[providerId]
  if (!apiKey) {
    return { ok: false, reason: 'Add your own API key to enable this.', insights, batches: 0 }
  }

  const cap = Math.min(limit ?? MAX_ENRICHED, MAX_ENRICHED)
  const candidates = [...leads]
    .filter((l) => {

      if (l.duplicateOf || l.verification?.status === 'undeliverable') return false
      if (onlyIds && !onlyIds.has(l.id)) return false
      if (skipExisting && l.ai) return false
      return true
    })
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
    .slice(0, cap)

  if (!candidates.length) return { ok: true, insights, batches: 0 }

  const sessionId = randomUUID()

  const batches: Lead[][] = []
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) batches.push(candidates.slice(i, i + BATCH_SIZE))

  let completed = 0
  let failure: string | null = null
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < batches.length && !failure) {
      const batch = batches[cursor++]
      if (!batch) continue
      try {
        const result = await callBatch(batch, icpSummary, apiKey, provider, model, sessionId)
        for (const [id, insight] of result) insights.set(id, insight)
        completed++
        onProgress?.(completed, batches.length)
      } catch (err) {

        failure ??= err instanceof Error ? err.message : `${provider.label} could not be reached.`
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(BATCH_CONCURRENCY, batches.length) }, worker),
  )

  if (failure) return { ok: false, reason: failure, insights, batches: completed }

  return { ok: true, insights, batches: completed }
}

export function describeIcp(min: number, max: number, industries: string[]): string {
  const size = `US SMBs with ${min}-${max} employees`
  return industries.length ? `${size} in ${industries.join(', ')}` : size
}
