# Lead Scoring Engine (ICP Profiler)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel%20Production-black?style=for-the-badge&logo=vercel&logoColor=white)](https://lead-scoring-engine-three.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3%20Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Test Suite](https://img.shields.io/badge/Tests-317%20Passed-2ea44f?style=for-the-badge&logo=jest&logoColor=white)](./tests)
[![Per-File Coverage](https://img.shields.io/badge/Coverage-90%25%20Floor-success?style=for-the-badge&logo=jest&logoColor=white)](./jest.config.js)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-Groq%20%7C%20Gemini%20%7C%20OpenAI-F55036?style=for-the-badge)](./src/llm)
[![Auth & Database](https://img.shields.io/badge/Auth-Better%20Auth%20%2B%20SQLite-4F46E5?style=for-the-badge&logo=sqlite&logoColor=white)](https://better-auth.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](./LICENSE)

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
- **AI with multi-model failover.** Score explanations, outreach emails, and tier classification
  support **Groq** (with automatic fallback from `openai/gpt-oss-20b` @ 1000 T/s to `openai/gpt-oss-120b` @ 500 T/s), **Gemini**, **OpenAI**, and **Ollama**, with **seamless degradation to rule-based logic**
  when no key is present or when APIs hit rate limits.
- **Persona fit.** Define a persona (skills, roles, company tiers, education) and score leads
  against it, with a gap analysis explaining what's missing.
- **Multi-user web app.** Drag-and-drop JSON upload, an in-memory processing queue with live
  progress, a history page with downloads, a config editor, persona management, and email settings —
  each user isolated in its own on-disk silo (`data/sessions/{userId}/`).
- **Serverless-ready.** Fully configured for **Vercel Serverless Functions** (`api/index.ts` and `vercel.json`), with automated SQLite `/tmp` directory handling and dynamic CORS/trusted-origins detection.
- **Self-demo.** `npm run demo` generates synthetic leads (via AI or a curated fallback set) and
  runs the full pipeline, so the project demonstrates itself with zero manual data entry.

## 🧠 First-Principles Engineering & Problem Solving

When building this engine, we refused to build another black-box AI wrapper. We deconstructed the lead qualification problem to its fundamental truths:

```
                          ┌──────────────────────────┐
                          │   Raw Unstructured Lead  │
                          └─────────────┬────────────┘
                                        │
                         [ 1. Binary Integrity Gate ]
                             Is data sufficient?
                                   /      \
                             (NO) /        \ (YES)
                                 ▼          ▼
                        [REJECT PROFILE]  [ 2. Split Evaluation Layers ]
                                            ├─ Deterministic Math Layer
                                            │  (Years, Tiers, Recency Curve)
                                            └─ Semantic Intelligence Layer
                                               (Groq Dual-Model / Rule Fallback)
                                                    │
                                          [ 3. Weighted Synthesis ]
                                          ICP Score = 0.40(Think) + 0.35(Exp) + 0.20(Edu) + Recency
                                                    │
                                          [ 4. Full Auditability ]
                                          Visible Sub-Scores + Explainable Narrative
```

### 1. The Core Engineering Dilemma
- **The Pitfall of Pure LLMs:** Sending entire lead profiles to a single prompt is expensive (\$0.05+/lead), non-deterministic, slow (2–5s per lead), hallucination-prone, and cannot be mathematically audited.
- **The Pitfall of Pure Regex:** Brittle rule systems fail when faced with minor job title variations or unknown university names.
- **First-Principles Solution:** **Hybrid Deterministic-Semantic Architecture.**
  - **Deterministic Math Engine:** Calculates objective parameters (tenure, years of experience, weight distribution, recency bonuses) with 100% mathematical reproducibility.
  - **Semantic AI Layer:** Used exclusively where LLMs excel — entity classification of unknown companies/universities and personalized sales outreach generation.

### 2. Practical Problem Solving in Action

| Real-World Challenge | First-Principles Trade-off | Engineering Solution |
|---|---|---|
| **Garbage Data Poisoning** | Scoring incomplete profiles creates confidently false numbers. | **Data Quality as a Gate:** Profiles with missing core attributes are rejected upfront at $0$ computational overhead before touching the scoring pipeline. |
| **AI Dependency & Rate Limits** | External AI APIs experience outages, 429 rate limits, and latency spikes. | **Dual-Model Auto-Failover + Offline Fallback:** Primary Groq `openai/gpt-oss-20b` (1,000 T/s) automatically fails over to `openai/gpt-oss-120b` (500 T/s), with a 3rd-tier zero-cost rule-based fallback. Zero downtime guarantee. |
| **Multi-Tenant Security Risks** | Multi-user uploads could cause path traversal or cross-tenant data leaks. | **Storage Silos + Path Containment:** Every user has an isolated filesystem silo (`data/sessions/{userId}/`) validated by a mathematical path-containment guard (`resolveWithin`). |
| **Serverless vs Stateful DB** | SQLite WAL mode fails on read-only/ephemeral serverless lambdas. | **Dynamic Runtime Storage Adapter:** Automatically paths SQLite to `/tmp/icp.db` with `MEMORY` journal pragma in serverless while maintaining WAL mode in local development. |
| **Test Laundering via Averages** | A 95% repo coverage average can hide a critical module with 20% coverage. | **Strict Per-File Coverage Floors:** Enforced 90% statement/line and 80% branch minimums across *every single file* in the codebase (31/31 suites passing). |

## Stack

TypeScript (strict) · Express + EJS + Multer 2.x · Better Auth + Drizzle ORM (SQLite) · Zod (single source of truth) ·
pino (structured logging with PII redaction) · Tailwind · Groq / Gemini / OpenAI / Ollama with rule-based fallback ·
Jest (unit + integration, per-file coverage gate) · Playwright (E2E) · ESLint / Prettier / Husky / Gitleaks · Vercel Serverless.

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

## Vercel Deployment

Deploy directly to Vercel using the Vercel CLI or Git integration:

```bash
# 1. Login & deploy preview
npx vercel

# 2. Deploy to production
npx vercel --prod
```

Configure your environment variables in Vercel:
- `SESSION_SECRET`: Random 32+ character string.
- `BETTER_AUTH_SECRET`: Random 32+ character string.
- `AI_PROVIDER`: `groq` (or `gemini` / `openai` / `none`).
- `GROQ_API_KEY`: Your Groq API key.
- `VERCEL`: `1` (automatically set by Vercel).

## Authentication

The web app features secure multi-user authentication powered by **Better Auth** backed by **SQLite** (`data/icp.db` or `/tmp/icp.db` on Vercel).

- **Email & Password Authentication:** Register and sign in directly via `/auth/register` and `/auth/login`.
- **Google OAuth 2.0:** One-click single sign-on via Google OAuth integration (`AUTH_GOOGLE_CLIENT_ID` & `AUTH_GOOGLE_CLIENT_SECRET`).
- **Complete User Isolation:** All lead files, job queues, and scoring histories are partitioned in per-user storage silos (`data/sessions/{userId}/`) protected by filesystem path guards.

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
- [`docs/SPECS.md`](./docs/SPECS.md) — technical specifications & portfolio showcase document.
- [`docs/REQUIREMENTS.md`](./docs/REQUIREMENTS.md) — full software requirements specification (SRS).
- [`docs/NEXT_PHASE.md`](./docs/NEXT_PHASE.md) — product roadmap & cloud deployment guide.
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — how to deploy and run it in production.
- [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md) — portfolio case study with problem, solution, results.
- [`docs/VIDEO_SCRIPT.md`](./docs/VIDEO_SCRIPT.md) — 2-minute Loom demo recording script.
- [`docs/architecture/`](./docs/architecture/) — Architecture Decision Records (ADRs 001–006).
- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) — module catalogue, roadmap, traceability matrix.

## License

See repository.
