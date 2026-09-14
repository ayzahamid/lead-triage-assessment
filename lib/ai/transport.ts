import type { Provider } from './providers'

function extractArray(text: string): unknown[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  if (!cleaned) return []
  try {
    const parsed: unknown = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') {

      for (const value of Object.values(parsed as Record<string, unknown>)) {
        if (Array.isArray(value)) return value
      }
    }
  } catch {}

  const first = cleaned.indexOf('[')
  const last = cleaned.lastIndexOf(']')
  if (first !== -1 && last > first) {
    try {
      const parsed: unknown = JSON.parse(cleaned.slice(first, last + 1))
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }
  return []
}

async function callGoogle(p: Provider, model: string, prompt: string, key: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(`${p.chatUrl(model)}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 8000,
        thinkingConfig: { thinkingLevel: 'low' },
      },
    }),
  })
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join('') ?? ''
}

interface ChatBody {
  model: string
  messages: Array<{ role: string; content: string }>
  temperature?: number
  max_tokens?: number
  max_completion_tokens?: number
  response_format?: { type: string }
}

function bodyVariants(model: string, prompt: string): ChatBody[] {
  const messages = [
    { role: 'system', content: 'You return only valid JSON. No prose, no markdown fences.' },
    { role: 'user', content: prompt },
  ]
  return [
    { model, messages, temperature: 0.2, max_tokens: 8000, response_format: { type: 'json_object' } },
    { model, messages, temperature: 0.2, max_tokens: 8000 },
    { model, messages, temperature: 0.2, max_completion_tokens: 8000 },
    { model, messages },
  ]
}

async function callOpenAiCompatible(
  p: Provider, model: string, prompt: string, key: string, signal: AbortSignal, sessionId: string,
): Promise<string> {
  let lastDetail = ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    ...(p.extraHeaders?.(sessionId) ?? {}),
  }

  for (const body of bodyVariants(model, prompt)) {
    const res = await fetch(p.chatUrl(model), {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>
      }
      const choice = data.choices?.[0]?.message

      const text = choice?.content?.trim() || choice?.reasoning_content?.trim() || ''

      if (extractArray(text).length > 0) return text
      lastDetail = text
        ? `the model returned no usable rows: ${text.slice(0, 120)}`
        : 'the model returned an empty response'
      continue
    }

    lastDetail = (await res.text().catch(() => '')).slice(0, 300)

    if (res.status !== 400 && res.status !== 422) {
      throw new Error(`${res.status}: ${lastDetail}`)
    }
  }

  throw new Error(`400: ${lastDetail}`)
}

export interface ModelCall {
  provider: Provider
  model: string
  prompt: string
  apiKey: string
  sessionId: string
  timeoutMs?: number
}

export type ModelResult =
  | { ok: true; items: unknown[] }
  | { ok: false; reason: string }

export const DEFAULT_TIMEOUT_MS = 210_000

export async function callModel(
  { provider, model, prompt, apiKey, sessionId, timeoutMs = DEFAULT_TIMEOUT_MS }: ModelCall,
): Promise<ModelResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const text = provider.protocol === 'google'
      ? await callGoogle(provider, model, prompt, apiKey, controller.signal)
      : await callOpenAiCompatible(provider, model, prompt, apiKey, controller.signal, sessionId)
    if (!text.trim()) return { ok: false, reason: `${provider.label} returned an empty response.` }
    return { ok: true, items: extractArray(text) }
  } catch (err) {
    return { ok: false, reason: describeFailure(err, provider) }
  } finally {
    clearTimeout(timer)
  }
}

function describeFailure(err: unknown, provider: Provider): string {
  const raw = err instanceof Error ? err.message : String(err)
  const where = provider.label

  if (/not supported|model.*not found|unknown model/i.test(raw) || raw.includes('404')) {
    return `That model is not available on your ${where} plan. Pick another from the list.`
  }
  if (raw.includes('429')) {
    return `Your ${where} key hit its rate limit. Wait a minute, or try again tomorrow if the daily quota is spent.`
  }
  if (raw.includes('402') || /credit|billing|insufficient/i.test(raw)) {
    return `Your ${where} account is out of credit.`
  }
  if (raw.includes('401') || raw.includes('403') || /invalid api key|unauthor/i.test(raw)) {
    return `That key was rejected by ${where}. Check it was copied in full.`
  }
  if (raw.includes('400') || raw.includes('422')) {

    const detail = upstreamMessage(raw)
    return detail
      ? `${where} rejected the request: ${detail}`
      : `${where} rejected the request. Try a different model.`
  }
  if (/abort/i.test(raw)) return 'The request timed out. Try again, or pick a faster model.'
  return `${where} could not be reached. Scoring is unaffected.`
}

function upstreamMessage(raw: string): string | null {
  const jsonStart = raw.indexOf('{')
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: { message?: string } | string
        message?: string
      }
      const msg = typeof parsed.error === 'string'
        ? parsed.error
        : parsed.error?.message ?? parsed.message
      if (msg) return msg.slice(0, 180)
    } catch {}
  }
  const text = raw.replace(/^\d{3}:\s*/, '').trim()
  if (!text || text.startsWith('<')) return null
  return text.slice(0, 180)
}
