# AGENTS.md — Lead Scoring Engine (ICP Profiler)
> High-signal guidance for agents working in this repo. Every line answers: "Would an agent likely miss this without help?"

---

## Project Identity
- **Name:** `lead-scoring-engine` — multi-user ICP Profiler (batch CLI, web app, self-demo)
- **Stack:** TypeScript (strict) · Express + EJS + Multer 2.x · Better Auth + Drizzle ORM (SQLite) · Zod (single source of truth) · pino (PII redaction) · Tailwind · Gemini/OpenAI with rule-based fallback · Jest (unit+integration, **per-file coverage gate**) · Playwright (E2E) · ESLint/Prettier/Husky/Gitleaks
- **Database & Storage:** SQLite (`data/icp.db`) via Better Auth for user identity and sessions; job files are JSON/CSV on disk partitioned per user (`data/sessions/{userId}/`)
- **Risk tier:** Commercial/Production — all standards are mandatory

---

## Exact Developer Commands

### Setup
```bash
npm install
cp .env.example .env          # AI keys optional; SESSION_SECRET required for prod web
```

### Build & Run
```bash
npm run build                 # tsc -> dist/
npm start                     # batch CLI: scores every JSON file in ./input
npm run dev:server            # web app at http://localhost:3000
npm run demo                  # self-demo (generates leads + scores); --no-ai, --persona, --count
```

### Quality Gates (run in this order locally)
```bash
npm run typecheck             # tsc --noEmit (strict)
npm run lint                  # ESLint — enforces global prohibitions (no any, no console, etc.)
npm test -- --coverage        # Jest unit + integration; **per-file coverage gate**
npm run test:e2e              # Playwright top-5 journeys (boots live server)
```

### CSS (Tailwind)
```bash
npm run build:css             # builds public/css/app.css
```

**CI Order** (enforced in `.github/workflows/ci.yml`): `typecheck` → `lint` → `test --coverage`

---

## Entry Points (Three Ways In)

| Mode | File | Purpose |
| --- | --- | --- |
| **CLI** | `src/cli/index.ts` | Batch-score `./input`; writes results, summary, CSV |
| **Web** | `src/web/server.ts` | Express app — drag-and-drop, history, personas, config, email settings |
| **Demo** | `demo.ts` | Self-contained showcase; --no-ai, --persona, --count, --output |

---

## Architecture (Must Know)

### Scoring Pipeline (Uni-directional)
```
Data Quality → Education → Experience → Thinking Quality → Scorer → Profiler
   (gate)        (0.20)       (0.35)           (0.40)          (+recency)  (assemble)
```
- **Data Quality is a gate:** profiles below threshold are rejected, not scored.
- Weights live in config (`src/config/config.schema.ts`), editable via web Config Editor.
- **AI is optional:** `NullProvider` activates when no key; all consumers check `llm.available` and fall back.

### Layered Web Flow
```
Route → Controller → Service → Repository → filesystem
```
- **Controllers:** skinny (parse, call service, map to HTTP).
- **Services:** business logic + cross-cutting concerns.
- **Repositories:** only touch storage.
- **Errors:** typed `DomainError` hierarchy → single global handler → generic envelope (correlation ID logged, never leaked).

### Multi-User Isolation (Better Auth + Storage Silos)
1. **User identity:** Managed by Better Auth (`/api/auth/*`) backed by SQLite (`data/icp.db`). Express-session retained strictly for CSRF tokens (`icp.sid`).
2. **Session silos:** `data/sessions/{userId}/{input,output}` — routes only resolve inside caller's user silo.
3. **Path guard:** `resolveWithin` in `src/lib/security/path-guard.ts` — rejects any path escaping intended root.

### AI Abstraction (Strategy Pattern)
```typescript
interface LLMClient {
  readonly available: boolean;
  classifyUniversity(name: string, searchContext?: string): Promise<LlmResult<Tier>>;
  classifyCompany(name: string, searchContext?: string): Promise<LlmResult<Tier>>;
  generateExplanation(input: ExplanationInput): Promise<LlmResult<string>>;
  generateEmail(input: EmailInput): Promise<LlmResult<OutreachEmail>>;
  generateProfiles(input: GenerateProfilesInput): Promise<LlmResult<Profile[]>>;
}
```
Providers: `GroqProvider` (with automatic failover from `openai/gpt-oss-20b` to `openai/gpt-oss-120b`), `GeminiProvider`, `OpenAIProvider`, `OllamaProvider`, `NullProvider`. Factory picks from `AI_PROVIDER` + key.

### Serverless Architecture (Vercel)
- Entry point: `api/index.ts` (lazy Express handler bootstrap).
- Configuration: `vercel.json` maps all routes to `/api/index.ts`.
- Database: Automatically paths to `/tmp/icp.db` on Vercel runtime.
- Dynamic origins: Better Auth dynamically trusts `process.env.VERCEL_URL`.

---

## Configuration (Zod = Single Source of Truth)
- **Schema:** `src/config/config.schema.ts` → `AppConfig` type.
- **Runtime service:** `src/config/config.service.ts` (`ConfigService` — mutable, validated on edit).
- **Web Config Editor** (`/config`) edits live config as validated JSON — applies to scoring immediately.
- **Env vars:** `.env.example` — `AI_PROVIDER`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `SESSION_SECRET`, `PORT`, `LOG_LEVEL`.

---

## Testing Quirks
- **Per-file coverage floor:** 90% lines/functions/statements, 80% branches (`jest.config.js`).
- **Excluded from coverage:** `src/**/*.types.ts`, `*.d.ts`, `demo.ts`.
- **Projects:** unit (`tests/unit/**`, `src/**/*.test.ts`) + integration (`tests/integration/**`).
- **E2E:** Playwright drives real browser against live server (5 journeys: upload → score → history, persona mgmt, config edit, email settings, clear-data).
- **Auth Mocking:** `tests/mocks/better-auth.mock.ts` simulates authentication state for Jest tests. It intercepts requests and returns specific users (e.g., Alice or Bob) if the cookie contains their names.
- **LLM Mocking:** `tests/mocks/handlers.ts` (MSW handlers) is currently empty. LLM is mocked via `NullProvider` or `fakeLlm`/`tierLlm` in `tests/helpers/test-deps.ts`.

---

## Security Posture (Built-In, Non-Negotiable)
- **Zod validation** on every upload, config edit, persona create — allow-list over block-list.
- **CSRF:** synchronizer token; global `verifyCsrf` middleware on every mutating route; AJAX sends `X-CSRF-Token` header.
- **Headers:** Helmet + strict CSP (no inline scripts — all page JS external).
- **Sessions:** HttpOnly, SameSite=Strict, Secure in prod.
- **Secrets in logs:** pino redacts password, token, secret, key, auth before stdout.
- **Uploads:** Multer in-memory, 5 MB cap, JSON-only filter, re-validated by Zod before persist.
- **Supply chain:** lockfile committed; package `overrides` for transitive CVE mitigation (`tar`, `cacache`, `esbuild`); CI runs `npm audit --audit-level=high` + Gitleaks + dependency-review + SBOM (CycloneDX, 90-day retention). See `docs/ci/WORKFLOWS.md`.

---

## Key Directories & Ownership
```
src/
  batch/           # reusable batch pipeline (CLI + demo)
  cli/             # CLI entry + report formatter
  config/          # Zod schema + ConfigService
  db/              # Drizzle schema, connection, and programmatic migration/seeding
  demo/            # self-demo args, fallback dataset, AI/fallback resolution, report
  domain/          # types inferred from Zod schemas
  lib/             # errors (DomainError hierarchy), logger (pino+redaction), security (csrf, path-guard)
  llm/             # LLMClient interface + 3 providers + factory + Dynamic LlmClient
  modules/         # 6 scoring modules + explanation + outreach-email
  repositories/    # file-handler, persona, session-store
  schemas/         # Zod schemas (single source of truth)
  web/             # Express server, middleware, controllers, routes, EJS views
tests/
  unit/            # pure functions, controllers (mocked deps)
  integration/     # repositories, batch, web (supertest, real Express/CSRF/sessions, temp dirs)
  e2e/             # Playwright top-5 journeys
docs/
  ARCHITECTURE.md  # design thinking, decisions, process, testing strategy
  DEPLOYMENT.md    # production deploy/run
  architecture/    # ADRs (adr-001..006)
```

---

## Gotchas & Operational Notes

| Issue | Detail |
| --- | --- |
| **SESSION_SECRET** | Required in prod; without it, web server generates random secret on startup (sessions reset on restart) — see `src/web/server.ts`. |
| **Database Tables** | Programmatically created on startup in `src/db/migrate.ts`. No `drizzle-kit push` or manual migration runner is needed. |
| **Per-file coverage** | A 95% project average can hide a 40%-covered module. Jest `coverageThreshold` enforces floor on every source file. |
| **Entry points excluded** | `src/cli/index.ts`, `src/web/server.ts`, `demo.ts` have `/* istanbul ignore next */` guards — not counted in coverage. |
| **No any, no console** | ESLint rules enforce this globally (`eslint.config.js` or `.eslintrc.cjs`). |
| **AI fallback** | `NullProvider` returns `available: false`; consumers must check `llm.available` before calling — never assume AI exists. |
| **Path traversal** | All user-derived paths go through `resolveWithin` (`src/lib/security/path-guard.ts`) — test it in `tests/unit/path-guard.test.ts`. |
| **Config is live** | Web Config Editor writes to `ConfigService` → immediately affects scoring — no restart needed. |
| **Demo fallback** | `data/demo-fallback.json` — curated dataset used when `--no-ai` or AI unavailable. |

---

## Repo-Specific Conventions
- **No `any`** — TypeScript strict + ESLint forbids it.
- **No `console.log`** — use `logger` (pino with redaction).
- **Error codes** — central registry in `src/lib/errors/codes.ts`; every `DomainError` carries one.
- **Correlation IDs** — `correlation-id.middleware.ts` adds `req.correlationId`; included in all log lines.
- **Zod-first types** — domain types (`src/domain/*.types.ts`) are `z.infer<typeof schema>`; never hand-written.
- **Immutable config edits** — Config Editor POSTs to `/config` → validated by `appConfigSchema` → `ConfigService.set()` replaces entire config atomically.

---

## References (Authoritative Sources)
- `CLAUDE.md` — governing AI agent behavior (Senior DevSecOps Consultant persona, 4 standards docs, phased pipeline with approval gates)
- `docs/ARCHITECTURE.md` — design rationale, trade-offs, process, testing strategy
- `docs/DEPLOYMENT.md` — production deployment steps
- `PROJECT_PLAN.md` — module catalogue, roadmap, traceability matrix
- `docs/REQUIREMENTS.md` — full software requirements specification (SRS)
- `.github/workflows/ci.yml`, `e2e.yml`, `security.yml` — executable CI truth

---

## What NOT to Do
- ❌ Don't assume AI is available — always check `llm.available` and fallback.
- ❌ Don't write types by hand — infer from Zod schemas.
- ❌ Don't use `console.*` — use `logger` (redacts PII).
- ❌ Don't merge to `main`/`develop` without green CI (all 3 workflows).