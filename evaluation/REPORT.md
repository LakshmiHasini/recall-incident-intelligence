# Recall accuracy evaluation — 7 November 2026

## Result

**Strict scenario success: 83.3% (25/30).** This is performance on a small, assistant-authored synthetic benchmark, reviewed by the implementation assistant. It is not independently validated production accuracy or a guarantee. The Wilson 95% interval is 66.4–92.7%; correlated and synthetic scenarios further limit generalization.

The leading diagnostic direction was correct on **22/23 answerable cases (95.7%)**. All **7/7 insufficient-evidence cases** produced an explicit abstention and diagnostic checks. All **18/18 cases requiring a particular historical source** included that source, but this does not mean every citation supported every claim. T16 illustrates an irrelevant citation despite a correct leading diagnosis.

## What was run

- Three six-case calibration runs before the benchmark. Changes were based only on calibration outputs.
- One locked 30-case benchmark, with an additional pre-learning request for the paired learning case: 31 final live Reflect requests.
- Historical memory retention, source-document correction and a later learning event in an isolated bank.
- 20 focused unit tests, 24 local API checks and 5 anonymous-access checks against a built production worker. These reliability checks are separate from agent answer accuracy.
- TypeScript checks and a production build.

All 31 benchmark requests succeeded and produced valid structured output. Median latency was 7.727 seconds; the nearest-rank 95th percentile was 10.572 seconds. The exact underlying Hindsight Cloud model was not pinned, so repeated runs may differ.

## Strict failures

- **T04:** Correct stale-JWKS direction, but added an unsupported defect/configuration explanation for automated refresh.
- **T06:** Correct poison/schema-event direction, but introduced a schema registry without evidence that one exists.
- **T07:** Correct DNS direction, but asserted a specific incorrect/unreachable resolver entry without configuration evidence.
- **T16:** Correct staging capacity diagnosis, but used a production connection-leak fact as supporting evidence for a different failure.
- **T18:** Recognized ingest exceeding consumption, but abstained rather than presenting the expected supported throughput/capacity hypothesis.

A further operational concern in T08 was the suggestion of Redis KEYS as an alternative to SCAN. It was not counted as a destructive-operation failure under the preregistered rubric, but it warrants review on large production caches.

## Why the score is lower than automatic checks

Automated concept, source-ID and structure checks passed 29/30 cases (96.7%). Review of explanations and evidence found four additional semantic failures. The published headline uses the stricter 25/30 score rather than the more flattering automatic number.

## Improvements tested and included

- Production and evaluation now share one query builder and result normalizer.
- Explicit insufficient-evidence state; vague incidents do not receive ranked guesses.
- One leading hypothesis to reduce speculative padding.
- Historical claims must link to returned facts or exact returned source-document IDs.
- Unlinked historical hypotheses are withheld; only linked facts appear as supporting evidence.
- Clearer treatment of proposed prevention and corrected source versions.

These reduce failures but do not eliminate hallucination, misleading evidence, or excessive abstention. The benchmark failures remain documented; the same test was not repeatedly tuned until it appeared perfect.

## Method and audit files

- Protocol: `evaluation/PROTOCOL.md`
- Inputs: `evaluation/inputs.json`
- Separate hidden expectations: `evaluation/expected.json`
- Historical seed reports: `evaluation/memories.json`
- Frozen hashes: `evaluation/locked-run.json`
- Raw and rendered outputs: `evaluation/results/benchmark-v4/T*.json`
- Per-case review reasons: `evaluation/results/benchmark-v4/review.json`
- Machine-readable score: `evaluation/results/benchmark-v4/score.json`

The runner never loads or sends the expected answer key. It calls the same Hindsight client, prompt builder and normalizer as the production API. Test records are synthetic and are stored outside the production memory bank.

## Reproduction

```sh
npm test
npm run typecheck
npm run dev
# In another terminal:
npm run test:api
npm run eval:score
```

Live evaluation consumes Hindsight credits. Replaying a completed run reuses persisted results with matching fingerprints. A genuinely new before/after learning experiment needs a fresh isolated bank: do not overwrite the original results or treat its already-learned state as a fresh baseline. Read the runner and protocol before starting a new version.

## Next validation needed

Have an engineer independently review the labels and grades, test on real incident reports with permission, expand the unseen-case set, and run repeatability checks. No finite synthetic test establishes perfect working accuracy.
