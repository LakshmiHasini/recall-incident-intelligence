# Recall

**Incident intelligence that learns from every resolution.**

Recall helps engineers investigate incidents using their team's previous experience. It uses real Hindsight Retain, Recall and Reflect operations and makes supporting memory visible. Original reports, timelines and verified outcomes persist in a SQL database.

## Features

- Create, search and filter incidents across services and environments.
- Capture logs, observations, attempted fixes and their outcomes.
- Generate live, memory-grounded investigations with evidence from Hindsight.
- Resolve incidents, retain the lesson, and explicitly amend a resolution when evidence changes.
- Preserve resolutions during provider failures and retry pending memory jobs.
- Browse and search the real memory bank.
- Import existing reports for review and resolution confirmation.
- Receive authenticated monitoring events with duplicate-event handling.
- Responsive workspace, connection diagnostics and hosted authentication.

This is a single shared team workspace. The deployed Site stays owner-private. The app recommends checks and does not execute production commands.

## Stack

React, TypeScript, Tailwind CSS, Lucide, Vinext/Vite, server-side route handlers, Cloudflare D1, Drizzle, Zod and Hindsight Cloud. Band desktop is used in the required development setup. Hindsight Reflect supplies the initial reasoning layer; no separate LLM account is necessary.

## Run locally

Requires Node.js 22.13 or later, npm, and Git. The node-based tests use the experimental TypeScript transform flag available in the tested Node 22.19 environment.

```sh
npm run install:ci
cp .dev.vars.example .dev.vars
```

Fill the ignored `.dev.vars` with your own API endpoint, key, bank ID and a random webhook secret. Create a dedicated development bank in Hindsight Cloud. Never put credentials in browser code or commit `.dev.vars`.

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_fancy_blizzard.sql
npm run dev
```

Open the Local URL printed by the server, usually `http://127.0.0.1:5173`. Changes to `.dev.vars` require a server restart. These instructions apply the initial migration to a fresh local database. When updating an existing database, apply only its pending migrations.

Local loopback development works without a hosted login. Hosted browser writes require platform authentication. Database state stays in ignored `.wrangler/state` across restarts.

## Verify

```sh
npm run typecheck
npm test
npm run test:local
node scripts/verify-live.mjs
npm run build
```

The focused tests mock provider responses to exercise request schemas and failures; they are not evidence of live connectivity. `test:local` creates an explicitly labelled synthetic record in the local database. `verify-live.mjs` performs actual Hindsight operations, requires the local bank ID `recall-development`, and consumes usage credits. It verifies retain → recall → later incident reflection with source facts.

Verified during development: 13 focused tests, persistent local incident workflow, failed-action recording, stale-update rejection, atomic resolution/job creation, authenticated webhook deduplication, a live Hindsight connection, four recalled facts, four reflection facts, and structured investigation output.

## Hindsight configuration

- `HINDSIGHT_BASE_URL`: API origin from your connection instructions.
- `HINDSIGHT_API_KEY`: private server-side API key.
- `HINDSIGHT_BANK_ID`: memory bank controlled by the server.
- `WEBHOOK_SECRET`: independent private token for monitoring intake.

The hosted app uses runtime secrets and a separate production D1 database. Local verification uses `recall-development`; production uses `recall-incidents`. The hosting manifest declares the `DB` binding. The platform handles hosted identity and private access.

## Monitoring intake

`POST /api/webhooks/incidents`, with `Authorization: Bearer <WEBHOOK_SECRET>` and this JSON shape:

```json
{
  "provider": "your-monitor",
  "eventId": "unique-provider-event-id",
  "title": "Payment requests timing out",
  "service": "payments",
  "environment": "production",
  "severity": "SEV2",
  "description": "Describe observed symptoms and impact.",
  "logs": "Relevant redacted log excerpts."
}
```

Private hosting additionally requires platform service access. A generic receiver is implemented; connect and verify your actual monitoring provider before describing it as a named integration.

## Source layout

- `components/workspace.tsx`: interactive workspace and forms.
- `app/api/[...path]/route.ts`: route entrypoint.
- `lib/server.ts`: incident workflow, access checks and memory synchronization.
- `lib/hindsight.ts`: actual provider requests and failure handling.
- `lib/validation.ts`: input schemas and memory document construction.
- `db/schema.ts`, `drizzle/`: database schema and versioned migration.
- `tests/`, `scripts/verify-*.mjs`: focused and live checks.

## Project documentation

- [Implementation phases](PHASES.md)
- [Complete roadmap](ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Hindsight implementation](docs/HINDSIGHT.md)
- [Live walkthrough and submission checklist](docs/DEMO-SCRIPT.md)
- [Starter-specific tooling notes](docs/STARTER.md)

## Remaining submission work

Publish the clean source to the team's GitHub repository, record the working project, verify judge access, and complete each member's required article, social post and video. Obtain the organizers' separate content guide before finalizing those materials.
