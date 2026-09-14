import type { DomainFacts } from '../verify/engine'
import type { AiInsight, Lead } from '../types'
import { DOMAIN_TTL_MS, INSIGHT_TTL_MS, type DatasetMeta, type LeadStore } from './index'

interface Entry<T> { value: T; at: number }

export class MemoryStore implements LeadStore {
  readonly kind = 'memory' as const

  private datasets = new Map<string, DatasetMeta>()
  private leads = new Map<string, Lead[]>()
  private domains = new Map<string, Entry<DomainFacts>>()
  private insights = new Map<string, Entry<AiInsight>>()

  private static MAX_DATASETS = 20

  async init(): Promise<void> {}

  async createDataset(meta: DatasetMeta, leads: Lead[]): Promise<void> {
    if (this.datasets.size >= MemoryStore.MAX_DATASETS) {
      const oldest = [...this.datasets.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
      if (oldest) { this.datasets.delete(oldest.id); this.leads.delete(oldest.id) }
    }
    this.datasets.set(meta.id, meta)
    this.leads.set(meta.id, leads)
  }

  async getDataset(id: string): Promise<DatasetMeta | null> { return this.datasets.get(id) ?? null }
  async getLeads(id: string): Promise<Lead[]> { return this.leads.get(id) ?? [] }

  async replaceLeads(id: string, leads: Lead[]): Promise<void> { this.leads.set(id, leads) }

  async updateDatasetMeta(meta: DatasetMeta): Promise<void> { this.datasets.set(meta.id, meta) }
  async updateLeads(id: string, leads: Lead[]): Promise<void> { this.leads.set(id, leads) }

  async markProcessed(id: string, aiEnriched: number): Promise<void> {
    const meta = this.datasets.get(id)
    if (meta) this.datasets.set(id, { ...meta, processedAt: new Date().toISOString(), aiEnriched })
  }

  async getCachedDomains(domains: string[]): Promise<Map<string, DomainFacts>> {
    const out = new Map<string, DomainFacts>()
    const now = Date.now()
    for (const d of domains) {
      const hit = this.domains.get(d)
      if (hit && now - hit.at < DOMAIN_TTL_MS) out.set(d, hit.value)
    }
    return out
  }

  async cacheDomains(facts: Map<string, DomainFacts>): Promise<void> {
    const now = Date.now()
    for (const [d, v] of facts) this.domains.set(d, { value: v, at: now })
  }

  async getCachedInsights(domains: string[]): Promise<Map<string, AiInsight>> {
    const out = new Map<string, AiInsight>()
    const now = Date.now()
    for (const d of domains) {
      const hit = this.insights.get(d)
      if (hit && now - hit.at < INSIGHT_TTL_MS) out.set(d, hit.value)
    }
    return out
  }

  async cacheInsights(insights: Map<string, AiInsight>): Promise<void> {
    const now = Date.now()
    for (const [d, v] of insights) this.insights.set(d, { value: v, at: now })
  }
}
