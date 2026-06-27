# PROJECT_PLAN.md — Lead Scoring Engine (ICP Profiler)

**Status:** Production Ready (Better Auth, Google OAuth, Glassmorphic UI & Single-Use Demo Complete) — 100% Quality Gates & Per-File Coverage Floor Met.  
**Date:** 2026-06-27  

## 0. Binding decisions (from Phase 0 sign-off)

| Decision        | Value                                                         | Consequence                                                                  |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Risk tier       | **Commercial/Production**                                     | All GUARDRAILS/PIPELINE_OPS/CODING modules bind.                             |
| Conflict policy | **CLAUDE.md fully wins**                                      | Manifesto overrides spec where they disagree.                                |
| Language        | **TypeScript** (strict, `tsc` gate)                           | Overrides requirement §2.5 "plain JS / no transpilation". Adds a build step. |
| Spec            | Part 1 treated as the complete SRS                            | Stubs filled via logged `ASSUMPTION`s (§6).                                  |
| Process         | Merged: your Phase 0–4 + manifesto gates                      | PROJECT_PLAN doubles as PRD/RFC/Roadmap + traceability.                      |
| AI providers    | Gemini + OpenAI via `AI_PROVIDER`; Anthropic/Claude pluggable | `NullProvider` gives rule-based graceful degradation.                        |

---

## 1. Tech stack

- **Runtime/lang:** Node.js ≥18, **TypeScript** (strict), compiled to **CommonJS** (`tsc`); dev via `tsx`.
- **Web:** Express 4, EJS views, **Multer 2.x** (1.x is deprecated/vulnerable — GUARDRAILS 6.2), **Better Auth + Drizzle ORM (SQLite)** for user authentication (`/api/auth/*`), `express-session` (strictly for CSRF synchronizer tokens).
- **Security:** `helmet` (GUARDRAILS 2.8), **custom synchronizer-token CSRF** middleware backed by session (GUARDRAILS 2.5 — avoids deprecated `csurf`), `path.basename` path-guard (SEC-05/06).
- **Validation:** **Zod** schemas as single source of truth (CODING 1.10) for profiles, personas, config, email-settings, upload.
- **Logging:** **pino** structured logger with redaction array + `correlationId` + `durationMs` (GUARDRAILS 6.4 / CODING 4.7).
- **LLM:** `@google/generative-ai`, `openai`; `LLMClient` interface; `NullProvider` fallback. MSW mocks in tests.
- **Testing:** **Jest + ts-jest** (unit/integration, AAA, factories, fake timers), **Playwright** (E2E top-5 journeys), **MSW** (mock Gemini/OpenAI). Coverage gate: services ≥80%, utils ≥90% (CODING 7.1, Commercial).
- **Quality gates:** ESLint (`typescript-eslint`, `eslint-plugin-compat`) + Prettier + Husky/lint-staged (lint, format, `tsc`, **gitleaks**) — GUARDRAILS 4.1.
- **CI:** `.github/workflows/` → `ci.yml` (lint/tsc/unit), `security.yml` (SAST/SCA/secret-scan/SBOM/dependency-review), `e2e.yml` (Playwright). PR blocks per GUARDRAILS 4.2.
- **DI:** manual constructor injection; composition roots in `cli/index.ts`, `web/server.ts`, `demo.ts` (CODING 2.3). No DI framework.
- **CSS:** Tailwind (build step → `public/`), accent `#0029ff` (USA-01).

---

## 2. Directory tree (high-level)

```
Repo-3/
├── src/
│   ├── config/            config.ts (defaults) · config.schema.ts (Zod)
│   ├── domain/            profile/result/persona/scoring .types.ts
│   ├── schemas/           profile · persona · email-settings · upload (Zod SoT)
│   ├── lib/
│   │   ├── errors/        codes.ts (ErrorCode enum) · domain-errors.ts (+status map)
│   │   ├── logger/        logger.ts (pino + redact)
│   │   └── security/      path-guard.ts · csrf.ts
│   ├── modules/           SERVICE layer (one class each, DI):
│   │                      data-quality · education · experience · thinking-quality ·
│   │                      scorer · persona-matcher · explanation · outreach-email ·
│   │                      profiler (orchestrator)
│   ├── repositories/      file-handler · persona · session-store
│   ├── llm/               llm-client.interface · gemini · openai · null · factory
│   ├── batch/             run-batch.ts (shared by CLI + demo — MAIN-03)
│   ├── cli/               index.ts (CLI entry)
│   └── web/
│       ├── server.ts      Express composition root
│       ├── middleware/    correlation-id · session · csrf · helmet · multer · error-handler
│       ├── controllers/   upload · job · history · config · persona · email (≤15 lines each)
│       ├── routes/        route→controller wiring
│       ├── services/      queue.service.ts (in-memory job queue)
│       └── views/         EJS: index · history · config-editor · personas · persona-edit ·
│                          email-settings · partials/
├── demo.ts                F-15 self-demo entry
├── public/                Tailwind output + client JS (polling, dropzone, clipboard)
├── personas/              default-icp.json (packaged)
├── data/                  demo-fallback.json · sessions/ (gitignored)
├── input/ output/ logs/   runtime dirs (gitignored; sample kept)
├── tests/                 unit/ integration/ e2e/ factories/ mocks(MSW)/
├── docs/                  architecture/ (ADRs) · security/ · ci/
├── .github/workflows/     ci.yml · security.yml · e2e.yml
├── .husky/                pre-commit
├── package.json tsconfig.json .eslintrc.cjs .prettierrc .gitignore
├── .env.example  tailwind.config.js  postcss.config.js
└── PROJECT_PLAN.md
```

---

## 3. Module catalogue (responsibility → layer → key reqs)

| Module                     | Layer                  | Responsibility                                                                    | Reqs                         |
| -------------------------- | ---------------------- | --------------------------------------------------------------------------------- | ---------------------------- |
| `config` + `config.schema` | Config                 | Default config object + Zod validation for editor                                 | F-11, FR-11-003              |
| `lib/errors`               | Cross-cutting          | `ErrorCode` enum + `DomainError`/`NotFound`/`Validation`/`Forbidden` + status map | CODING 2.5/2.5.1             |
| `lib/logger`               | Cross-cutting          | pino, redaction, correlationId                                                    | F-09, SEC-07, GUARDRAILS 6.4 |
| `lib/security`             | Cross-cutting          | path-guard, CSRF token                                                            | SEC-05/06, GUARDRAILS 2.5    |
| `data-quality.service`     | Service                | Completeness score, `shouldProcess`, missingFields                                | F-02                         |
| `education.service`        | Service                | Parse highest degree, tier, sub-score                                             | F-03                         |
| `experience.service`       | Service                | Company extraction, tiering, sub-score                                            | F-04                         |
| `thinking-quality.service` | Service                | Visionary/leadership keyword scoring                                              | F-05                         |
| `scorer.service`           | Service                | Weighted score, recency bonus, bucket/priority                                    | F-06                         |
| `persona-matcher.service`  | Service                | Education/experience/skills fit, gap analysis                                     | F-12                         |
| `explanation.service`      | Service                | LLM narrative (fallback null)                                                     | F-13                         |
| `outreach-email.service`   | Service                | Tone-mapped email draft (fallback null)                                           | F-14                         |
| `profiler.service`         | Service (orchestrator) | Runs pipeline, assembles result                                                   | F-01, FR-01-007              |
| `file-handler.repository`  | Repository             | Read input, write result/summary/CSV, record IDs                                  | F-07, F-08                   |
| `persona.repository`       | Repository             | personas/ CRUD + `.trash`                                                         | F-12                         |
| `session-store.repository` | Repository             | session-scoped dir creation/resolution                                            | F-16                         |
| `llm/*`                    | Adapter                | Provider abstraction + graceful degradation                                       | F-13/14/15, §2.5             |
| `batch/run-batch`          | Application            | Reusable batch pipeline for CLI + demo                                            | MAIN-03, FR-15-007           |
| `web/services/queue`       | Application            | In-memory sequential queue, progress                                              | F-10, PERF-04                |
| `web/controllers/*`        | Controller             | Parse → call service → map HTTP (skinny)                                          | F-10..F-17                   |
| `cli/index` · `demo`       | Entry                  | Composition roots                                                                 | F-01, F-15                   |

---

## 4. Implementation sequence (bottom-up — CODING 4.2; each = a `feature/*` branch)

1. **Foundation:** errors → logger → security (path-guard, csrf) → domain types → Zod schemas. _(Verify: unit tests, tsc, lint.)_
2. **Config:** defaults + schema + mutable ConfigService. _(FR-11-003 validation tests.)_
3. **Repositories:** file-handler (record IDs, result/summary/CSV) → persona → session-store. _(Integration tests in temp dirs; path-traversal tests.)_
4. **LLM abstraction:** interface → null → gemini → openai → factory. _(MSW-mocked tests + degradation test.)_
5. **Scoring services** (pure, DI): data-quality → education → experience → thinking → scorer. _(AAA unit tests, fake timers for recency.)_
6. **Persona matcher** (highest-risk algorithm — front-loaded per Phase-0 pitfall). _(Tier-ordering + gap-analysis tests.)_
7. **Profiler orchestrator** + **run-batch**. _(Integration: full pipeline on fixtures.)_
8. **CLI** (`cli/index`). _(E2E: input/ → output/ + CSV.)_
9. **AI features:** explanation → outreach-email (wired into profiler via flags). _(Mocked + null-fallback tests.)_
10. **Web core:** middleware (correlationId, session, csrf, helmet, multer, error-handler) → queue → upload/job/history controllers + routes → EJS views + Tailwind + client JS. _(Integration + supertest.)_
11. **Web features:** config editor → persona pages/API → email settings/regenerate/export → multi-user isolation. _(Per-feature integration; cross-session isolation test.)_
12. **Self-demo** (`demo.ts`, chalk v4, fallback set). _(E2E `npm run demo --no-ai`.)_
13. **E2E suite** (Playwright top-5 journeys) + **CI workflows** + **Husky/gitleaks** + **SBOM**.
14. **Docs:** README (quickstart, env, screenshots), ADRs, traceability matrix close-out.

---

## 5. Verification approach

- **Per unit:** Jest AAA + factories; `tsc --noEmit`; ESLint; ≥80% service / ≥90% util coverage.
- **Integration:** real filesystem in OS temp dirs; MSW for LLM; supertest for routes.
- **E2E (top-5 journeys, Playwright):** (a) upload→process→history→download; (b) persona create→set active→match→gap; (c) config edit→persisted in-memory; (d) email generate→copy→export TXT; (e) `npm run demo` end-to-end.
- **Security gate:** gitleaks pre-commit + CI; helmet/CSRF/path-traversal tests; no hardcoded secrets (SEC-01); SBOM + dependency-review in `security.yml`.
- **Traceability:** every `FR-xx-xxx` mapped to a module + task + test before close (manifesto Phase 4.4). Orphaned `SHALL` → HALT.

---

## 6. Logged assumptions (need your sign-off — `@ai-accept-assumptions`)

- **ASSUMPTION-1:** University/company `tier_1/2/3` lists (stubbed `[...]`) — I'll seed reasonable defaults (e.g. tier_1 = IIT/Stanford/MIT/Oxbridge; FAANG+unicorns) and make them config-editable. _Risk if wrong: scores shift; mitigated by editability._
- **ASSUMPTION-2:** Full `buckets` array — HIGH 90–100 / 80–89, MEDIUM 70–79 / 60–69, LOW 40–59, NOT FIT 0–39, with priorities/conversion per README §3 of the prior project. _Risk: bucketing differs from intent._
- **ASSUMPTION-3:** `LLMClient` contract = `classifyUniversity`, `classifyCompany`, `generateProfiles`, `generateExplanation`, `generateEmail`, each returning `{ success, data, error }`. _Risk: provider-specific parsing._
- **ASSUMPTION-4:** "CLAUDE.md fully wins" + TS means **Joi→Zod, JS→TS, csurf→custom CSRF, multer1→multer2, console→pino**; I will NOT add a database (spec hard-constraint, no rule conflict). _Risk: none expected._
- **ASSUMPTION-5:** Acceptance criteria (Part 2 not separately written) = each `FR`/`SEC`/`PERF`/etc. ID verified by its mapped test. _Risk: hidden criteria; surfaced as found._

---

## 7. Open conflicts already resolved by your choices

JS→TS (resolved: TS) · validation lib (Zod) · CSRF/helmet (mandatory) · tests (mandatory, 80%) · multer version (2.x). No remaining blockers to scaffold.

```

```

```

```

**Next step:** awaiting approval of this plan + `@ai-accept-assumptions` before Phase 2 (git init + scaffold).
