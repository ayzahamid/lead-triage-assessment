import Papa from 'papaparse'
import type { ColumnMapping, Lead } from '../types'
import { guessMapping, normaliseDomain, parseNumeric } from './mapping'

export interface IngestResult {
  leads: Lead[]
  headers: string[]
  mapping: ColumnMapping

  skipped: Array<{ row: number; reason: string }>
  duplicateCount: number
}

const cell = (row: Record<string, string>, column: string | null | undefined): string | undefined => {
  if (!column) return undefined
  const v = row[column]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function dedupeKey(lead: Lead): string | null {
  if (lead.email) return `e:${lead.email.toLowerCase()}`
  if (lead.companyName && lead.contactName) {
    return `n:${lead.companyName.toLowerCase()}|${lead.contactName.toLowerCase()}`
  }
  return null
}

export function ingestCsv(text: string, overrides?: Partial<ColumnMapping>): IngestResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })

  const headers = parsed.meta.fields ?? []

  const mapping: ColumnMapping = guessMapping(headers)
  if (overrides) {
    for (const [field, column] of Object.entries(overrides)) {
      if (column !== undefined) mapping[field] = column
    }
  }
  const skipped: IngestResult['skipped'] = []
  const leads: Lead[] = []
  const seen = new Map<string, string>()
  let duplicateCount = 0

  parsed.data.forEach((row, i) => {
    const companyName = cell(row, mapping.companyName)
    const email = cell(row, mapping.email)?.toLowerCase()

    if (!companyName && !email) {
      skipped.push({ row: i + 2, reason: 'No company name and no email address' })
      return
    }

    const explicitDomain = normaliseDomain(cell(row, mapping.domain))
    const emailDomain = email?.includes('@') ? (email.split('@')[1] ?? null) : null

    const lead: Lead = {
      id: `L${String(i + 1).padStart(5, '0')}`,
      companyName: companyName ?? '(Unknown company)',
      contactName: cell(row, mapping.contactName) ?? null,
      title: cell(row, mapping.title) ?? null,
      email: email ?? null,
      domain: explicitDomain ?? emailDomain,
      industry: cell(row, mapping.industry) ?? null,
      employees: parseNumeric(cell(row, mapping.employees)),
      revenue: parseNumeric(cell(row, mapping.revenue)),
      location: cell(row, mapping.location) ?? null,
      linkedin: cell(row, mapping.linkedin) ?? null,
      phone: cell(row, mapping.phone) ?? null,
      raw: row,
      verification: null,
      score: null,
      ai: null,
      duplicateOf: null,
    }

    const key = dedupeKey(lead)
    if (key) {
      const original = seen.get(key)
      if (original) {
        lead.duplicateOf = original
        duplicateCount++
      } else {
        seen.set(key, lead.id)
      }
    }

    leads.push(lead)
  })

  return { leads, headers, mapping, skipped, duplicateCount }
}
