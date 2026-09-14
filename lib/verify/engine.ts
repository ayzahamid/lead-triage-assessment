import { promises as dns } from 'node:dns'
import type { Deliverability, VerificationReason, VerificationResult } from '../types'
import { DISPOSABLE_DOMAINS, FREE_PROVIDER_DOMAINS, ROLE_LOCAL_PARTS, fingerprintProvider } from './providers'

const DNS_TIMEOUT_MS = 4000
const MAX_CONCURRENCY = 10

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export function parseEmail(input: string): { local: string; domain: string } | null {
  const email = input.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return null
  if (email.length > 254) return null
  const at = email.lastIndexOf('@')
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null
  return { local, domain }
}

type DnsOutcome<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'nxdomain' }
  | { kind: 'nodata' }
  | { kind: 'timeout' }

async function attempt<T>(p: Promise<T>, ms: number): Promise<DnsOutcome<T>> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<DnsOutcome<T>>((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'timeout' }), ms)
  })
  const attemptResolve = p.then(
    (value): DnsOutcome<T> => ({ kind: 'ok', value }),
    (err: NodeJS.ErrnoException): DnsOutcome<T> => {
      if (err.code === 'ENOTFOUND' || err.code === 'NXDOMAIN') return { kind: 'nxdomain' }
      if (err.code === 'ENODATA') return { kind: 'nodata' }
      return { kind: 'timeout' }
    },
  )
  try {
    return await Promise.race([attemptResolve, timeout])
  } finally {
    clearTimeout(timer)
  }
}

export interface DomainFacts {
  domain: string
  mxHosts: string[]
  hasAddressRecord: boolean

  resolved: boolean

  nxdomain: boolean
}

export async function resolveDomain(domain: string): Promise<DomainFacts> {
  const mx = await attempt(dns.resolveMx(domain), DNS_TIMEOUT_MS)

  if (mx.kind === 'nxdomain') {
    return { domain, mxHosts: [], hasAddressRecord: false, resolved: true, nxdomain: true }
  }
  if (mx.kind === 'timeout') {
    return { domain, mxHosts: [], hasAddressRecord: false, resolved: false, nxdomain: false }
  }

  const mxHosts = (mx.kind === 'ok' ? mx.value : [])
    .sort((a, b) => a.priority - b.priority)
    .map((r) => r.exchange.toLowerCase().replace(/\.$/, ''))
    .filter(Boolean)

  let hasAddressRecord = false
  let resolved = true
  if (mxHosts.length === 0) {
    const a = await attempt(dns.resolve4(domain), DNS_TIMEOUT_MS)
    if (a.kind === 'timeout') resolved = false
    hasAddressRecord = a.kind === 'ok' && a.value.length > 0
  }

  return { domain, mxHosts, hasAddressRecord, resolved, nxdomain: false }
}

export function judge(email: string | null, facts: DomainFacts | null): VerificationResult {
  const now = new Date().toISOString()
  const reasons: VerificationReason[] = []
  const base = (status: Deliverability, confidence: number): VerificationResult => ({
    status, confidence, reasons, provider: null, catchAll: false, mxHosts: [], checkedAt: now,
  })

  if (!email || !email.trim()) {
    reasons.push({ code: 'no_email', label: 'No email address on the record', weight: -100 })
    return base('undeliverable', 0)
  }

  const parsed = parseEmail(email)
  if (!parsed) {
    reasons.push({ code: 'bad_syntax', label: 'Address is not valid per RFC 5322', weight: -100 })
    return base('undeliverable', 0)
  }

  const { local, domain } = parsed

  if (DISPOSABLE_DOMAINS.has(domain)) {
    reasons.push({ code: 'disposable', label: 'Disposable mailbox provider', weight: -100 })
    return base('undeliverable', 0)
  }

  if (!facts || !facts.resolved) {
    reasons.push({ code: 'dns_timeout', label: 'DNS did not answer in time, so this is retryable', weight: 0 })
    return base('unknown', 50)
  }

  if (facts.nxdomain) {
    reasons.push({ code: 'nxdomain', label: 'Domain does not exist', weight: -100 })
    return base('undeliverable', 0)
  }

  if (facts.mxHosts.length === 0 && !facts.hasAddressRecord) {
    reasons.push({ code: 'no_mx', label: 'Domain publishes no mail exchanger and has no address record', weight: -100 })
    return base('undeliverable', 0)
  }

  let confidence = 100
  const { provider, catchAll } = fingerprintProvider(facts.mxHosts)
  const demote: string[] = []

  reasons.push({
    code: 'no_smtp_probe',
    label: 'Mailbox not individually probed, so this is domain-level evidence only',
    weight: -10,
  })
  confidence -= 10

  if (facts.mxHosts.length === 0 && facts.hasAddressRecord) {
    reasons.push({ code: 'implicit_mx', label: 'No MX record; relies on the implicit-MX fallback', weight: -25 })
    confidence -= 25
    demote.push('implicit_mx')
  } else {
    reasons.push({ code: 'mx_present', label: `Mail accepted by ${provider ?? 'an unrecognised host'}`, weight: 0 })
  }

  if (catchAll) {
    reasons.push({ code: 'catch_all', label: 'Provider accepts all addresses, so this mailbox cannot be individually proven', weight: -15 })
    confidence -= 15
  }

  if (ROLE_LOCAL_PARTS.has(local)) {
    reasons.push({ code: 'role_account', label: `Shared inbox (${local}@) that reaches a queue, not a decision maker`, weight: -30 })
    confidence -= 30
    demote.push('role_account')
  }

  if (FREE_PROVIDER_DOMAINS.has(domain)) {
    reasons.push({ code: 'free_provider', label: 'Consumer mailbox rather than a company domain', weight: -25 })
    confidence -= 25
    demote.push('free_provider')
  }

  if (local.length <= 2) {
    reasons.push({ code: 'short_local', label: 'Unusually short local part', weight: -10 })
    confidence -= 10
  }

  const status: Deliverability = demote.length > 0 ? 'risky' : 'deliverable'
  confidence = Math.max(0, Math.min(100, confidence))
  return { status, confidence, reasons, provider, catchAll, mxHosts: facts.mxHosts, checkedAt: now }
}

export async function resolveMany(
  domains: string[],
  onResolved?: (domain: string, facts: DomainFacts) => void,
): Promise<Map<string, DomainFacts>> {
  const unique = [...new Set(domains.filter(Boolean))]
  const out = new Map<string, DomainFacts>()
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < unique.length) {
      const domain = unique[cursor++]
      if (!domain) continue
      const facts = await resolveDomain(domain)
      out.set(domain, facts)
      onResolved?.(domain, facts)
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, unique.length) }, worker))
  return out
}
