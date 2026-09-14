'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Target, X } from 'lucide-react'
import { DEFAULT_PREFS, SUGGESTED_INDUSTRIES, type IcpPrefs } from '@/lib/icp'
import { Button } from './ui'
import { Modal } from './Modal'

export function IcpDialog({
  open, onClose, onSave, prefs, leadCount,
}: {
  open: boolean
  onClose: () => void
  onSave: (next: IcpPrefs) => void
  prefs: IcpPrefs
  leadCount: number
}) {
  const [draft, setDraft] = useState<IcpPrefs>(prefs)
  const [typed, setTyped] = useState('')

  useEffect(() => { if (open) { setDraft(prefs); setTyped('') } }, [open, prefs])

  const addIndustry = (raw: string): void => {
    const name = raw.trim()
    if (!name || draft.targetIndustries.length >= 12) return
    const already = draft.targetIndustries.some((i) => i.toLowerCase() === name.toLowerCase())
    if (already) return
    setDraft({ ...draft, targetIndustries: [...draft.targetIndustries, name] })
    setTyped('')
  }

  const removeIndustry = (name: string): void =>
    setDraft({ ...draft, targetIndustries: draft.targetIndustries.filter((i) => i !== name) })

  const unpicked = useMemo(
    () => SUGGESTED_INDUSTRIES.filter((s) => !draft.targetIndustries.some((i) => i.toLowerCase() === s.toLowerCase())),
    [draft.targetIndustries],
  )

  const min = Math.min(draft.employeesMin, draft.employeesMax)
  const max = Math.max(draft.employeesMin, draft.employeesMax)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Scoring profile"
      icon={<Target className="h-4 w-4 text-accent" aria-hidden="true" />}
      footer={
        <>
          <Button size="sm" variant="quiet" onClick={() => setDraft(DEFAULT_PREFS)}>
            Reset to default
          </Button>
          <Button size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            variant="accent"
            onClick={() => { onSave({ ...draft, employeesMin: min, employeesMax: max }); onClose() }}
          >
            {leadCount > 0 ? 'Save and re-score' : 'Save profile'}
          </Button>
        </>
      }
    >
      <p className="text-[12.5px] leading-relaxed text-muted">
        Who you are selling to. Company size fit and industry fit are scored against this,
        which is <span className="font-medium text-ink">35 of the 100 points</span> behind
        every tier.
      </p>

      <section className="mt-4">
        <h3 className="text-[13px] font-medium">Company size that fits</h3>
        <p className="mt-1 text-[12px] text-muted">
          Full marks inside the window. Outside it the score decays with distance rather than
          dropping to zero, so a near miss still ranks above a bad one.
        </p>
        <div className="mt-2.5 flex items-end gap-3">
          <div>
            <label htmlFor="icp-min" className="mb-1 block text-[12px] text-muted">Minimum staff</label>
            <input
              id="icp-min"
              type="number"
              min={0}
              max={1000000}
              value={draft.employeesMin}
              onChange={(e) => setDraft({ ...draft, employeesMin: Math.max(0, Number(e.target.value) || 0) })}
              className="fig w-28 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] focus:border-accent"
            />
          </div>
          <span className="pb-2 text-[13px] text-faint">to</span>
          <div>
            <label htmlFor="icp-max" className="mb-1 block text-[12px] text-muted">Maximum staff</label>
            <input
              id="icp-max"
              type="number"
              min={0}
              max={1000000}
              value={draft.employeesMax}
              onChange={(e) => setDraft({ ...draft, employeesMax: Math.max(0, Number(e.target.value) || 0) })}
              className="fig w-28 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] focus:border-accent"
            />
          </div>
        </div>
      </section>

      <section className="mt-4">
        <h3 className="text-[13px] font-medium">Target industries</h3>
        <p className="mt-1 text-[12px] text-muted">
          {draft.targetIndustries.length === 0
            ? 'None set, so industry fit scores every lead the same and does no ranking work. Add one or more to make those 10 points count.'
            : 'A lead matching any of these takes the full 10 points. Everything else is marked outside the list.'}
        </p>

        {draft.targetIndustries.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {draft.targetIndustries.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => removeIndustry(name)}
                  aria-label={`Remove ${name}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-wash px-2.5 py-1 text-[12px] text-ink hover:border-faint"
                >
                  {name}
                  <X className="h-3 w-3 text-muted" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-2.5 flex gap-2">
          <label htmlFor="icp-industry" className="sr-only">Add an industry</label>
          <input
            id="icp-industry"
            type="text"
            value={typed}
            placeholder="Add your own…"
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIndustry(typed) } }}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] placeholder:text-faint focus:border-accent"
          />
          <Button size="sm" onClick={() => addIndustry(typed)} disabled={!typed.trim()}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </Button>
        </div>

        {unpicked.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {unpicked.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => addIndustry(name)}
                  className="rounded-full border border-line px-2.5 py-1 text-[12px] text-muted hover:border-faint hover:text-ink"
                >
                  + {name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-4 rounded-lg bg-line-soft px-3 py-2.5">
        <h3 className="text-[12.5px] font-medium">What this does not change</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          The five weights stay fixed — authority 30, size 25, revenue 20, contactability 15,
          industry 10 — so two exports remain comparable. Deliverability is a fact about the
          domain and is unaffected. Re-scoring reuses the cached DNS results, so it costs no
          new lookups.
        </p>
      </section>
    </Modal>
  )
}
