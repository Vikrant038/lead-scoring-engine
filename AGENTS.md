AGENTS.md â€” Lead Scoring Engine (ICP Profiler)
> High-signal guidance for agents working in this repo. Every line answers: "Would an agent likely miss this without help?"
---
## Project Identity
- **Name:** `lead-scoring-engine` â€” multi-user ICP Profiler (batch CLI, web app, self-demo)
- **Stack:** TypeScript (strict) Â· Express + EJS + Multer 2.x Â· Better Auth + Drizzle ORM (SQLite) Â· Zod (single source of truth) Â· pino (PII redaction) Â· Tailwind Â· Gemini/OpenAI with rule-based fallback Â· Jest (unit+integration, **per-file coverage gate**) Â· Playwright (E2E) Â· ESLint/Prettier/Husky/Gitleaks
- **Database & Storage:** SQLite (`data/icp.db`) via Better Auth for user identity and sessions; job files are JSON/CSV on disk partitioned per user (`data/sessions/{userId}/`)
- **Risk tier:** Commercial/Production â€” all standards are mandatory
---

Exact Developer Commands
# Setup
npm install
cp .env.example .env          # AI keys optional; SESSION_SECRET required for prod web
# Build & run
npm run build                 # tsc -> dist/
npm start                     # batch CLI: scores every JSON file in ./input
npm run dev:server            # web app at http://localhost:3000
npm run demo                  # self-demo (generates leads + scores); --no-ai, --persona, --count
# Quality gates (run in this order locally)
npm run typecheck             # tsc --noEmit (strict)
npm run lint                  # ESLint â€” enforces global prohibitions (no any, no console, etc.)
npm test -- --coverage        # Jest unit + integration; **per-file coverage gate**
npm run test:e2e              # Playwright top-5 journeys (boots live server)
# CSS (Tailwind)
npm run build:css             # builds public/css/app.css
CI order (enforced in .github/workflows/ci.yml): typecheck â†’ lint â†’ test --coverage
---
Entry Points (Three Ways In)
Mode	File	Purpose
CLI	src/cli/index.ts	Batch-score ./input; writes results, summary, CSV
Web	src/web/server.ts	Express app â€” drag-and-drop, history, personas, config, email settings
Demo	demo.ts	Self-contained showcase; --no-ai, --persona, --count, --output
---
Architecture (Must Know)
Scoring Pipeline (Uni-directional)
Data Quality â†’ Education â†’ Experience â†’ Thinking Quality â†’ Scorer â†’ Profiler
   (gate)        (0.20)       (0.35)           (0.40)          (+recency)  (assemble)
- Data Quality is a gate: profiles below threshold are rejected, not scored
- Weights live in config (src/config/config.schema.ts), editable via web Config Editor
- AI is optional: NullProvider activates when no key; all consumers check llm.available and fall back
Layered Web Flow
Route â†’ Controller â†’ Service â†’ Repository â†’ filesystem
- Controllers: skinny (parse, call service, map to HTTP)
- Services: business logic + cross-cutting concerns
- Repositories: only touch storage
- Errors: typed DomainError hierarchy â†’ single global handler â†’ generic envelope (correlation ID logged, never leaked)
Multi-User Isolation (Better Auth + Storage Silos)
1. User identity: Managed by Better Auth (`/api/auth/*`) backed by SQLite (`data/icp.db`). Express-session retained strictly for CSRF tokens (`icp.sid`).
2. Session silos: `data/sessions/{userId}/{input,output}` â€” routes only resolve inside caller's user silo.
3. Path guard: `resolveWithin` in `src/lib/security/path-guard.ts` â€” rejects any path escaping intended root.
AI Abstraction (Strategy Pattern)
interface LLMClient {
  readonly available: boolean;
  classifyUniversity(name): Promise<LlmResult<Tier>>;
  generateEmail(input): Promise<LlmResult<OutreachEmail>>;
}
Providers: GeminiProvider, OpenAIProvider, NullProvider. Factory picks from AI_PROVIDER + key.
---
Configuration (Zod = Single Source of Truth)
- Schema: src/config/config.schema.ts â AppConfig type
- Runtime service: src/config/config.service.ts (ConfigService â mutable, validated on edit)
- Web Config Editor (/config) edits live config as validated JSON â applies to scoring immediately
- Env vars: .env.example â AI_PROVIDER, GEMINI_API_KEY, OPENAI_API_KEY, SESSION_SECRET, PORT, LOG_LEVEL
---
Testing Quirks
- Per-file coverage floor: 90% lines/functions/statements, 80% branches (jest.config.js)
- Excluded from coverage: src/**/*.types.ts, *.d.ts, demo.ts
- Projects: unit (tests/unit/**, src/**/*.test.ts) + integration (tests/integration/**)
- E2E: Playwright drives real browser against live server (5 journeys: uploadâscoreâhistory, persona mgmt, config edit, email settings, clear-data)
- MSW handlers: tests/mocks/handlers.ts â currently empty (LLM mocked via NullProvider/fakeLlm in tests/helpers/test-deps.ts)
- Test utilities: tests/helpers/test-deps.ts â silentLogger, fakeLlm, tierLlm
---
Security Posture (Built-In, Non-Negotiable)
- Zod validation on every upload, config edit, persona create â allow-list over block-list
- CSRF: synchronizer token; global verifyCsrf middleware on every mutating route; AJAX sends X-CSRF-Token header
- Headers: Helmet + strict CSP (no inline scripts â all page JS external)
- Sessions: HttpOnly, SameSite=Strict, Secure in prod
- Secrets in logs: pino redacts password, token, secret, key, auth before stdout
- Uploads: Multer in-memory, 5 MB cap, JSON-only filter, re-validated by Zod before persist
- Supply chain: lockfile committed; package `overrides` for transitive CVE mitigation (`tar`, `cacache`, `esbuild`); CI runs npm audit --audit-level=high + Gitleaks + dependency-review + SBOM (CycloneDX, 90-day retention). See `docs/ci/WORKFLOWS.md`.
---
Key Directories & Ownership
src/
  batch/           # reusable batch pipeline (CLI + demo)
  cli/             # CLI entry + report formatter
  config/          # Zod schema + ConfigService
  demo/            # self-demo args, fallback dataset, AI/fallback resolution, report
  domain/          # types inferred from Zod schemas
  lib/             # errors (DomainError hierarchy), logger (pino+redaction), security (csrf, path-guard)
  llm/             # LLMClient interface + 3 providers + factory + DynamicLlmClient
  modules/         # 6 scoring modules + explanation + outreach-email
  repositories/    # file-handler, persona, session-store
  schemas/         # Zod schemas (single source of truth)
  web/             # Express server, middleware, controllers, routes, EJS views
tests/
  unit/            # pure functions, controllers (mocked deps)
  integration/     # repositories, batch, web (supertest, real Express/CSRF/sessions, temp dirs)
  e2e/             # Playwright top-5 journeys
docs/
  ARCHITECTURE.md  # design thinking, decisions, process, traceability
  DEPLOYMENT.md    # production deploy/run
  architecture/    # ADRs (adr-001..006)
---
Gotchas & Operational Notes
Issue	Detail
SESSION_SECRET	Required in prod; without it, web server generates random secret on startup (sessions reset on restart) â see src/web/server.ts:87-91
Per-file coverage	A 95% project average can hide a 40%-covered module. Jest coverageThreshold enforces floor on every source file.
Entry points excluded	src/cli/index.ts, src/web/server.ts, demo.ts have /* istanbul ignore next */ guards â not counted in coverage
No any, no console	ESLint rules enforce this globally (eslint.config.* or flat config)
AI fallback	NullProvider returns available: false; consumers must check llm.available before calling â never assume AI exists
Path traversal	All user-derived paths go through resolveWithin (src/lib/security/path-guard.ts) â test it in tests/unit/path-guard.test.ts
Config is live	Web Config Editor writes to ConfigService â immediately affects scoring â no restart needed
Demo fallback	data/demo-fallback.json â curated dataset used when --no-ai or AI unavailable
---
## Repo-Specific Conventions
- **No `any`** â TypeScript strict + ESLint forbids it
- **No `console.log`** â use `logger` (pino with redaction)
- **Error codes** â central registry in `src/lib/errors/codes.ts`; every `DomainError` carries one
- **Correlation IDs** â `correlation-id.middleware.ts` adds `req.correlationId`; included in all log lines
- **Zod-first types** â domain types (`src/domain/*.types.ts`) are `z.infer<typeof schema>`; never hand-written
- **Immutable config edits** â Config Editor POSTs to `/config` â validated by `appConfigSchema` â `ConfigService.set()` replaces entire config atomically
- **No `any`** â€” TypeScript strict + ESLint forbids it
- **No `console.log`** â€” use `logger` (pino with redaction)
- **Error codes** â€” central registry in `src/lib/errors/codes.ts`; every `DomainError` carries one
- **Correlation IDs** â€” `correlation-id.middleware.ts` adds `req.correlationId`; included in all log lines
- **Zod-first types** â€” domain types (`src/domain/*.types.ts`) are `z.infer<typeof schema>`; never hand-written
- **Immutable config edits** â€” Config Editor POSTs to `/config` â stř validated by `appConfigSchema` â†’ `ConfigService.set()` replaces entire config atomically
---
References (Authoritative Sources)
- CLAUDE.md â€” governing AI agent behavior (Senior DevSecOps Consultant persona, 4 standards docs, phased pipeline with approval gates)
- docs/ARCHITECTURE.md â€” design rationale, trade-offs, process, testing strategy
- docs/DEPLOYMENT.md â€” production deployment steps
- PROJECT_PLAN.md â€” module catalogue, roadmap, traceability matrix
- docs/REQUIREMENTS.md — full software requirements specification (SRS)
- .github/workflows/ci.yml, security.yml, e2e.yml â€” executable CI truth
---
What NOT to Do
- â Don't assume AI is available â always check llm.available and fallback
- â Don't write types by hand â infer from Zod schemas
- â Don't use console.* â use logger (redacts PII)
- â Don't merge to main/develop without green CI (all 3 workflows)