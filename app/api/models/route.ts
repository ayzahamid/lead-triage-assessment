import { PROVIDERS, familyOf, isProviderId, rankModel } from '@/lib/ai/providers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const providerId = url.searchParams.get('provider')
  if (!isProviderId(providerId)) {
    return Response.json({ error: 'Unknown provider.' }, { status: 400 })
  }

  const provider = PROVIDERS[providerId]
  const key = request.headers.get('x-api-key')?.trim() ?? ''
  if (provider.modelsNeedKey && !key) {
    return Response.json({ models: [], needsKey: true })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const endpoint = provider.protocol === 'google'
      ? `${provider.modelsUrl}?key=${encodeURIComponent(key)}`
      : provider.modelsUrl

    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: provider.protocol === 'openai' && key ? { Authorization: `Bearer ${key}` } : {},
    })

    if (!res.ok) {
      const status = res.status
      const reason = status === 401 || status === 403
        ? `That key was rejected by ${provider.label}.`
        : `${provider.label} did not return a model list.`
      return Response.json({ models: [], error: reason }, { status: 200 })
    }

    const body = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
      data?: Array<{ id?: string }>
    }

    const raw: string[] = provider.protocol === 'google'
      ? (body.models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => (m.name ?? '').replace(/^models\//, ''))
      : (body.data ?? []).map((m) => m.id ?? '')

    const models = raw
      .filter((id) => id && !provider.excludes.test(id))
      .sort((a, b) => rankModel(a) - rankModel(b) || a.localeCompare(b))
      .map((id) => ({ id, family: familyOf(id) }))

    return Response.json({ models, defaultModel: provider.defaultModel })
  } catch {
    return Response.json({ models: [], error: `Could not reach ${provider.label}.` }, { status: 200 })
  } finally {
    clearTimeout(timer)
  }
}
