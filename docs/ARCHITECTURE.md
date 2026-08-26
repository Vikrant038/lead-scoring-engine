# Architecture & Design Thinking

This document explains **why** the Lead Scoring Engine is built the way it is. The code shows the
*what*; this is the reasoning, the trade-offs, and the process behind it. If you only read one
document to understand the project, read this one.

---

## 1. The problem, stated honestly

A lead list is not a pipeline. It is a pile of unanswered questions: who is worth a call today, who
just *looks* impressive, and — the question that actually erodes trust in any scoring tool — *why
did this person get that number?*

Most "lead scoring" is a black box: a model spits out a 7, nobody can explain it, and the sales team
quietly stops believing it. The moment a scoring tool can't justify itself, it becomes noise. So the
first design constraint wasn't technical. It was: **every score must be explainable, and the system
must keep working even when the fancy parts (the AI) are unavailable.**

### 🔬 First-Principles Decomposition
We broke the domain down into core fundamental truths:
1. **A lead is not an arbitrary score; it is a vector of verifiable signals:** Education reputation, career progression velocity, and demonstrated cognitive/leadership capability.
2. **Deterministic arithmetic outlives AI stochasticity:** Math is deterministic ($2+2=4$ always). If you delegate simple scoring math to an LLM, you introduce non-deterministic hallucinations, latency, and API costs. Keep arithmetic in code and semantics in AI.
3. **Data Quality is a gatekeeper, not a grade:** Grading incomplete data generates confident nonsense. Corrupted data must be stopped at the perimeter with zero processing overhead.
4. **Resilience requires multi-tier failovers:** Never rely on a single vendor or API model. Design self-healing pipelines that cascade across models and offline fallbacks seamlessly.

---

## 2. Design principles (the non-negotiables)

1. **Explainability over cleverness.** The score is a transparent, weighted blend of visible
   sub-scores — not an opaque model output. You can always trace a number back to its parts.
2. **AI is an enhancement, never a dependency.** The system is fully functional with no API key.
   AI adds narrative, email drafts, and better tier classification — but its absence degrades the
   product gracefully, it never breaks it.
3. **Validate at the edges, trust nothing inside.** Every external input (uploads, config edits,
   LLM responses) is validated by a Zod schema before it crosses a boundary.
4. **Isolation by default.** In multi-user mode, each session is a sealed silo on disk. There is no
   shared mutable state a crafted request can reach.
5. **The build itself is governed.** The AI that wrote this code was bound by four standards
   documents and a phased process with explicit approval gates (see §8).
6. **Per-file coverage accountability.** Global test averages hide bad modules. Strict 90% statement
   and 80% branch coverage minimums apply to every single file.

---

## 3. The scoring pipeline

The core of the system is a uni-directional pipeline. Each stage produces a signal; the Scorer
blends them; the Profiler assembles the result.

```
Data Quality ──▶ Education ──▶ Experience ──▶ Thinking Quality ──▶ Scorer ──▶ Profiler
   (gate)         (0.20)         (0.35)            (0.40)         (+recency)   (assemble)
```

- **Data Quality** is a gate, not a score. A profile missing too many core fields (name, education,
  jobs) is *rejected* rather than scored on garbage. Scoring bad data is worse than scoring nothing —
  it produces confident, wrong numbers.
- **Education / Experience / Thinking Quality** each emit a 0–100 sub-score. Education and Experience
  classify universities and companies into tiers (tier-1/2/3) — via the LLM when available, else by
  exact match against configurable lists. Thinking Quality is pure rule-based: visionary/leadership
  keywords in titles and skills.
- **Scorer** applies the configured weights (thinking 0.40 — the hardest signal to fake — dominates,
  then experience 0.35, then education 0.20), adds a small recency bonus for recently-active leads,
  and maps the total to a bucket.
- **Profiler** orchestrates the pipeline and, conditionally, the AI post-processors (explanation,
  outreach email) and persona matching.

**Why weighted-and-visible instead of a model?** Because a hiring-style score that a salesperson
can argue with is more useful than one they have to take on faith. The weights live in config, so
the *opinion* the score encodes is editable without touching code.

---

## 4. The AI abstraction: designing for the dependency you don't control

The LLM is the one component whose behaviour I do not own. It can be slow, absent, rate-limited, or
simply wrong. So it sits behind a single interface, and every call returns a **result envelope**
instead of throwing:

```ts
interface LLMClient {
  readonly available: boolean;
  classifyUniversity(name): Promise<LlmResult<Tier>>;
  generateEmail(input): Promise<LlmResult<OutreachEmail>>;
  // ...
}
interface LlmResult<T> { success: boolean; data?: T; error?: string; }
```

Three providers implement it: `GeminiProvider`, `OpenAIProvider`, and `NullProvider`. The factory
picks one from `AI_PROVIDER` + the matching key; absent a key, it returns the `NullProvider`, whose
`available` is `false`. Every consumer checks `available` and falls back to rule-based logic. An
exception never crosses a module boundary — failure is *data*, handled locally, not an explosion
that propagates.

This is the Strategy pattern doing real work: swapping the AI for a no-op is a one-line factory
decision, and the rest of the system doesn't know or care. It's also what makes the `--no-ai` demo
and the offline test suite possible. (See [ADR-003](./architecture/adr-003-llm-abstraction.md).)

---

## 5. Layered architecture & error propagation

The web app follows a strict, uni-directional flow:

```
Route ──▶ Controller ──▶ Service ──▶ Repository ──▶ filesystem
```

- **Controllers are skinny** — parse the request, call a service, map the result to HTTP. No
  business logic, no file access.
- **Services hold the logic** — even a trivial lookup goes through a service method, so cross-cutting
  concerns (logging, auth, caching) have a home later without re-plumbing.
- **Repositories only touch storage.**

Errors travel as a typed `DomainError` hierarchy (`NotFoundError`, `ValidationError`,
`ForbiddenError`, `CsrfError`, …), each carrying a code from a central registry. A single global
error handler maps codes to HTTP statuses and returns a generic envelope — internal details are
logged with a correlation id, never leaked to the client. (See
[ADR-002](./architecture/adr-002-result-envelope-errors.md).)

---

## 6. Multi-user isolation (Better Auth + Storage Silos)

User authentication and sessions are managed by **Better Auth** backed by a local SQLite database (`data/icp.db`) using Drizzle ORM. While user identity is stored in SQLite, scoring job artifacts are stored on disk. The risk that creates is obvious — how do you stop one user reading another's data, or escaping the data directory entirely?

The answer is two-layered:

1. **User Silos.** Each authenticated user gets `data/sessions/{userId}/{input,output}`. The history, download, and clear-data routes only ever resolve paths inside the caller's own user silo. A second user sees an empty queue and an empty history — provably, in our Supertest integration and E2E suites. Existing `express-session` is retained strictly for CSRF tokens (`icp.sid`), separating user authentication state into Better Auth sessions (`better-auth.sid`).
2. **A path-guard (`resolveWithin`).** Every filename derived from user input (upload names, record ids, user ids, persona ids) passes through a guard that resolves the path and rejects anything landing outside the intended root. A request crafted with `../../etc` cannot escape the sessions directory.

This is the Principle of Least Privilege applied to the filesystem: the only bytes a request can reach are the ones it owns.

---

## 7. Security posture

Security was designed in, using STRIDE to threat-model inputs before writing them and OWASP Top 10
as the coding checklist:

- **Input validation** — Zod schemas on every upload and config edit; allow-listing over
  block-listing.
- **CSRF** — synchronizer-token pattern; a per-session token verified globally on every
  `POST/PUT/PATCH/DELETE`, sent by the page JS via the `X-CSRF-Token` header.
- **Headers** — helmet with a strict same-origin Content-Security-Policy; no inline scripts (all
  page JS is external files), which is why the UI is CSP-clean.
- **Sessions** — `HttpOnly`, `SameSite=Strict`, `Secure` in production.
- **Secrets & logs** — no hardcoded secrets; pino redacts `password`, `token`, `secret`, etc. before
  anything reaches stdout.
- **Uploads** — Multer in-memory, 5 MB cap, JSON-only filter, validated again by Zod before persist.
- **Supply chain** — committed lockfile, `npm audit` + Gitleaks + dependency-review + an SBOM in CI.

---

## 8. The process: governing an AI build

This codebase was written by an AI agent — but not a compliant one. It was bound by four standards
documents that act as its constitution:

- **GUARDRAILS.md** — security & risk (STRIDE, OWASP, edge cases, the DevSecOps pipeline).
- **CODING_STANDARDS.md** — naming, layered architecture, error hierarchy, testing pillars.
- **PIPELINE_OPS.md** — CI/CD, vulnerability triage, deployment, monitoring.
- **DESIGN_BLUEPRINT.md** — the phased "no code without a blueprint" planning pipeline.

The build ran as **14 atomic units**, each on its own `feature/` branch, each verified
(typecheck → lint → per-file coverage → tests) before merging to `main`. The project was scoped at
the **Commercial/Production** risk tier, which means every module bound — nothing was waved through
as "just a prototype." Conflicts between the spec and the standards were resolved in favour of the
standards, and every deviation (e.g. TypeScript over the spec's plain-JS mandate) was logged as a
decision with its consequence.

The point of all that ceremony isn't bureaucracy. It's that **constraints make AI output
trustworthy.** An unconstrained assistant produces plausible code; a governed one produces code that
passes a gate it cannot negotiate around.

---

## 9. Testing strategy

The test pyramid, applied literally:

- **Unit** — the scoring modules, providers, controllers (called directly with mocked deps), and the
  demo logic. Pure functions and tight branch control.
- **Integration** — repositories, the batch pipeline, and the web app via supertest (real Express,
  real CSRF, real session cookies, temp directories).
- **E2E** — Playwright drives the real browser through the top-5 journeys (upload→score→history,
  persona management, config edit, email settings, clear-data) against a live server.

**Coverage is enforced per file, not in aggregate.** A 95% project average can hide a 40%-covered
module — the average launders the rot. Jest's `coverageThreshold` applies a per-file floor (90%
lines/functions/statements, 80% branches), so *every* file earns its place. Genuinely unreachable
glue (entry points, `require.main` guards) is explicitly `istanbul ignore`d and excluded, rather
than hidden behind a generous mean.

---

## 10. Notable decisions & trade-offs

| Decision | Why | Trade-off accepted |
| --- | --- | --- |
| TypeScript (strict), not plain JS | Type safety + Zod-inferred domain types as a single source of truth | Adds a build step; overrides the spec |
| No database | Spec constraint; simplicity; portability | Session persistence is filesystem-bound; isolation must be enforced in code |
| Result-envelope errors | Failure as data; graceful degradation; no exceptions across boundaries | Slightly more verbose call sites |
| Mocked `global.fetch` in tests, not MSW | MSW v2 is ESM-only and fought CommonJS ts-jest; Nock can't intercept undici | Less realistic network layer in unit tests (covered by integration) |
| Per-file coverage gate | Averages hide untested files | More effort to lift every file over the bar |
| Synchronous fs | At this scale (hundreds of leads), simplicity beats async complexity | Not suited to very high throughput |

---

## 11. Requirement traceability (summary)

The full FR-by-FR matrix lives in [`PROJECT_PLAN.md`](../PROJECT_PLAN.md). At a glance:

| Feature area | Requirements | Implementation | Tests |
| --- | --- | --- | --- |
| Batch scoring | F-01..F-08 | `src/batch`, `src/modules`, `src/cli` | `run-batch`, `cli`, scoring unit tests |
| Scoring pipeline | F-02..F-06 | the six `src/modules/*` services | `scoring.service`, `profiler.service` |
| Persona fit | F-12 | `persona-matcher.service`, `persona.repository` | `persona-matcher`, `persona.repository` |
| AI features | F-13, F-14 | `explanation`, `outreach-email`, `llm/*` | `ai-features`, `llm` |
| Web app | F-10, F-11, F-15, F-17 | `src/web/*` | `web`, `web-controllers`, e2e |
| Multi-user isolation | F-16 | `session-store.repository`, `path-guard` | `session-store`, e2e isolation |
| Self-demo | F-15 | `demo.ts`, `src/demo/*` | `demo` unit tests |

---

## 12. Where to go next

- Run it: [`README.md`](../README.md).
- Deploy it: [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md).
- Watch/record the walkthrough: [`docs/VIDEO_SCRIPT.md`](./VIDEO_SCRIPT.md).
- The decisions in detail: [`docs/architecture/`](./architecture/).
