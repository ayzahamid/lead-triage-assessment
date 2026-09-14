import type { IcpConfig, Lead, ScoreDimension, ScoreResult, Tier } from '../types'

const AUTHORITY_LADDER: Array<{ patterns: string[]; share: number; label: string }> = [
  { share: 1.00, label: 'Owner or founder', patterns: ['owner', 'founder', 'co-founder', 'proprietor', 'principal', 'partner'] },
  { share: 0.95, label: 'Chief executive', patterns: ['ceo', 'chief executive', 'managing director', 'president', 'general manager'] },
  { share: 0.85, label: 'C-suite', patterns: ['cfo', 'coo', 'cto', 'cio', 'cmo', 'chief '] },
  { share: 0.70, label: 'Vice president', patterns: ['vp ', 'vice president', 'svp', 'evp', 'head of'] },
  { share: 0.55, label: 'Director', patterns: ['director'] },
  { share: 0.40, label: 'Manager', patterns: ['manager', 'supervisor', 'lead '] },
  { share: 0.20, label: 'Individual contributor', patterns: ['engineer', 'analyst', 'specialist', 'coordinator', 'associate', 'representative'] },
  { share: 0.05, label: 'Junior or temporary', patterns: ['intern', 'trainee', 'apprentice', 'assistant', 'junior'] },
]

function scoreAuthority(title: string | null, max: number): ScoreDimension {
  const base = { key: 'authority', label: 'Decision-maker authority', max }
  if (!title?.trim()) return { ...base, points: Math.round(max * 0.15), detail: 'No job title on the record' }
  const t = title.toLowerCase()

  const junior = AUTHORITY_LADDER[AUTHORITY_LADDER.length - 1]!
  if (junior.patterns.some((p) => t.includes(p))) {
    return { ...base, points: Math.round(max * junior.share), detail: junior.label }
  }
  for (const rung of AUTHORITY_LADDER) {
    if (rung.patterns.some((p) => t.includes(p))) {
      return { ...base, points: Math.round(max * rung.share), detail: rung.label }
    }
  }
  return { ...base, points: Math.round(max * 0.25), detail: 'Title not recognised' }
}

function scoreSize(employees: number | null, icp: IcpConfig, max: number): ScoreDimension {
  const base = { key: 'size', label: 'Company size fit', max }
  if (employees == null) return { ...base, points: Math.round(max * 0.3), detail: 'Employee count unknown' }
  const { employeesMin: lo, employeesMax: hi } = icp
  if (employees >= lo && employees <= hi) {
    return { ...base, points: max, detail: `${employees} staff — inside the ${lo}–${hi} target` }
  }

  const distance = employees < lo ? (lo - employees) / Math.max(lo, 1) : (employees - hi) / Math.max(hi, 1)
  const share = Math.max(0, 1 - Math.min(distance, 1))
  const side = employees < lo ? 'below' : 'above'
  return { ...base, points: Math.round(max * share * 0.6), detail: `${employees} staff — ${side} the ${lo}–${hi} target` }
}

function scoreRevenue(revenue: number | null, max: number): ScoreDimension {
  const base = { key: 'revenue', label: 'Revenue signal', max }
  if (revenue == null || revenue <= 0) return { ...base, points: Math.round(max * 0.3), detail: 'Revenue not reported' }
  const millions = revenue / 1_000_000
  const fmt = millions >= 1 ? `$${millions.toFixed(1)}M` : `$${Math.round(revenue / 1000)}K`
  if (millions >= 1 && millions <= 50) return { ...base, points: max, detail: `${fmt} — core acquisition range` }
  if (millions > 50 && millions <= 200) return { ...base, points: Math.round(max * 0.6), detail: `${fmt} — above core range` }
  if (millions > 200) return { ...base, points: Math.round(max * 0.2), detail: `${fmt} — enterprise, outside thesis` }
  return { ...base, points: Math.round(max * 0.45), detail: `${fmt} — below core range` }
}

function scoreContactability(lead: Lead, max: number): ScoreDimension {
  const base = { key: 'contactability', label: 'Contactability', max }
  const v = lead.verification
  if (!v) return { ...base, points: Math.round(max * 0.5), detail: 'Not yet verified' }
  switch (v.status) {
    case 'deliverable':
      return { ...base, points: Math.round(max * (v.confidence / 100)), detail: `Deliverable at ${v.confidence}% confidence` }
    case 'risky':
      return { ...base, points: Math.round(max * (v.confidence / 100) * 0.6), detail: 'Reachable but low-quality address' }
    case 'unknown':
      return { ...base, points: Math.round(max * 0.4), detail: 'Verification inconclusive' }
    case 'undeliverable':
      return { ...base, points: 0, detail: 'Cannot be reached by email' }
  }
}

function scoreIndustry(industry: string | null, icp: IcpConfig, max: number): ScoreDimension {
  const base = { key: 'industry', label: 'Industry fit', max }
  if (!icp.targetIndustries.length) {
    return { ...base, points: Math.round(max * 0.6), detail: 'No target industries configured' }
  }
  if (!industry?.trim()) return { ...base, points: Math.round(max * 0.2), detail: 'Industry unknown' }
  const hay = industry.toLowerCase()
  const hit = icp.targetIndustries.find((t) => hay.includes(t.toLowerCase()) || t.toLowerCase().includes(hay))
  return hit
    ? { ...base, points: max, detail: `Matches target industry “${hit}”` }
    : { ...base, points: Math.round(max * 0.15), detail: `“${industry}” is outside the target list` }
}

export function tierFor(total: number): Tier {
  if (total >= 80) return 'A'
  if (total >= 60) return 'B'
  if (total >= 40) return 'C'
  return 'D'
}

export function scoreLead(lead: Lead, icp: IcpConfig): ScoreResult {
  const w = icp.weights
  const dimensions: ScoreDimension[] = [
    scoreAuthority(lead.title, w.authority),
    scoreSize(lead.employees, icp, w.size),
    scoreRevenue(lead.revenue, w.revenue),
    scoreContactability(lead, w.contactability),
    scoreIndustry(lead.industry, icp, w.industry),
  ]
  const earned = dimensions.reduce((sum, d) => sum + d.points, 0)
  const available = dimensions.reduce((sum, d) => sum + d.max, 0)

  const total = available > 0 ? Math.round((earned / available) * 100) : 0
  return { total, tier: tierFor(total), dimensions }
}
