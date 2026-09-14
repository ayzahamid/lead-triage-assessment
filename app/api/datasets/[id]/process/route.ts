import { judge, resolveDomain, type DomainFacts } from '@/lib/verify/engine'
import { scoreLead } from '@/lib/score/engine'
import { getStore } from '@/lib/store/index'
import { DEFAULT_ICP, type IcpConfig, type Lead } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Serverless ceiling: 60s is the Vercel Hobby maximum.
export const maxDuration = 60

const DNS_CONCURRENCY = 10

interface Params { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const { id } = await params
  const url = new URL(request.url)

  const icp: IcpConfig = {
    ...DEFAULT_ICP,
    employeesMin: Number(url.searchParams.get('min') ?? DEFAULT_ICP.employeesMin),
    employeesMax: Number(url.searchParams.get('max') ?? DEFAULT_ICP.employeesMax),
    targetIndustries: (url.searchParams.get('industries') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  }

  const store = await getStore()
  const dataset = await store.getDataset(id)
  if (!dataset) return Response.json({ error: 'Dataset not found. Upload the file again.' }, { status: 404 })

  const leads = await store.getLeads(id)
  if (!leads.length) return Response.json({ error: 'Dataset is empty.' }, { status: 404 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const send = (event: string, data: unknown): void => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      request.signal.addEventListener('abort', () => { closed = true })

      try {
        const byDomain = new Map<string, Lead[]>()
        for (const lead of leads) {
          if (!lead.domain) continue
          const bucket = byDomain.get(lead.domain)
          if (bucket) bucket.push(lead)
          else byDomain.set(lead.domain, [lead])
        }
        const domains = [...byDomain.keys()]

        send('start', {
          total: leads.length,
          uniqueDomains: domains.length,
          duplicates: dataset.duplicateCount,
          storeKind: store.kind,
        })

        const cached = await store.getCachedDomains(domains)
        const pending = domains.filter((d) => !cached.has(d))
        const facts = new Map<string, DomainFacts>(cached)
        send('cache', { hits: cached.size, toResolve: pending.length })

        const settled = new Set<string>()
        const finish = (lead: Lead): void => {
          lead.verification = judge(lead.email, lead.domain ? facts.get(lead.domain) ?? null : null)
          lead.score = scoreLead(lead, icp)
          settled.add(lead.id)
        }

        let done = 0
        for (const lead of leads) {
          if (!lead.domain) { finish(lead); done++ }
        }

        let cursor = 0
        const fresh = new Map<string, DomainFacts>()
        const worker = async (): Promise<void> => {
          while (cursor < pending.length && !closed) {
            const domain = pending[cursor++]
            if (!domain) continue
            const resolved = await resolveDomain(domain)
            facts.set(domain, resolved)
            fresh.set(domain, resolved)
            for (const lead of byDomain.get(domain) ?? []) { finish(lead); done++ }
            send('progress', { done, total: leads.length, domain })
          }
        }
        await Promise.all(Array.from({ length: Math.min(DNS_CONCURRENCY, pending.length) }, worker))

        for (const domain of domains) {
          if (fresh.has(domain)) continue
          for (const lead of byDomain.get(domain) ?? []) {
            if (!settled.has(lead.id)) { finish(lead); done++ }
          }
        }
        if (fresh.size) await store.cacheDomains(fresh)
        send('verified', { done, total: leads.length })

        const aiEnriched = 0

        await store.updateLeads(id, leads)
        await store.markProcessed(id, aiEnriched)
        send('complete', { leads, aiEnriched })
      } catch (err) {
        send('failed', { error: err instanceof Error ? err.message : 'Processing failed unexpectedly.' })
      } finally {
        closed = true
        try { controller.close() } catch {}
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',

      'X-Accel-Buffering': 'no',
    },
  })
}
