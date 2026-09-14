import postgres, { type Sql } from 'postgres'
import type { DomainFacts } from '../verify/engine'
import type { AiInsight, Lead } from '../types'
import { DOMAIN_TTL_MS, INSIGHT_TTL_MS, type DatasetMeta, type LeadStore } from './index'

export function resolveSsl(url: string): 'require' | false {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  const mode = parsed.searchParams.get('sslmode')
  if (mode) return mode === 'disable' || mode === 'allow' ? false : 'require'

  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host === '::1') return false
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false

  if (!host.includes('.')) return false
  return 'require'
}

type JsonParam = Parameters<Sql['json']>[0]
const asJson = (value: unknown): JsonParam => value as JsonParam

export class PostgresStore implements LeadStore {
  readonly kind = 'postgres' as const
  private sql: Sql

  constructor(url: string) {
    this.sql = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: resolveSsl(url),
    })
  }

  async init(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS datasets (
        id              TEXT PRIMARY KEY,
        filename        TEXT NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        total           INTEGER NOT NULL,
        duplicate_count INTEGER NOT NULL DEFAULT 0,
        skipped_count   INTEGER NOT NULL DEFAULT 0,
        mapping         JSONB NOT NULL,
        processed_at    TIMESTAMPTZ,
        ai_enriched     INTEGER NOT NULL DEFAULT 0,
        merged_duplicates INTEGER NOT NULL DEFAULT 0
      )`

    await this.sql`ALTER TABLE datasets ADD COLUMN IF NOT EXISTS merged_duplicates INTEGER NOT NULL DEFAULT 0`
    await this.sql`
      CREATE TABLE IF NOT EXISTS leads (
        dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
        id         TEXT NOT NULL,
        payload    JSONB NOT NULL,
        status     TEXT,
        tier       TEXT,
        score      INTEGER,
        PRIMARY KEY (dataset_id, id)
      )`

    await this.sql`CREATE INDEX IF NOT EXISTS leads_filter_idx ON leads (dataset_id, tier, status, score DESC)`
    await this.sql`
      CREATE TABLE IF NOT EXISTS domain_cache (
        domain     TEXT PRIMARY KEY,
        facts      JSONB NOT NULL,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
    await this.sql`
      CREATE TABLE IF NOT EXISTS insight_cache (
        domain     TEXT PRIMARY KEY,
        insight    JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
  }

  async createDataset(meta: DatasetMeta, leads: Lead[]): Promise<void> {
    await this.sql`
      INSERT INTO datasets (id, filename, total, duplicate_count, skipped_count, mapping, merged_duplicates)
      VALUES (${meta.id}, ${meta.filename}, ${meta.total}, ${meta.duplicateCount},
              ${meta.skippedCount}, ${this.sql.json(asJson(meta.mapping))}, ${meta.mergedDuplicates})
      ON CONFLICT (id) DO NOTHING`
    await this.writeLeads(meta.id, leads)
  }

  private async writeLeads(datasetId: string, leads: Lead[]): Promise<void> {
    if (!leads.length) return

    const CHUNK = 500
    for (let i = 0; i < leads.length; i += CHUNK) {
      const rows = leads.slice(i, i + CHUNK).map((l) => ({
        dataset_id: datasetId,
        id: l.id,
        payload: this.sql.json(asJson(l)),
        status: l.verification?.status ?? null,
        tier: l.score?.tier ?? null,
        score: l.score?.total ?? null,
      }))
      await this.sql`
        INSERT INTO leads ${this.sql(rows, 'dataset_id', 'id', 'payload', 'status', 'tier', 'score')}
        ON CONFLICT (dataset_id, id) DO UPDATE
        SET payload = EXCLUDED.payload, status = EXCLUDED.status,
            tier = EXCLUDED.tier, score = EXCLUDED.score`
    }
  }

  async getDataset(id: string): Promise<DatasetMeta | null> {
    const [row] = await this.sql<Array<Record<string, unknown>>>`
      SELECT * FROM datasets WHERE id = ${id}`
    if (!row) return null
    return {
      id: row.id as string,
      filename: row.filename as string,
      createdAt: (row.created_at as Date).toISOString(),
      total: row.total as number,
      duplicateCount: row.duplicate_count as number,
      skippedCount: row.skipped_count as number,
      mapping: row.mapping as DatasetMeta['mapping'],
      processedAt: row.processed_at ? (row.processed_at as Date).toISOString() : null,
      aiEnriched: row.ai_enriched as number,
      mergedDuplicates: (row.merged_duplicates as number | null) ?? 0,
    }
  }

  async getLeads(id: string): Promise<Lead[]> {
    const rows = await this.sql<Array<{ payload: Lead }>>`
      SELECT payload FROM leads WHERE dataset_id = ${id} ORDER BY id`
    return rows.map((r) => r.payload)
  }

  async updateLeads(id: string, leads: Lead[]): Promise<void> { await this.writeLeads(id, leads) }

  async replaceLeads(id: string, leads: Lead[]): Promise<void> {
    await this.sql`DELETE FROM leads WHERE dataset_id = ${id}`
    await this.writeLeads(id, leads)
  }

  async updateDatasetMeta(meta: DatasetMeta): Promise<void> {
    await this.sql`
      UPDATE datasets
      SET filename = ${meta.filename}, total = ${meta.total},
          duplicate_count = ${meta.duplicateCount}, skipped_count = ${meta.skippedCount},
          mapping = ${this.sql.json(asJson(meta.mapping))},
          merged_duplicates = ${meta.mergedDuplicates}
      WHERE id = ${meta.id}`
  }

  async markProcessed(id: string, aiEnriched: number): Promise<void> {
    await this.sql`UPDATE datasets SET processed_at = now(), ai_enriched = ${aiEnriched} WHERE id = ${id}`
  }

  async getCachedDomains(domains: string[]): Promise<Map<string, DomainFacts>> {
    const out = new Map<string, DomainFacts>()
    if (!domains.length) return out
    const cutoff = new Date(Date.now() - DOMAIN_TTL_MS)
    const rows = await this.sql<Array<{ domain: string; facts: DomainFacts }>>`
      SELECT domain, facts FROM domain_cache
      WHERE domain IN ${this.sql(domains)} AND checked_at > ${cutoff}`
    for (const r of rows) out.set(r.domain, r.facts)
    return out
  }

  async cacheDomains(facts: Map<string, DomainFacts>): Promise<void> {
    if (!facts.size) return
    const rows = [...facts].map(([domain, f]) => ({
      domain, facts: this.sql.json(asJson(f)), checked_at: new Date(),
    }))
    await this.sql`
      INSERT INTO domain_cache ${this.sql(rows, 'domain', 'facts', 'checked_at')}
      ON CONFLICT (domain) DO UPDATE SET facts = EXCLUDED.facts, checked_at = EXCLUDED.checked_at`
  }

  async getCachedInsights(domains: string[]): Promise<Map<string, AiInsight>> {
    const out = new Map<string, AiInsight>()
    if (!domains.length) return out
    const cutoff = new Date(Date.now() - INSIGHT_TTL_MS)
    const rows = await this.sql<Array<{ domain: string; insight: AiInsight }>>`
      SELECT domain, insight FROM insight_cache
      WHERE domain IN ${this.sql(domains)} AND created_at > ${cutoff}`
    for (const r of rows) out.set(r.domain, r.insight)
    return out
  }

  async cacheInsights(insights: Map<string, AiInsight>): Promise<void> {
    if (!insights.size) return
    const rows = [...insights].map(([domain, i]) => ({
      domain, insight: this.sql.json(asJson(i)), created_at: new Date(),
    }))
    await this.sql`
      INSERT INTO insight_cache ${this.sql(rows, 'domain', 'insight', 'created_at')}
      ON CONFLICT (domain) DO UPDATE SET insight = EXCLUDED.insight, created_at = EXCLUDED.created_at`
  }
}
