# Lead Scoring Engine (ICP Profiler)

Sales teams drown in lead lists. A spreadsheet of 500 prospects is not a pipeline — it is 500
unanswered questions: *Who is actually worth a call today? Who looks impressive but isn't a fit?
Why is this person a 7 and that one a 3?* Answering those questions by hand is slow, inconsistent,
and quietly biased by whoever happens to be reading the list that morning.

This project answers them in code. The **Lead Scoring Engine** ingests lead profiles as JSON,
runs them through a transparent six-stage scoring pipeline, and returns an **Ideal Customer
Profile (ICP) score** out of 100, a priority bucket, the component scores behind the number, and —
when an AI key is present — a plain-English explanation, a persona-fit breakdown, and a drafted
outreach email. Every number is explainable. Nothing is a black box.

It ships three ways to use it: a **batch CLI** for scoring a folder of leads, a **multi-user web
app** for drag-and-drop scoring with per-user isolation, and a **self-demo** that generates its own
data so you can see the whole thing work in one command.

> **Why it's built the way it is** — the design thinking, the trade-offs, and how the AI was
> governed during the build — lives in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). Start
> there if you care about the *why*, not just the *what*.

---

## What it does

- **Transparent scoring.** Six modules — Data Quality → Education → Experience → Thinking Quality →
  Scorer → Profiler — each contribute a visible sub-score. The final ICP score is a weighted blend
  (thinking 0.40, experience 0.35, education 0.20) plus a recency bonus, mapped to a bucket
  (`HIGH / MEDIUM / LOW / NOT FIT`). You can always see *why* a lead scored what it did.
- **AI that is strictly optional.** Score explanations, outreach emails, and tier classification
  use Gemini or OpenAI when a key is configured, and **degrade gracefully to rule-based logic**
  when it isn't. The system never falls over because an API key is missing or a model times out.
- **Persona fit.** Define a persona (skills, roles, company tiers, education) and score leads
  against it, with a gap analysis explaining what's missing.
- **Multi-user web app.** Drag-and-drop JSON upload, an in-memory processing queue with live
  progress, a history page with downloads, a config editor, persona management, and email settings —
  each browser session isolated in its own on-disk silo. No database required.
- **Self-demo.** `npm run demo` generates synthetic leads (via AI or a curated fallback set) and
  runs the full pipeline, so the project demonstrates itself with zero manual data entry.

## Stack

TypeScript (strict) · Express + EJS + Multer 2.x · Zod (single source of truth for types) ·
pino (structured logging with PII redaction) · Tailwind · Gemini / OpenAI with rule-based fallback ·
Jest (unit + integration, per-file coverage gate) · Playwright (E2E) · ESLint / Prettier / Husky /
Gitleaks. No database; all state is JSON/CSV on the filesystem, partitioned per session.

## Quickstart

```bash
npm install
cp .env.example .env          # AI keys optional; set SESSION_SECRET for the web app in prod
npm run build                 # tsc -> dist/

npm start                     # batch CLI: score every JSON file in ./input
npm run dev:server            # web app at http://localhost:3000
npm run demo                  # self-demo: generates leads and scores them, no input needed
```

Try the demo with no AI key — it uses the curated fallback dataset and still produces a believable
spread of buckets:

```bash
npm run demo -- --no-ai --persona default-icp --output ./demo-output
npm run demo -- --no-ai --html --count 10   # also writes demo-output/demo-report.html
```

## Authentication

The web app uses **session-based authentication** backed by SQLite. On first run a demo account is
seeded automatically:

| Email | Password |
|-------|----------|
| `demo@example.com` | `password` |

Anyone can create their own account via the Register page. All data is isolated per user — one
user cannot see or access another's uploaded leads or history.

> **Production note:** Set `SESSION_SECRET` in your environment. Without it a random secret is
> generated on each startup (sessions reset on restart). See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Input format

Each input file is a single profile object or an array of them:

```json
{
  "name": "Jane Doe",
  "education": ["MBA @ Harvard University"],
  "jobs": ["VP Engineering @ Stripe", "Engineer @ Google"],
  "skills": ["AI", "Strategy", "Leadership"],
  "company_details": { "name": "Stripe", "category": "fintech" },
  "years_experience": 12,
  "lastActive": "2026-05-01"
}
```

Only `name` is required. Missing fields lower the data-quality score; below a threshold the lead is
rejected rather than scored on bad data.

## The three entry points

| Mode    | Command              | Use it for                                                        |
| ------- | -------------------- | ----------------------------------------------------------------- |
| **CLI** | `npm start`          | Batch-score `./input`; writes results, a summary, and a CSV.      |
| **Web** | `npm run dev:server` | Drag-and-drop scoring, history, personas, config — multi-user with Better Auth. |
| **Demo**| `npm run demo`       | Self-contained showcase; `--no-ai`, `--persona`, `--count`, etc.  |

## Configuration

All scoring behaviour is config-driven — weights, university/company tier lists, bucket thresholds,
thinking-quality keywords, recency window, and feature flags. See [`.env.example`](./.env.example)
for environment variables (`AI_PROVIDER`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `SESSION_SECRET`,
`PORT`, `LOG_LEVEL`) and [`src/config/config.ts`](./src/config/config.ts) for the defaults. In the
web app, the **Config Editor** lets you change the live config as validated JSON — edits apply to
scoring immediately without a server restart.

## Testing & quality

```bash
npm run typecheck     # tsc --noEmit (strict)
npm run lint          # ESLint — enforces the global prohibitions (no any, no console, etc.)
npm test -- --coverage   # Jest unit + integration; per-file coverage gate
npm run test:e2e      # Playwright top-5 user journeys (boots a live server)
```

Coverage is enforced **per file**, not just in aggregate — every source file must clear
90% lines/functions/statements and 80% branches. (Why this matters:
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md#testing-strategy).)

## Project structure

```
src/
  batch/         reusable batch pipeline (shared by CLI and demo)
  cli/           CLI entry + report formatter
  config/        Zod config schema + mutable ConfigService
  db/            Drizzle ORM schema + SQLite connection + Better Auth migration & seed
  demo/          self-demo: args, fallback dataset, AI/fallback resolution, HTML report
  domain/        types inferred from Zod schemas
  lib/           errors (DomainError hierarchy), logger (pino+redaction), security (csrf, path-guard, better-auth)
  llm/           LLMClient interface + Gemini/OpenAI/Null providers + DynamicLlmClient
  modules/       the six scoring modules + explanation + outreach-email
  repositories/  file-handler, persona, session-store
  schemas/       Zod schemas (single source of truth)
  web/           Express server, middleware, controllers, routes, EJS views
demo.ts          demo entry glue
tests/           unit/ integration/ e2e/
docs/            architecture (ADRs), deployment, video script, case study, ci, security
```

## Documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — design thinking, decisions, process, traceability.
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — how to deploy and run it in production.
- [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md) — portfolio case study with problem, solution, results.
- [`docs/VIDEO_SCRIPT.md`](./docs/VIDEO_SCRIPT.md) — 2-minute Loom demo recording script.
- [`docs/architecture/`](./docs/architecture/) — Architecture Decision Records (ADRs 001–006).
- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) — module catalogue, roadmap, traceability matrix.
- [`requirement.md`](./requirement.md) — the full software requirements specification.

## License

See repository.
