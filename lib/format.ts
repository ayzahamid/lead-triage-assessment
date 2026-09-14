import type { Deliverability, Tier } from './types'

const int = new Intl.NumberFormat('en-US')
const pct = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 })
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1,
})

export const fmtInt = (n: number): string => int.format(n)
export const fmtPct = (fraction: number): string => pct.format(fraction)

export const fmtMoney = (n: number | null): string => (n == null ? 'Unknown' : usd.format(n))
export const fmtCount = (n: number | null): string => (n == null ? 'Unknown' : int.format(n))
export const orText = (v: string | null | undefined, fallback: string): string =>
  v && v.trim() ? v : fallback

export const TIER_MEANING: Record<Tier, string> = {
  A: 'Call first',
  B: 'Worth working',
  C: 'Low priority',
  D: 'Deprioritise',
}

export const STATUS_MEANING: Record<Deliverability, string> = {
  deliverable: 'Safe to send',
  risky: 'Reaches a queue or a personal inbox',
  undeliverable: 'Would have bounced',
  unknown: 'Lookup did not answer',
}

export const STATUS_SHORT: Record<Deliverability, string> = {
  deliverable: 'Safe to send',
  risky: 'Queue or personal inbox',
  undeliverable: 'Removed before sending',
  unknown: 'Needs a retry',
}
