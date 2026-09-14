'use client'

import { AnimatePresence, m } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, KeyRound, Loader2, ShieldCheck, X } from 'lucide-react'
import { dialogIn } from '@/lib/motion'
import { DEFAULT_PROVIDER, PROVIDERS, isProviderId, type ProviderId } from '@/lib/ai/providers'
import { Button } from './ui'

const STORE = { key: 'llm-api-key', provider: 'llm-provider', model: 'llm-model' } as const

export interface Credentials {
  apiKey: string
  providerId: ProviderId
  model: string
}

export function readCredentials(): Credentials {
  const fallback: Credentials = { apiKey: '', providerId: DEFAULT_PROVIDER, model: PROVIDERS[DEFAULT_PROVIDER].defaultModel }
  if (typeof window === 'undefined') return fallback
  try {
    const providerRaw = window.localStorage.getItem(STORE.provider)
    const providerId = isProviderId(providerRaw) ? providerRaw : DEFAULT_PROVIDER
    return {
      apiKey: window.localStorage.getItem(STORE.key) ?? '',
      providerId,
      model: window.localStorage.getItem(STORE.model) || PROVIDERS[providerId].defaultModel,
    }
  } catch {
    return fallback
  }
}

function writeCredentials(c: Credentials): void {
  try {
    if (c.apiKey) window.localStorage.setItem(STORE.key, c.apiKey)
    else window.localStorage.removeItem(STORE.key)
    window.localStorage.setItem(STORE.provider, c.providerId)
    window.localStorage.setItem(STORE.model, c.model)
  } catch {}
}

interface ModelOption { id: string; family: string }

export function ApiKeyDialog({
  open, onClose, onSaved, initial,
}: {
  open: boolean
  onClose: () => void
  onSaved: (c: Credentials) => void
  initial: Credentials
}) {
  const [providerId, setProviderId] = useState<ProviderId>(initial.providerId)
  const [apiKey, setApiKey] = useState(initial.apiKey)
  const [model, setModel] = useState(initial.model)
  const [models, setModels] = useState<ModelOption[]>([])
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const provider = PROVIDERS[providerId]

  useEffect(() => {
    if (!open) return
    setProviderId(initial.providerId)
    setApiKey(initial.apiKey)
    setModel(initial.model)
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const loadModels = useCallback(async (p: ProviderId, key: string) => {
    const meta = PROVIDERS[p]
    if (meta.modelsNeedKey && !key) { setModels([]); setListError(null); return }
    setLoading(true)
    setListError(null)
    try {
      const res = await fetch(`/api/models?provider=${p}`, { headers: key ? { 'x-api-key': key } : undefined })
      const body = (await res.json()) as { models?: ModelOption[]; error?: string }
      setModels(body.models ?? [])
      setListError(body.error ?? null)

      setModel((current) =>
        body.models?.some((m) => m.id === current) ? current : (body.models?.[0]?.id ?? meta.defaultModel))
    } catch {
      setModels([])
      setListError(`Could not reach ${meta.label}.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => void loadModels(providerId, apiKey), apiKey ? 400 : 0)
    return () => clearTimeout(t)
  }, [open, providerId, apiKey, loadModels])

  const save = (): void => {
    const next: Credentials = { apiKey: apiKey.trim(), providerId, model }
    writeCredentials(next)
    onSaved(next)
    onClose()
  }

  const grouped = models.reduce<Record<string, ModelOption[]>>((acc, m) => {
    ;(acc[m.family] ??= []).push(m)
    return acc
  }, {})

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="key-title">
          <m.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }} onClick={onClose}
            className="absolute inset-0 bg-[var(--color-scrim)] backdrop-blur-[3px]"
          />
          <m.div
            variants={dialogIn} initial="initial" animate="animate" exit="exit"
            className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-raised shadow-[var(--shadow-pop)]"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
                <h2 id="key-title" className="text-[15px] font-semibold">Connect your own model</h2>
              </div>
              <Button variant="quiet" size="sm" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium">Provider</legend>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Object.keys(PROVIDERS).length}, minmax(0, 1fr))` }}>
                  {Object.values(PROVIDERS).map((p) => {
                    const on = p.id === providerId
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => { setProviderId(p.id); setModel(p.defaultModel) }}
                        className={`rounded-lg border px-3 py-2 text-left transition-colors duration-150 ${
                          on ? 'border-accent bg-accent-wash' : 'border-line hover:border-faint'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-[13px] font-medium">
                          {p.label}
                          {on ? <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> : null}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted">{p.note}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="mt-4">
                <label htmlFor="api-key" className="mb-1.5 block text-[13px] font-medium">API key</label>
                <input
                  ref={inputRef}
                  id="api-key"
                  name="llm-api-key"
                  type="password"

                  autoComplete="new-password"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  spellCheck={false}
                  placeholder={provider.keyHint}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="fig w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-faint focus:border-accent"
                />
                <p className="mt-1.5 text-[12.5px] text-muted">
                  Get one from{' '}
                  <a href={provider.consoleUrl} target="_blank" rel="noreferrer noopener"
                    className="text-accent underline underline-offset-2 hover:text-accent-hi">
                    {provider.label}
                  </a>.
                </p>
              </div>

              <div className="mt-4">
                <label htmlFor="api-model" className="mb-1.5 flex items-center gap-2 text-[13px] font-medium">
                  Model
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" aria-hidden="true" /> : null}
                  {!loading && models.length > 0 ? (
                    <span className="fig text-[11.5px] font-normal text-faint">{models.length} available</span>
                  ) : null}
                </label>
                <select
                  id="api-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={models.length === 0}
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] text-ink disabled:opacity-50"
                >
                  {models.length === 0 ? (
                    <option value={model}>{model}</option>
                  ) : (
                    Object.entries(grouped).map(([family, list]) => (
                      <optgroup key={family} label={family}>
                        {list.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
                      </optgroup>
                    ))
                  )}
                </select>
                <p className="mt-1.5 text-[12.5px] text-muted">
                  {listError
                    ? listError
                    : models.length === 0 && provider.modelsNeedKey
                      ? 'Enter a key to load the models it can reach.'
                      : 'Smaller, faster models are listed first. Speed varies by an order of magnitude: a batch of 25 leads takes about 6 seconds on Gemini Flash and about 2 minutes on DeepSeek Flash.'}
                </p>
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-clear-wash px-3 py-2.5">
                <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-clear" aria-hidden="true" />
                <p className="text-[12.5px] leading-relaxed text-clear">
                  Stored in this browser only. It is sent with your enrichment request so the
                  server can relay it, and is never logged or saved anywhere.
                </p>
              </div>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-5 py-3">
              <Button variant="quiet" size="sm"
                onClick={() => {
                  const cleared: Credentials = { apiKey: '', providerId, model }
                  setApiKey('')
                  writeCredentials(cleared)
                  onSaved(cleared)
                }}>
                Remove key
              </Button>
              <div className="flex gap-2">
                <Button size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" variant="accent" onClick={save} disabled={!apiKey.trim()}>Save</Button>
              </div>
            </footer>
          </m.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
