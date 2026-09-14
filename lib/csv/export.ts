import type { Lead } from '../types'

export type ExportFormat = 'generic' | 'hubspot' | 'salesforce'

type Column = { header: string; value: (lead: Lead) => string }

const splitName = (full: string | null, part: 0 | 1): string => {
  if (!full) return ''
  const bits = full.trim().split(/\s+/)
  if (bits.length === 1) return part === 0 ? (bits[0] ?? '') : ''
  return part === 0 ? (bits[0] ?? '') : bits.slice(1).join(' ')
}

const num = (v: number | null): string => (v == null ? '' : String(v))

const TRIAGE_COLUMNS: Column[] = [
  { header: 'Deliverability', value: (l) => l.verification?.status ?? '' },
  { header: 'Email Confidence', value: (l) => (l.verification ? String(l.verification.confidence) : '') },
  { header: 'Mail Provider', value: (l) => l.verification?.provider ?? '' },
  { header: 'Priority Score', value: (l) => (l.score ? String(l.score.total) : '') },
  { header: 'Priority Tier', value: (l) => l.score?.tier ?? '' },
  { header: 'AI Fit', value: (l) => (l.ai ? String(l.ai.fit) : '') },
  { header: 'AI Signal', value: (l) => l.ai?.signal ?? '' },
  { header: 'AI Rationale', value: (l) => l.ai?.reason ?? '' },
]

const FORMATS: Record<ExportFormat, Column[]> = {
  generic: [
    { header: 'Company', value: (l) => l.companyName },
    { header: 'Contact Name', value: (l) => l.contactName ?? '' },
    { header: 'Job Title', value: (l) => l.title ?? '' },
    { header: 'Email', value: (l) => l.email ?? '' },
    { header: 'Domain', value: (l) => l.domain ?? '' },
    { header: 'Industry', value: (l) => l.industry ?? '' },
    { header: 'Employees', value: (l) => num(l.employees) },
    { header: 'Revenue', value: (l) => num(l.revenue) },
    { header: 'Location', value: (l) => l.location ?? '' },
    { header: 'LinkedIn', value: (l) => l.linkedin ?? '' },
    { header: 'Phone', value: (l) => l.phone ?? '' },
  ],

  hubspot: [
    { header: 'First Name', value: (l) => splitName(l.contactName, 0) },
    { header: 'Last Name', value: (l) => splitName(l.contactName, 1) },
    { header: 'Email', value: (l) => l.email ?? '' },
    { header: 'Job Title', value: (l) => l.title ?? '' },
    { header: 'Company Name', value: (l) => l.companyName },
    { header: 'Company Domain Name', value: (l) => l.domain ?? '' },
    { header: 'Phone Number', value: (l) => l.phone ?? '' },
    { header: 'Industry', value: (l) => l.industry ?? '' },
    { header: 'Number of Employees', value: (l) => num(l.employees) },
    { header: 'Annual Revenue', value: (l) => num(l.revenue) },
    { header: 'City', value: (l) => l.location ?? '' },
  ],

  salesforce: [
    { header: 'First Name', value: (l) => splitName(l.contactName, 0) },
    { header: 'Last Name', value: (l) => splitName(l.contactName, 1) || l.companyName },
    { header: 'Company', value: (l) => l.companyName },
    { header: 'Title', value: (l) => l.title ?? '' },
    { header: 'Email', value: (l) => l.email ?? '' },
    { header: 'Website', value: (l) => (l.domain ? `https://${l.domain}` : '') },
    { header: 'Phone', value: (l) => l.phone ?? '' },
    { header: 'Industry', value: (l) => l.industry ?? '' },
    { header: 'NumberOfEmployees', value: (l) => num(l.employees) },
    { header: 'AnnualRevenue', value: (l) => num(l.revenue) },
    { header: 'City', value: (l) => l.location ?? '' },
    { header: 'Lead Source', value: () => 'SaaSquatch Lead Triage' },
  ],
}

const FORMULA_LEAD = /^[=+\-@\t\r]/
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/

const neutralise = (v: string): string =>
  FORMULA_LEAD.test(v) && !PLAIN_NUMBER.test(v) ? `'${v}` : v

const escape = (raw: string): string => {
  const v = neutralise(raw)
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCsv(leads: Lead[], format: ExportFormat): string {
  const columns = [...(FORMATS[format] ?? FORMATS.generic), ...TRIAGE_COLUMNS]
  const head = columns.map((c) => escape(c.header)).join(',')
  const body = leads.map((l) => columns.map((c) => escape(c.value(l))).join(','))

  return `﻿${[head, ...body].join('\r\n')}`
}

export function exportFilename(format: ExportFormat, count: number): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return `leads-${format}-${count}-${stamp}.csv`
}
