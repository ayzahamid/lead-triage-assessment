import { randomUUID } from 'node:crypto'
import type { Lead } from '../types'
import { PROVIDERS, type ProviderId } from './providers'
import { callModel } from './transport'

export type Channel = 'email' | 'linkedin'
export type Tone = 'professional' | 'direct' | 'warm'

export interface Draft {
  leadId: string
  subject: string | null
  body: string
}

const TONE_BRIEF: Record<Tone, string> = {
  professional: 'Measured and businesslike. No slang, no exclamation marks.',
  direct: 'Short and plain. Say why you are writing in the first sentence and stop when done.',
  warm: 'Friendly and human, but never familiar or gushing.',
}

const CHANNEL_BRIEF: Record<Channel, string> = {
  email: 'A cold email. Give a subject line under 55 characters and a body under 120 words.',
  linkedin: 'A LinkedIn connection note. No subject. Under 60 words, because the field is short.',
}

function buildPrompt(leads: Lead[], channel: Channel, tone: Tone, sender: string, offer: string): string {
  const rows = leads.map((l) => {

    const first = l.contactName?.trim().split(/\s+/)[0] ?? null
    return [
      `id=${l.id}`,
      l.companyName,
      first ? `contact first name ${first}` : 'contact name unknown',
      l.title ?? 'unknown role',
      l.employees != null ? `${l.employees} staff` : 'size unknown',
      l.industry ?? 'industry unknown',
    ].join(' | ')
  })

  return [
    `You write first-touch ${channel === 'email' ? 'cold emails' : 'LinkedIn connection notes'} for a B2B sales rep.`,
    `The rep: ${sender || 'a sales representative'}.`,
    `What they offer: ${offer || 'a service relevant to this industry'}.`,
    `Tone: ${TONE_BRIEF[tone]}`,
    CHANNEL_BRIEF[channel],
    '',
    'Rules:',
    '- Use only the facts given about each company. Invent nothing: no fake mutual contacts,',
    '  no imagined recent news, no made-up metrics.',
    '- Greet by first name when one is given. Never invent a name, and never greet someone',
    '  by their job title.',
    '- Do not write a signature or sign-off. The rep adds their own, and a dangling',
    '  "Best regards," with nothing under it is worse than none.',
    '- No placeholder brackets. Write finished sentences.',
    '',
    'Return only a JSON array. One object per lead:',
    channel === 'email'
      ? '{ "id": "<id>", "subject": "<subject>", "body": "<body>" }'
      : '{ "id": "<id>", "body": "<message>" }',
    '',
    'Leads:',
    ...rows,
  ].join('\n')
}

interface RawDraft { id?: unknown; subject?: unknown; body?: unknown }

export interface OutreachOptions {
  apiKey: string
  providerId: ProviderId
  model: string
  channel: Channel
  tone: Tone
  sender: string
  offer: string
}

export type OutreachOutcome =
  | { ok: true; drafts: Draft[] }
  | { ok: false; reason: string; drafts: Draft[] }

const BATCH = 5

export async function draftOutreach(
  leads: Lead[],
  opts: OutreachOptions,
): Promise<OutreachOutcome> {
  const drafts: Draft[] = []
  if (!opts.apiKey) return { ok: false, reason: 'Add your own API key to write drafts.', drafts }
  if (!leads.length) return { ok: true, drafts }

  const provider = PROVIDERS[opts.providerId]
  const sessionId = randomUUID()
  const batches: Array<typeof leads> = []
  for (let i = 0; i < leads.length; i += BATCH) batches.push(leads.slice(i, i + BATCH))

  for (const batch of batches) {
    const prompt = buildPrompt(batch, opts.channel, opts.tone, opts.sender, opts.offer)
    const result = await callModel({
      provider, model: opts.model, prompt, apiKey: opts.apiKey, sessionId,
    })
    if (!result.ok) return { ok: false, reason: result.reason, drafts }

    for (const item of result.items) {
      const raw = item as RawDraft
      const id = typeof raw.id === 'string' ? raw.id : null
      const body = typeof raw.body === 'string' ? raw.body.trim() : ''
      if (!id || !body) continue
      drafts.push({
        leadId: id,
        subject: opts.channel === 'email' && typeof raw.subject === 'string' ? raw.subject.trim() : null,
        body,
      })
    }
  }

  return { ok: true, drafts }
}
