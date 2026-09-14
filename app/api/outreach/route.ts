import { draftOutreach, type Channel, type Tone } from '@/lib/ai/outreach'
import { DEFAULT_PROVIDER, PROVIDERS, isProviderId } from '@/lib/ai/providers'
import { getStore } from '@/lib/store/index'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_LEADS = 10

const CHANNELS = new Set<Channel>(['email', 'linkedin'])
const TONES = new Set<Tone>(['professional', 'direct', 'warm'])

export async function POST(request: Request): Promise<Response> {
  const apiKey = request.headers.get('x-api-key')?.trim() ?? ''
  if (!apiKey) {
    return Response.json(
      { error: 'Add your own API key to write drafts. It stays in this browser.' },
      { status: 428 },
    )
  }

  const headerProvider = request.headers.get('x-api-provider')
  const providerId = isProviderId(headerProvider) ? headerProvider : DEFAULT_PROVIDER
  const model = request.headers.get('x-api-model')?.trim() || PROVIDERS[providerId].defaultModel

  const body = (await request.json().catch(() => ({}))) as {
    datasetId?: string
    ids?: string[]
    channel?: string
    tone?: string
    sender?: string
    offer?: string
  }

  if (!body.datasetId) return Response.json({ error: 'No dataset selected.' }, { status: 400 })
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, MAX_LEADS) : []
  if (!ids.length) return Response.json({ error: 'Pick at least one lead to write for.' }, { status: 400 })

  const channel = (CHANNELS.has(body.channel as Channel) ? body.channel : 'email') as Channel
  const tone = (TONES.has(body.tone as Tone) ? body.tone : 'professional') as Tone

  const store = await getStore()
  const dataset = await store.getDataset(body.datasetId)
  if (!dataset) return Response.json({ error: 'Dataset not found. Upload the file again.' }, { status: 404 })

  const wanted = new Set(ids)
  const leads = (await store.getLeads(body.datasetId)).filter((l) => wanted.has(l.id))
  if (!leads.length) return Response.json({ error: 'Those leads are no longer in the dataset.' }, { status: 404 })

  const outcome = await draftOutreach(leads, {
    apiKey, providerId, model, channel, tone,
    sender: (body.sender ?? '').slice(0, 200),
    offer: (body.offer ?? '').slice(0, 400),
  })

  return Response.json({
    drafts: outcome.drafts,
    ok: outcome.ok,
    note: outcome.ok ? null : outcome.reason,
    provider: PROVIDERS[providerId].label,
    model,
    channel,
    tone,
  })
}
