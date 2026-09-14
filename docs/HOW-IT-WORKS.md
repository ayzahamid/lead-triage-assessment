# How it works

Every number here comes from the source, and the file that owns each rule is named so the two
cannot drift apart silently.

## Ingest — `lib/csv/`

**Column mapping** (`mapping.ts`). Eleven canonical fields, each with an alias list, matched
exact-first then by substring. A source column is claimed once, so `Email` cannot fill both
`email` and `contactName`. `parseNumeric` handles what people actually paste: `1,200`, `$4.5M`,
`50-200` (midpoint), `10K+`.

**Row rules** (`ingest.ts`). A row is dropped only if it has neither a company name nor an
email. Domain comes from an explicit column, falling back to the email's own domain.

**Deduplication key** (`ingest.ts`): `e:<email>` when an email exists, otherwise
`n:<company>|<contact>`. No key means never merged.

**Merge** (`merge.ts`). Uploads extend the library. A repeat is not added again, but any field
the stored copy is missing is filled in from it — losing a phone number to an earlier upload is
a quiet kind of data loss. `verification`, `score` and `ai` are never overwritten, so an
overlapping re-upload costs no DNS work.

## Verification — `lib/verify/`

No SMTP session is ever opened; see [DECISIONS](DECISIONS.md).

Resolution is per **domain**, not per address, and cached. A bounded pool of **10** runs with a
**4-second** timeout per lookup. DNS failures are distinguished rather than collapsed, because
the distinction changes the verdict:

| Outcome | Meaning |
|---|---|
| `ENOTFOUND` / `NXDOMAIN` | Domain does not exist → undeliverable |
| `ENODATA` | Exists, no MX → falls through to the implicit-MX check |
| timeout | Unknown and retryable. Never guessed |

**The verdict** (`judge()` in `engine.ts`). Terminal at confidence 0: no email, malformed per
RFC 5322, disposable provider, NXDOMAIN, or no MX and no A record. Otherwise confidence starts
at 100 and deducts:

| Signal | Deduction | Demotes to risky? |
|---|---|---|
| No SMTP probe (always applied) | −10 | no — this is why nothing exceeds **90** |
| Catch-all provider | −15 | **no** |
| No MX, implicit-MX fallback | −25 | yes |
| Consumer mailbox (gmail, outlook…) | −25 | yes |
| Shared inbox (`sales@`, `info@`…) | −30 | yes |
| Local part of 2 characters or fewer | −10 | no |

**Provider fingerprinting** (`providers.ts`) matches MX hostnames against an ordered pattern
list, yielding a display name and whether the provider is catch-all. Unrecognised MX is
reported as self-hosted and not assumed catch-all either way.

## Scoring — `lib/score/engine.ts`

Deterministic: no network, no key, no quota, identical output for identical input.

| Dimension | Weight | Basis |
|---|---|---|
| Decision-maker authority | 30 | Title matched against a seniority ladder. Junior markers checked **first**, so "Assistant to the CEO" does not score as CEO |
| Company size fit | 25 | Full marks inside the ICP window; decays with distance rather than dropping to zero at the edge |
| Revenue signal | 20 | Full marks $1M–$50M; reduced above, heavily reduced past $200M |
| Contactability | 15 | From the verification result. Undeliverable scores 0 |
| Industry fit | 10 | Matched against the ICP's target list |

Normalised to 0–100. Tiers: **A** ≥ 80 · **B** ≥ 60 · **C** ≥ 40 · **D** below.

### The ICP — `lib/icp.ts`

Size fit and industry fit read from a per-browser profile, so **35 of the 100 points** are
decided by it. Left unset, industry fit scores every lead the same and does no ranking work;
narrowing it from the default to `50–120 staff, Healthcare` moves the A tier from 112 leads
to 37.

The five weights are deliberately not editable — they encode the acquisition thesis, and a rep
re-weighting them would make two exports incomparable. Saving re-runs the pipeline rather than
re-scoring in the browser, which would be a second implementation of the same rules, free to
drift. Verification is cached, so the re-run costs no DNS work.

## AI enrichment — `lib/ai/`

Optional and scoped. It never touches the score or the verdict.

- Batch size **25**, four batches concurrently, capped at **100 leads**.
- Excluded: duplicates, undeliverable addresses, and optionally leads that already carry context.
- Sent: company, title, employees, industry, revenue. **Never sent:** email, phone, contact name.
- Returns fit 1–5, a signal, and a reason capped at 140 characters, all coerced and clamped.
- Failure is non-fatal: the run returns whatever was gathered, with a message.

**Transport** (`transport.ts`) is shared by enrichment and outreach. Google keys by query
parameter; everything else speaks OpenAI chat-completions. OpenCode Go additionally refuses any
request without an `x-opencode-session` header. Gateways disagree about optional parameters, so
the request steps down through progressively simpler bodies, and **a 200 carrying nothing
usable is treated as a rejection** — otherwise a gateway that accepts `response_format` and
returns prose enriches nothing, silently.

**Outreach** (`outreach.ts`) sits downstream of verification, so undeliverable leads never
reach it. The prompt receives the contact's first name only, plus company, role, size and
industry — never the email address — and is forbidden from inventing mutual contacts, recent
news or metrics.

## Storage — `lib/store/`

One `LeadStore` interface, two implementations: Postgres when `DATABASE_URL` is set, in-memory
otherwise.

| Table | Holds | TTL |
|---|---|---|
| `datasets` | One row per workspace: filename, totals, column mapping | — |
| `leads` | The lead payload plus indexed `status`, `tier`, `score` | — |
| `domain_cache` | DNS facts, keyed by domain | **48 hours** |
| `insight_cache` | AI judgments, keyed by domain **and ICP** | **7 days** |

Schema creation is idempotent. Writes are chunked at 500 rows to stay inside Postgres'
parameter ceiling. A workspace is this browser's library: a random id in local storage.

## Export — `lib/csv/export.ts`

Three formats using the column names each target expects on import: **HubSpot**, **Salesforce**
(company used as last name when no contact is known), and a generic CSV. Seven columns are
appended to every format: deliverability, confidence, mail provider, priority score, tier, AI
fit and AI rationale.

The export honours the filters on screen and runs server-side, so it stays correct for a
library larger than the client is holding. A UTF-8 BOM is prepended, without which Excel
mangles accented names.

**Formula injection is neutralised.** Excel, Sheets and LibreOffice evaluate any cell opening
with `=`, `+`, `-` or `@`, and everything here came from a scraped list nobody vetted — a lead
named `=cmd|'/c calc'!A1` is a payload that fires when a rep double-clicks the file. Those
cells are prefixed with an apostrophe. Plain numbers are exempt, so a negative figure still
imports as a number.

## Paging — `components/Pagination.tsx`

**50 rows** by default, switchable to 25 or 100, with page and size in the URL so a link lands
on the same screen. Changing a filter returns to page one; filtering below the current page
clamps rather than stranding the reader. Export is unaffected — it takes the whole filtered
set, not the visible page.

The table card is capped at the filter rail's measured height, so a full page ends level with
the rail while a filtered handful still stops at its last row.

## Limits

| | |
|---|---|
| Upload | 12 MB, 5,000 rows |
| Standalone validation | 500 addresses per request |
| AI enrichment | 100 leads per run |
| Outreach | 10 leads per request |
| Table page | 25, 50 or 100 rows |
