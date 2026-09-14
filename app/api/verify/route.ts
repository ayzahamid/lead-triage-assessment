import { judge, resolveMany } from '@/lib/verify/engine'
import { getStore } from '@/lib/store/index'
import { parseEmail } from '@/lib/verify/engine'
import type { VerificationResult } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const maxDuration = 60

const MAX_ADDRESSES = 500

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { input?: string }
  const raw = (body.input ?? '').trim()
  if (!raw) return Response.json({ error: 'Paste one or more email addresses to check.' }, { status: 400 })

  const candidates = [...new Set(
    raw.split(/[\s,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean),
  )]

  if (!candidates.length) return Response.json({ error: 'No addresses found in that text.' }, { status: 400 })
  if (candidates.length > MAX_ADDRESSES) {
    return Response.json(
      { error: `That is ${candidates.length} addresses. Check up to ${MAX_ADDRESSES} at a time, or upload a file on the Triage page.` },
      { status: 413 },
    )
  }

  const store = await getStore()
  const domains = [...new Set(
    candidates.map((c) => parseEmail(c)?.domain).filter((d): d is string => !!d),
  )]

  const cached = await store.getCachedDomains(domains)
  const pending = domains.filter((d) => !cached.has(d))
  const fresh = await resolveMany(pending)
  if (fresh.size) await store.cacheDomains(fresh)
  const facts = new Map([...cached, ...fresh])

  const results: Array<{ input: string; verification: VerificationResult }> = candidates.map((input) => {
    const domain = parseEmail(input)?.domain ?? null
    return { input, verification: judge(input, domain ? facts.get(domain) ?? null : null) }
  })

  return Response.json({
    results,
    checked: results.length,
    uniqueDomains: domains.length,
    fromCache: cached.size,
  })
}
