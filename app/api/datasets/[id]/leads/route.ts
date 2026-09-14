import { getStore } from '@/lib/store/index'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const { id } = await params
  const store = await getStore()

  const dataset = await store.getDataset(id)
  if (!dataset) return Response.json({ dataset: null, leads: [] })

  const leads = await store.getLeads(id)
  return Response.json({ dataset, leads })
}

export async function DELETE(_request: Request, { params }: Params): Promise<Response> {
  const { id } = await params
  const store = await getStore()
  await store.replaceLeads(id, [])
  return Response.json({ ok: true })
}
