import { TipRule } from '@/components/InfoTip'

export const VERDICT_EXPLAINER = (
  <>
    <p className="mb-1.5 text-ink">Checked against live DNS. No email is sent.</p>
    <TipRule term="Deliverable">the domain accepts mail and nothing lowers the address quality.</TipRule>
    <TipRule term="Risky">reachable, but a shared inbox such as sales@, a personal mailbox, or a domain with no MX record.</TipRule>
    <TipRule term="Undeliverable">the domain does not exist, publishes no mail server, is disposable, or the address is malformed.</TipRule>
    <TipRule term="Unknown">DNS did not answer. Retryable, never guessed.</TipRule>
    <p className="mt-1.5">Confidence starts at 100 and deducts. It never exceeds 90, because no SMTP session is
    opened and so no mailbox is individually proven.</p>
  </>
)

export const PRIORITY_EXPLAINER = (
  <>
    <p className="mb-1.5 text-ink">A fixed rules engine. No AI, no network, same input gives the same score.</p>
    <TipRule term="Authority, 30">owner and founder rank highest, interns lowest.</TipRule>
    <TipRule term="Size fit, 25">full marks inside 10 to 250 employees.</TipRule>
    <TipRule term="Revenue, 20">full marks between $1M and $50M.</TipRule>
    <TipRule term="Contactability, 15">from the verification result. An unreachable lead cannot be a priority.</TipRule>
    <TipRule term="Industry, 10">matched against your target list.</TipRule>
    <p className="mt-1.5">Tiers cut from the total: A from 80, B from 60, C from 40, D below.</p>
  </>
)

export const BOUNCE_EXPLAINER = (
  <>
    <p className="mb-1.5 text-ink">The share of your library that is undeliverable.</p>
    <p>These would have bounced had the list been sent as-is. Inbox providers start penalising a
    sender above roughly 2%, which is why the figure matters more than it looks.</p>
  </>
)

export const FUNNEL_EXPLAINER = (
  <>
    <TipRule term="Uploaded">every row in your library.</TipRule>
    <TipRule term="Reachable">deliverable or risky. Risky still reaches a human, so it counts.</TipRule>
    <TipRule term="Ready to call">reachable, top tier, and not a repeat.</TipRule>
  </>
)

export const DUPLICATE_EXPLAINER = (
  <>
    <p className="mb-1.5 text-ink">Matched on email, falling back to company plus contact name.</p>
    <p>Repeats are merged on upload, so your library holds one copy of each contact. Nothing is
    lost: if a repeat carries a field the stored copy was missing, that field is filled in.</p>
  </>
)
