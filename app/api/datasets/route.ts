import { ingestCsv } from '@/lib/csv/ingest'
import { mergeLeads } from '@/lib/csv/merge'
import { getStore, type DatasetMeta } from '@/lib/store/index'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 12 * 1024 * 1024
const MAX_ROWS = 5000

export async function POST(request: Request): Promise<Response> {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Send the file as multipart/form-data.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: 'No file received. Attach a CSV under the field name “file”.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `That file is ${(file.size / 1e6).toFixed(1)} MB. Split it into chunks under 12 MB and upload again.` },
      { status: 413 },
    )
  }

  const text = await file.text()
  if (!text.trim()) {
    return Response.json({ error: 'That file is empty.' }, { status: 400 })
  }

  const { leads, headers, mapping, skipped, duplicateCount } = ingestCsv(text)

  if (!leads.length) {
    return Response.json(
      {
        error: 'No usable rows found. Every row needs at least a company name or an email address.',
        headers,
      },
      { status: 422 },
    )
  }
  if (leads.length > MAX_ROWS) {
    return Response.json(
      { error: `That file has ${leads.length} rows. This demo caps at ${MAX_ROWS}; split it and upload again.` },
      { status: 413 },
    )
  }

  const store = await getStore()

  const workspaceId = request.headers.get('x-workspace')?.trim()
  if (!workspaceId) return Response.json({ error: 'No workspace. Reload the page and try again.' }, { status: 400 })

  const existingMeta = await store.getDataset(workspaceId)
  const existingLeads = existingMeta ? await store.getLeads(workspaceId) : []
  const merge = mergeLeads(existingLeads, leads)

  const meta: DatasetMeta = {
    id: workspaceId,
    filename: file.name || 'upload.csv',
    createdAt: existingMeta?.createdAt ?? new Date().toISOString(),
    total: merge.leads.length,
    duplicateCount,
    skippedCount: skipped.length,
    mapping,
    processedAt: existingMeta?.processedAt ?? null,
    aiEnriched: existingMeta?.aiEnriched ?? 0,
    mergedDuplicates: (existingMeta?.mergedDuplicates ?? 0) + merge.skipped,
  }

  if (existingMeta) {
    await store.updateDatasetMeta(meta)
    await store.replaceLeads(workspaceId, merge.leads)
  } else {
    await store.createDataset(meta, merge.leads)
  }

  return Response.json({
    dataset: meta,
    leads: merge.leads,
    headers,
    skipped,
    storeKind: store.kind,
    merge: {
      added: merge.added,
      alreadyPresent: merge.skipped,
      enrichedInPlace: merge.enrichedInPlace,
      isFirstUpload: !existingMeta,
    },
  })
}
