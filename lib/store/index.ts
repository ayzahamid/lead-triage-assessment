import type { DomainFacts } from '../verify/engine'
import type { AiInsight, ColumnMapping, Lead } from '../types'

export interface DatasetMeta {
  id: string
  filename: string
  createdAt: string
  total: number
  duplicateCount: number
  skippedCount: number
  mapping: ColumnMapping
  processedAt: string | null
  aiEnriched: number

  mergedDuplicates: number
}

export interface LeadStore {
  readonly kind: 'postgres' | 'memory'
  init(): Promise<void>

  createDataset(meta: DatasetMeta, leads: Lead[]): Promise<void>

  replaceLeads(id: string, leads: Lead[]): Promise<void>
  updateDatasetMeta(meta: DatasetMeta): Promise<void>
  getDataset(id: string): Promise<DatasetMeta | null>
  getLeads(id: string): Promise<Lead[]>
  updateLeads(id: string, leads: Lead[]): Promise<void>
  markProcessed(id: string, aiEnriched: number): Promise<void>

  getCachedDomains(domains: string[]): Promise<Map<string, DomainFacts>>
  cacheDomains(facts: Map<string, DomainFacts>): Promise<void>

  getCachedInsights(domains: string[]): Promise<Map<string, AiInsight>>
  cacheInsights(insights: Map<string, AiInsight>): Promise<void>
}

export const DOMAIN_TTL_MS = 48 * 60 * 60 * 1000
export const INSIGHT_TTL_MS = 7 * 24 * 60 * 60 * 1000

let singleton: Promise<LeadStore> | null = null

async function build(): Promise<LeadStore> {
  const url = process.env.DATABASE_URL
  let store: LeadStore
  if (url) {
    const { PostgresStore } = await import('./postgres')
    store = new PostgresStore(url)
  } else {
    const { MemoryStore } = await import('./memory')
    store = new MemoryStore()
  }
  await store.init()
  return store
}

export function getStore(): Promise<LeadStore> {
  singleton ??= build().catch((err: unknown) => {
    singleton = null
    throw err
  })
  return singleton
}
