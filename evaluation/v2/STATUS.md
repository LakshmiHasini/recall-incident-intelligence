# Accuracy enhancement — work in progress

Date: 7 November 2026. **Prepared for publication. No new accuracy percentage is established.** The deployed d1de401 version's original measured result remains 25/30 (83.3%) on its original synthetic set; it is not the measured score of this local enhancement.

## Implemented locally

- A shared production/evaluation pipeline runs a draft Reflect request followed by a separate evidence-review Reflect request. A failed or invalid review cannot fall back to a draft or be saved as a completed investigation.
- The review separates current observations, historical mechanism match and unknown deeper causes. A no-match decision removes historical citations from the presented answer.
- Response schemas describe uncertainty, constrain evidence IDs to supplied facts and request consistent hypothesis/status fields. Runtime normalization still checks actual returned provenance. Provider schema instructions alone do not establish semantic correctness.
- HTTP 402 now reports exhausted Hindsight credits clearly, without exposing provider response bodies. The v2 runner stops future queued work when this condition is recognized.

## Validation completed

- 27/27 unit tests, including review failure, invalid output, citation removal and billing error handling.
- 24/24 application API checks. The new result is in results/api-tests.json; the original evaluation artifact was preserved.
- A real API investigation called the live two-pass Hindsight pipeline and persisted an observation-grounded disk-space diagnosis. See results/live-api-review.json. This preceded the final error-message change; no investigation logic changed afterward.
- TypeScript and production build passed after the final changes. git diff --check passed.

These are reliability checks, not a new answer-accuracy score.

## Calibration findings and blocker

Four six-case calibration versions are preserved in results/regression-v1 through regression-v4. These are known development cases and cannot be represented as unseen-test accuracy. They exposed unsupported assumptions in diagnostic checks, inconsistent structured status, irrelevant citations and missing historical citations. Some issues improved, but missing required citations remain unresolved. The final calibration's T16 and T18 requests failed with HTTP 402. No failed attempt was deleted or silently retried.

Hindsight's billing documentation states that exhausted credits produce HTTP 402 until credits are added: https://docs.hindsight.vectorize.io/cloud/billing/ . No further paid live evaluation was attempted after this blocker. The deployment was deliberately held back because calibration is unfinished.

## Fresh evaluation prepared, not run

- PROTOCOL.md preregisters the strict rubric and requires at least 37/40 passes to exceed 90%.
- holdout.json contains 40 new scenario inputs; expected.json is the separate prewritten answer key. The runner never loads the key.
- There are 12 historical recurrence cases, 18 observed-failure cases, nine insufficient-evidence cases and one paired before/after learning case. This requires 41 end-to-end attempts, up to 82 Reflect requests, plus seed-memory operations.
- scripts/evaluate-agent-v2.mjs uses an isolated bank and the same pipeline as production, persists outputs immediately and refuses mixed fingerprints. scripts/score-evaluation-v2.mjs screens outcomes and incorporates full per-case semantic review.
- The holdout is not yet frozen in lock.json. Do not run it until calibration is complete. Never tune on its failures and call a rerun unseen.

## Resume after credits are restored

1. Resolve the calibration citation failures and recheck the six regression cases in a new recorded run version. Preserve all previous attempts.
2. Re-run affected unit/type checks. Freeze code, client, schemas, runner, scorer, rubric, inputs, answer key, seed memories and learning event hashes in lock.json.
3. Run `node --experimental-transform-types scripts/evaluate-agent-v2.mjs holdout v1` once. Record every failure and unrun case; do not select retries.
4. Review every full presented answer and supporting fact, including checks and cautions, against the preregistered rubric. Record reasons, then run the v2 scorer. State that labels and review are by the implementation assistant, not independent reviewers.
5. Report the observed result and limitations honestly. Deploy only the exact validated source using the Sites workflow and update the private GitHub repository. A score above 90% on this synthetic set is still not a production-wide guarantee.

## Credit-preserving release update

A new authorized Hindsight account was connected, with dedicated development and production banks. Its starting UI balance was $5.00. Two targeted v5 calibration cases used four Reflect calls; their outputs remain calibration data, not a new accuracy percentage. Citation retention and the throughput hypothesis improved, but semantic limitations remain. An additional conditional diagnostic qualifier addresses presupposed integrations. The user explicitly requested minimal credit usage so judges can test: the planned 40-case holdout was cancelled before execution and no lock.json or new headline score was created.

The release also includes the requested Nexa Talent-inspired visual design, anonymous public landing page, authenticated workspace, public repository, and reuse of completed investigations for unchanged incident revisions. Further verification is limited to one final live investigation (two Reflect calls) plus a free repeat request checking reuse. Unit, type, API and browser checks do not call the paid model.
