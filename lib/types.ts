export type Deliverability = 'deliverable' | 'risky' | 'undeliverable' | 'unknown'
export type Tier = 'A' | 'B' | 'C' | 'D'
export type Signal = 'growth' | 'stable' | 'risk' | 'unknown'

export interface VerificationReason {
  code: string
  label: string

  weight: number
}

export interface VerificationResult {
  status: Deliverability

  confidence: number
  reasons: VerificationReason[]

  provider: string | null

  catchAll: boolean
  mxHosts: string[]
  checkedAt: string
}

export interface ScoreDimension {
  key: string
  label: string

  points: number

  max: number
  detail: string
}

export interface ScoreResult {
  total: number
  tier: Tier
  dimensions: ScoreDimension[]
}

export interface AiInsight {
  fit: number
  signal: Signal
  reason: string
}

export interface Lead {
  id: string
  companyName: string
  contactName: string | null
  title: string | null
  email: string | null
  domain: string | null
  industry: string | null
  employees: number | null
  revenue: number | null
  location: string | null
  linkedin: string | null
  phone: string | null

  raw: Record<string, string>
  verification: VerificationResult | null
  score: ScoreResult | null
  ai: AiInsight | null
  duplicateOf: string | null
}

export interface IcpConfig {
  employeesMin: number
  employeesMax: number
  targetIndustries: string[]
  weights: { authority: number; size: number; revenue: number; contactability: number; industry: number }
}

export const DEFAULT_ICP: IcpConfig = {
  employeesMin: 10,
  employeesMax: 250,
  targetIndustries: [],
  weights: { authority: 30, size: 25, revenue: 20, contactability: 15, industry: 10 },
}

export interface DatasetSummary {
  total: number
  deliverable: number
  risky: number
  undeliverable: number
  unknown: number
  duplicates: number
  tiers: Record<Tier, number>

  bounceRateAvoided: number
  aiEnriched: number
}

export interface ColumnMapping {
  [canonicalField: string]: string | null
}
