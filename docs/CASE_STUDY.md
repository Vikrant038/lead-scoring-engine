# Case Study — ICP Profiler (Lead Scoring Engine)

## The Problem

Sales teams at B2B companies routinely receive lead lists with hundreds of names. The question they face every Monday morning is the same: *"Who is actually worth calling today?"*

Answering it manually takes 3–5 minutes per lead — scanning LinkedIn, checking company size, guessing at fit. On a list of 200, that's 10–17 hours of a sales rep's week, every week, forever. The result is inconsistent: whoever read the list on a good day scores differently from whoever read it on a bad one.

**The core problem is that lead qualification is a repetitive judgment task that can be made explicit.**

---

## What I Built

A modular, production-grade lead scoring engine that:

1. **Ingests lead profiles as JSON** (or via drag-and-drop in the web UI)
2. **Scores them through a 6-stage pipeline** with visible sub-scores
3. **Assigns an ICP (Ideal Customer Profile) score** out of 100, mapped to a priority bucket (HIGH / MEDIUM / LOW / NOT FIT)
4. **Optionally explains the score in plain English** (when an AI key is present)
5. **Drafts a personalised outreach email** for high-fit leads

### Scoring Pipeline

```
Data Quality → Education → Experience → Thinking Quality → Scorer → Profiler
   (gate)       (0.20)      (0.35)          (0.40)          (+recency) (assemble)
```

Each stage is a separate TypeScript module. Weights are configurable via a web UI Config Editor — no restart needed. The pipeline is deterministic and fully testable without AI.

### Three Ways to Use It

| Mode | Command | Use case |
|------|---------|----------|
| CLI Batch | `npm start` | Score a folder of leads overnight |
| Web App | `npm run dev:server` | Drag-and-drop UI for a sales team |
| Self-Demo | `npm run demo -- --html` | Showcase for a client presentation |

---

## Technical Decisions

### Why rule-based scoring with optional AI?
The scoring pipeline works without any API key. AI (Gemini/OpenAI) only adds explanation text and email drafts. This means zero runtime cost for the core scoring, and the system never goes down because a model API is unavailable.

### Why TypeScript strict mode + Zod?
Every domain type is inferred from a Zod schema — there are no hand-written interfaces that can drift out of sync. ESLint enforces `no-any` globally. TypeScript catches bugs at compile time so they don't reach production.

### Why no database?
For a single-server portfolio app, SQLite on a persistent disk is simpler, cheaper, and more transparent than a managed database. Zero infrastructure cost. The file layout (`data/sessions/{userId}/`) is easy to inspect and debug.

### Why custom auth instead of a library?
Because being able to explain every line — bcrypt, session management, CSRF tokens, cookie security — is a stronger portfolio signal than "I installed a package." The full implementation is ~150 lines.

---

## Results

**During the internship that inspired this project:**

- Reduced manual lead qualification time from ~3–5 minutes per lead to **under 5 seconds**
- Standardised scoring criteria across the team, eliminating per-person bias
- Identified 3× more HIGH-fit leads per batch than the previous manual process
- The outreach email drafts reduced email write time by approximately **70%**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Web framework | Express + EJS + Multer 2.x |
| Validation | Zod (single source of truth for types) |
| Logging | pino (structured, PII redacted) |
| Styling | Tailwind CSS |
| AI (optional) | Google Gemini / OpenAI GPT-4o |
| Database | SQLite (better-sqlite3) with WAL mode |
| Auth | bcryptjs + express-session |
| Testing | Jest (unit + integration, per-file 90% gate) + Playwright (E2E) |
| Security | Helmet, CSRF synchronizer tokens, path guard, rate-aware CSP |
| CI/CD | GitHub Actions (typecheck → lint → test → audit → SBOM) |

---

## What I'd Do With More Time

1. **Real-time scoring** — WebSocket updates as the pipeline processes each stage
2. **Bulk import from CRM** — pull leads directly from HubSpot/Salesforce via API
3. **Score drift alerts** — notify a Slack channel when a lead's status changes
4. **A/B testing on weights** — run two scoring configurations in parallel and measure which produces better conversion

---

## Links

- [GitHub Repository](https://github.com/YOUR_HANDLE/lead-scoring-engine)
- [Live Demo](https://YOUR_APP.onrender.com) — login with `demo@example.com / password`
- [Architecture Decision Records](./architecture/)
- [Architecture Overview](./ARCHITECTURE.md)
