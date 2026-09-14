import { exportFilename, toCsv, type ExportFormat } from '@/lib/csv/export'
import { getStore } from '@/lib/store/index'
import type { Deliverability, Lead, Tier } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params { params: Promise<{ id: string }> }

const FORMATS = new Set<ExportFormat>(['generic', 'hubspot', 'salesforce'])

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const { id } = await params
  const q = new URL(request.url).searchParams

  const formatParam = q.get('format') ?? 'generic'
  const format = (FORMATS.has(formatParam as ExportFormat) ? formatParam : 'generic') as ExportFormat

  const store = await getStore()
  const dataset = await store.getDataset(id)
  if (!dataset) return Response.json({ error: 'Dataset not found. Upload the file again.' }, { status: 404 })

  const tiers = new Set((q.get('tiers') ?? '').split(',').filter(Boolean) as Tier[])
  const statuses = new Set((q.get('statuses') ?? '').split(',').filter(Boolean) as Deliverability[])
  const minScore = Number(q.get('minScore') ?? '0')
  const excludeDuplicates = q.get('duplicates') === 'exclude'
  const search = (q.get('q') ?? '').trim().toLowerCase()

  const matches = (lead: Lead): boolean => {
    if (excludeDuplicates && lead.duplicateOf) return false
    if (tiers.size && (!lead.score || !tiers.has(lead.score.tier))) return false
    if (statuses.size && (!lead.verification || !statuses.has(lead.verification.status))) return false
    if (minScore > 0 && (lead.score?.total ?? 0) < minScore) return false
    if (search) {
      const hay = [lead.companyName, lead.contactName, lead.title, lead.email, lead.industry]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  }

  const leads = (await store.getLeads(id))
    .filter(matches)
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))

  const csv = toCsv(leads, format)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFilename(format, leads.length)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
