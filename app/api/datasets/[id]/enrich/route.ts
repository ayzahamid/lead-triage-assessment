import { describeIcp, enrichLeads, MAX_ENRICHED } from '@/lib/ai/enrich'
import { DEFAULT_PROVIDER, PROVIDERS, isProviderId } from '@/lib/ai/providers'
import { getStore } from '@/lib/store/index'
import { DEFAULT_ICP } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const maxDuration = 60

interface Params { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { id } = await params
  const store = await getStore()

  const dataset = await store.getDataset(id)
  if (!dataset) return Response.json({ error: 'Dataset not found. Upload the file again.' }, { status: 404 })

  const leads = await store.getLeads(id)
  if (!leads.length) return Response.json({ error: 'Dataset is empty.' }, { status: 404 })

  const apiKey = request.headers.get('x-api-key')?.trim() ?? ''
  if (!apiKey) {
    return Response.json(
      { error: 'Add your own API key to enable added context. It stays in this browser.' },
      { status: 428 },
    )
  }

  const headerProvider = request.headers.get('x-api-provider')
  const providerId = isProviderId(headerProvider) ? headerProvider : DEFAULT_PROVIDER
  const model = request.headers.get('x-api-model')?.trim() || PROVIDERS[providerId].defaultModel

  const body = (await request.json().catch(() => ({}))) as {
    limit?: number
    ids?: string[]
    skipExisting?: boolean
    icp?: { employeesMin?: number; employeesMax?: number; targetIndustries?: string[] }
  }
  const limit = Number.isFinite(body.limit) ? Math.max(1, Math.min(MAX_ENRICHED, Number(body.limit))) : undefined
  const onlyIds = Array.isArray(body.ids) && body.ids.length ? new Set(body.ids) : undefined
  const skipExisting = body.skipExisting !== false

  const min = Number.isFinite(body.icp?.employeesMin) ? Number(body.icp?.employeesMin) : DEFAULT_ICP.employeesMin
  const max = Number.isFinite(body.icp?.employeesMax) ? Number(body.icp?.employeesMax) : DEFAULT_ICP.employeesMax
  const industries = Array.isArray(body.icp?.targetIndustries)
    ? body.icp!.targetIndustries.map(String).map((s) => s.trim()).filter(Boolean)
    : DEFAULT_ICP.targetIndustries
  const summary = describeIcp(min, max, industries)

  const icpKey = `${min}-${max}:${industries.map((s) => s.toLowerCase()).sort().join('+')}`
  const scopedKey = (domain: string): string => `${domain}#${icpKey}`

  const domains = [...new Set(leads.map((l) => l.domain).filter((d): d is string => !!d))]
  const cached = await store.getCachedInsights(domains.map(scopedKey))
  for (const lead of leads) {
    if (!lead.ai && lead.domain) {
      const hit = cached.get(scopedKey(lead.domain))
      if (hit) lead.ai = hit
    }
  }

  const outcome = await enrichLeads(leads, summary, { apiKey, providerId, model, limit, onlyIds, skipExisting })
  let enriched = 0
  const toCache = new Map<string, typeof outcome.insights extends Map<string, infer V> ? V : never>()
  for (const lead of leads) {
    const insight = outcome.insights.get(lead.id)
    if (insight) {
      lead.ai = insight
      enriched++
      if (lead.domain && !toCache.has(scopedKey(lead.domain))) toCache.set(scopedKey(lead.domain), insight)
    }
  }

  if (toCache.size) await store.cacheInsights(toCache)
  await store.updateLeads(id, leads)
  await store.markProcessed(id, enriched)

  return Response.json({
    leads,
    enriched,
    cap: MAX_ENRICHED,
    provider: PROVIDERS[providerId].label,
    model,
    ok: outcome.ok,
    note: outcome.ok ? null : outcome.reason,
  })
}
