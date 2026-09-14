# Decisions, and what they cost

Each of these was a fork where the obvious option was worse.

## Verification stops at the domain, and says so

No SMTP handshake is performed. Outbound port 25 is blocked on every free host and on AWS by
default, and more importantly Google and Microsoft answer `RCPT TO` probes accept-all — so the
technique fails precisely where most B2B mail lives.

The engine therefore checks syntax, domain existence, mail exchanger, provider fingerprint and
reputation signals, and reports an honest confidence. **A baseline deduction caps every result
at 90**, because no mailbox is individually proven.

**Catch-all does not change the verdict.** An early version demoted every catch-all domain to
risky, which painted about 90% of legitimate B2B leads amber. Google Workspace and Microsoft
365 are both catch-all and together carry most business mail, so the column became noise.
Catch-all now costs confidence, not status.

## Scoring is deterministic, and the AI cannot touch it

Measured, not assumed: with enrichment inline the pipeline took 41 seconds against 3.3 for
verification alone, and the free tier exhausted its quota partway through a 526-row file.
Enrichment is now a separate, scoped action, batched and cached per domain. When the quota runs
out — which it did during testing, at batch 6 of 8 — the tool says so and carries on with rules
scoring.

A rules engine that always works beats an AI feature that dies mid-demo.

## The ICP is editable, but the weights are not

Two of the five dimensions read from a profile the user sets, which is 35 of the 100 points.
Without it, industry fit returns the same score for every lead and does no ranking work at all.

The weights stay fixed because they encode the acquisition thesis; a rep re-weighting them
would make two exports incomparable. Saving re-runs the pipeline rather than re-scoring in the
browser, because a client-side scorer would be a second implementation of the same rules.

Wiring this up exposed an existing bug: the pipeline settled a lead only when it had no
`verification` yet, and leads load from the store carrying the previous run's verdict — so a
second pass skipped scoring and silently kept the old numbers. Harmless while the profile was a
constant; wrong the moment it became editable.

## Bring your own key

No key ships and none can be set on the server. Each person supplies their own for Gemini or
OpenCode Go, kept in their browser and sent as a header only when they ask for context. It is
never logged, stored or echoed.

**The model list is fetched live, never hardcoded**, because model names change constantly and
a stale list is worse than none. Variants that cannot return structured JSON are filtered out,
and small fast models are ordered first — this task is short classification over batches, where
a frontier model costs more and adds nothing.

Two things about OpenCode Go are not in its published docs, both found by testing against the
live service: it refuses any request without an `x-opencode-session` header, and throughput
varies by an order of magnitude between models (about 6 seconds a batch on Gemini Flash, about
144 on DeepSeek Flash). Batches therefore run four-wide and the enrichment set is capped at
four batches.

## The library accumulates

Uploads add to the library rather than replacing it, so a rep can add a region at a time.
Repeats are recognised on the same key the deduplicator uses and are not added twice — but if a
repeat carries a field the stored copy was missing, that field is filled in.

The trade-off: the library lives in one browser. Accounts are the obvious next step and out of
scope for a five-hour build.

## The export is treated as untrusted output

Everything in it came from a scraped list nobody vetted, and it lands in Excel. Cells opening
`=`, `+`, `-` or `@` are neutralised, which is what the CRMs do themselves. Plain numbers are
exempt so they still import as numbers.

## Colour was validated, not chosen by eye

The original amber/red pair scored a **deuteranopia ΔE of 4.7** — effectively identical for a
red-green colourblind reader, and those are the two verdicts that matter most. They are now
separated by **lightness**, which colour-vision deficiency preserves, and every status
additionally carries an icon and a written label.

Two colour systems that never overlap: **status** owns green, amber and red, and nothing else
may use them, so a verdict is never confused with a control; **action** owns a single cobalt
accent. Figures are set in mono, because they are readings taken off a list and mono gives true
column alignment for free.

## Motion answers actions, and stops where it would cost correctness

Springs for anything a person triggered, short eased curves for state that simply arrives,
transform and opacity only, and `prefers-reduced-motion` honoured at the stylesheet level.

Screen-to-screen crossfades were deliberately dropped. An `AnimatePresence` with `mode="wait"`
had to finish the outgoing exit before mounting the next screen, and the pipeline routinely
finishes in ~0.4s — while the processing screen's own entrance is still running. Interrupting
enter with exit could leave the exit unresolved and the results screen never mounted. It was a
real hang. Each pane animates its own contents in, so the crossfade bought nothing.

## Production scaling path, documented not deployed

The container is the point: hosting stays a deployment decision rather than an architectural
one.

```bash
docker build -t lead-triage .
docker push <acct>.dkr.ecr.<region>.amazonaws.com/lead-triage:latest
# Fargate 0.25 vCPU / 512 MB behind an ALB, secrets in Secrets Manager, logs to CloudWatch
```

ECS was deliberately not used for the demo. An ALB alone runs about $16/month and needs a
payment method, and it would not enable SMTP verification anyway.
