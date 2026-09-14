import type { ColumnMapping } from '../types'

export const CANONICAL_FIELDS = [
  'companyName', 'contactName', 'title', 'email', 'domain',
  'industry', 'employees', 'revenue', 'location', 'linkedin', 'phone',
] as const

export type CanonicalField = (typeof CANONICAL_FIELDS)[number]

const ALIASES: Record<CanonicalField, string[]> = {
  companyName: ['companyname', 'company', 'organization', 'organisation', 'account', 'accountname', 'businessname', 'employer', 'firm'],
  contactName: ['contactname', 'fullname', 'name', 'person', 'leadname', 'prospect', 'contact'],
  title: ['title', 'jobtitle', 'jobfunction', 'position', 'role', 'designation', 'seniority', 'occupation'],
  email: ['email', 'emailaddress', 'workemail', 'businessemail', 'contactemail', 'mail', 'primaryemail'],
  domain: ['domain', 'website', 'companydomain', 'url', 'site', 'webaddress', 'homepage'],
  industry: ['industry', 'sector', 'vertical', 'category', 'naics', 'sic', 'businesstype'],
  employees: ['employees', 'employeecount', 'headcount', 'staff', 'companysize', 'size', 'numemployees', 'employeerange'],
  revenue: ['revenue', 'annualrevenue', 'turnover', 'sales', 'estimatedrevenue', 'revenuerange', 'arr'],
  location: ['location', 'city', 'address', 'country', 'state', 'region', 'geo', 'headquarters', 'hq'],
  linkedin: ['linkedin', 'linkedinurl', 'linkedinprofile', 'liurl', 'socialprofile'],
  phone: ['phone', 'phonenumber', 'telephone', 'mobile', 'directdial', 'contactnumber', 'tel'],
}

const normalise = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]/g, '')

export function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const taken = new Set<string>()
  const normalised = headers.map((h) => ({ raw: h, norm: normalise(h) }))

  for (const pass of ['exact', 'partial'] as const) {
    for (const field of CANONICAL_FIELDS) {
      if (mapping[field]) continue
      const aliases = ALIASES[field]
      const hit = normalised.find(({ raw, norm }) => {
        if (taken.has(raw) || !norm) return false
        return pass === 'exact'
          ? aliases.includes(norm)
          : aliases.some((a) => norm.includes(a) || a.includes(norm))
      })
      if (hit) {
        mapping[field] = hit.raw
        taken.add(hit.raw)
      }
    }
  }

  for (const field of CANONICAL_FIELDS) if (!(field in mapping)) mapping[field] = null
  return mapping
}

export function parseNumeric(value: string | undefined): number | null {
  if (!value) return null
  const cleaned = value.replace(/[,$\s]/g, '').toLowerCase()
  if (!cleaned || cleaned === '-' || cleaned === 'n/a' || cleaned === 'unknown') return null

  const range = cleaned.match(/^(\d+(?:\.\d+)?)[km]?(?:-|to)(\d+(?:\.\d+)?)([km]?)\+?$/)
  if (range?.[1] && range[2]) {
    const mult = range[3] === 'm' ? 1e6 : range[3] === 'k' ? 1e3 : 1
    return Math.round(((parseFloat(range[1]) + parseFloat(range[2])) / 2) * mult)
  }

  const single = cleaned.match(/^(\d+(?:\.\d+)?)([km])?\+?$/)
  if (single?.[1]) {
    const mult = single[2] === 'm' ? 1e6 : single[2] === 'k' ? 1e3 : 1
    return Math.round(parseFloat(single[1]) * mult)
  }
  return null
}

export function normaliseDomain(value: string | undefined): string | null {
  if (!value?.trim()) return null
  let host = value.trim().toLowerCase()
  host = host.replace(/^https?:\/\//, '').replace(/^www\./, '')
  const slash = host.indexOf('/')
  if (slash !== -1) host = host.slice(0, slash)
  host = host.split('?')[0] ?? host
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null
}
