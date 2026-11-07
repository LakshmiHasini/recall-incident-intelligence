# How Recall uses Hindsight

Recall uses live Hindsight HTTP operations from server-side code in `lib/hindsight.ts`. No canned investigation or local substitute is presented as a Hindsight response.

## Retain

Resolving an incident saves the original outcome in D1 and creates a pending memory job in the same database batch. The document includes the service, environment, symptoms, confirmed cause, successful fix, verification, preventive action, and recorded attempts with their outcomes. Common credential patterns are redacted.

The document ID is stable: `incident-<incident UUID>`. An explicit resolution amendment creates another version and updates that source when synced. The application requests synchronous retain and marks the job synced only when Hindsight confirms success and synchronous completion. Failed jobs preserve the resolution and can be retried from the incident or Connections screen. Old pending jobs are superseded when a newer resolution exists; only one sync for a source can be claimed at a time. An interrupted claim becomes retryable after three minutes.

## Recall

The Memory library uses the real Recall operation for queries. It lists recent facts when there is no query. Stored application records remain in D1 so the original incident can be inspected.

## Reflect

Investigation sends the current symptoms, redacted log excerpts, service, environment, timeline and attempted fixes to Reflect. The prompt treats reports as untrusted data and distinguishes historical patterns from current observations and hypotheses. The request asks for structured output and includes `facts: {}`. Returned `based_on.memories` facts populate the evidence panel. Recall results from an independent query are not labelled as evidence used by Reflect.

Zod validates both draft and evidence-review responses. Failed or invalid review returns an actionable error; an unreviewed draft is not saved or shown. An absent answer or provider error is surfaced rather than replaced with a fabricated response. Investigation records include the incident revision; changed context gets a stale-analysis notice.

The current version adds an explicit evidence-status decision and limits presentation to one leading hypothesis. The shared normalizer validates linked fact IDs, resolves exact source-document references only through evidence returned by Hindsight, and suppresses unsupported historical hypotheses. Only linked evidence is presented as support. This checks provenance, not semantic entailment: the evaluation still found misleading explanations and one irrelevant citation. See `evaluation/REPORT.md` for the measured result and remaining failures.

## Development and production

- Local integration tests use `recall-development` and explicitly labelled synthetic test records.
- The hosted application uses `recall-incidents` and a separate D1 database.
- The API key remains in ignored local `.dev.vars` and hosted runtime secrets.
- The browser cannot choose another bank or retrieve the private key.

## Verified on 7 November 2026

- Live bank connection succeeded.
- A confirmed development resolution was retained.
- Recall returned four facts from that source.
- A subsequent incident was investigated using Reflect, returning four supporting facts and validated structured output.

Reproduce with `npm run test:local`, then `node scripts/verify-live.mjs`. The live script refuses to run against a bank other than `recall-development` and consumes Hindsight usage credits.

Current investigations use a separate evidence-review Reflect request. The review separates observed failure, historical match and unknown deeper causes; citations resolve only to returned facts. Diagnostics that mention selected unobserved integrations are explicitly conditional. Repeating an investigation for an unchanged incident revision reuses the saved reviewed result, saving model credits. New observations increment the revision and permit a fresh investigation.
