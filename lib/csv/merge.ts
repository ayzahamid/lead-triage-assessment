import type { Lead } from '../types'
import { dedupeKey } from './ingest'

export interface MergeResult {
  leads: Lead[]
  added: number

  skipped: number

  enrichedInPlace: number
}

export function mergeLeads(existing: Lead[], incoming: Lead[]): MergeResult {
  const byKey = new Map<string, Lead>()
  for (const lead of existing) {
    const key = dedupeKey(lead)
    if (key && !byKey.has(key)) byKey.set(key, lead)
  }

  let nextIndex = existing.reduce((max, l) => {
    const n = Number.parseInt(l.id.replace(/^L/, ''), 10)
    return Number.isFinite(n) && n > max ? n : max
  }, 0)

  const merged = [...existing]
  let added = 0
  let skipped = 0
  let enrichedInPlace = 0

  const FILLABLE = [
    'contactName', 'title', 'email', 'domain', 'industry',
    'location', 'linkedin', 'phone', 'employees', 'revenue',
  ] as const satisfies ReadonlyArray<keyof Lead>

  for (const lead of incoming) {
    const key = dedupeKey(lead)
    const match = key ? byKey.get(key) : undefined

    if (match) {
      skipped++
      let filled = false
      for (const field of FILLABLE) {
        if (match[field] == null && lead[field] != null) {

          Object.assign(match, { [field]: lead[field] })
          filled = true
        }
      }

      match.raw = { ...lead.raw, ...match.raw }
      if (filled) enrichedInPlace++
      continue
    }

    const next: Lead = { ...lead, id: `L${String(++nextIndex).padStart(5, '0')}`, duplicateOf: null }
    merged.push(next)
    if (key) byKey.set(key, next)
    added++
  }

  return { leads: merged, added, skipped, enrichedInPlace }
}
