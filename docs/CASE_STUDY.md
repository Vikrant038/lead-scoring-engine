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

## First-Principles Engineering & Problem Solving

### 1. Deconstructing the Qualification Problem
When approaching B2B lead scoring, existing solutions typically fall into two flawed extremes:
- **Black-box AI wrappers:** Pass an entire lead to an LLM prompt. Costly (\$0.05+/call), slow, non-deterministic, and impossible for a VP of Sales to calibrate.
- **Brittle Regex systems:** Fragile keyword matchers that shatter when encountering slight title variants or international universities.

**First-Principles Synthesis:**
1. **Mathematical Determinism for Scoring:** Weighted arithmetic ($w_1 \cdot S_1 + w_2 \cdot S_2 + \dots$) ensures 100% auditable, reproducible sub-scores.
2. **Semantic Intelligence for Classification:** LLMs are reserved strictly for high-entropy tasks — classifying unknown companies into tiers and crafting natural, high-converting outreach emails.
3. **Data Quality as an Upfront Gate:** Corrupted/incomplete records are rejected at step 0 ($0$ tokens spent), preventing bad data from generating confident hallucinations.

---

## Technical Decisions & Practical Problem Solving

### Dual-Model Auto-Failover + Zero-Cost Fallback
We integrated Groq with auto-failover: requests begin with the ultra-fast `openai/gpt-oss-20b` (1,000 T/s). If rate-limited (HTTP 429) or degraded, the client immediately falls back to `openai/gpt-oss-120b` (500 T/s), with a final safety net to rule-based classification if all APIs are unreachable. Zero crashes, zero vendor lock-in.

### TypeScript Strict Mode + Zod Single Source of Truth
Every domain type is inferred directly from Zod schemas (`z.infer<typeof schema>`). ESLint enforces `no-explicit-any` globally. Types and validation schemas can never drift out of sync.

### Multi-Tenant Storage Silos & Path Guard Security
User sessions are isolated on disk (`data/sessions/{userId}/`). Every file interaction passes through `resolveWithin` path containment guards to mathematically eliminate directory traversal attacks.

### Better Auth & Serverless SQLite
We deployed Better Auth backed by Drizzle ORM and SQLite. On local machines, SQLite runs in high-performance WAL mode; in serverless cloud runtimes (Vercel), it dynamically switches to memory-mode at `/tmp/icp.db` with dynamic trusted origin resolution.

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
| Auth | Better Auth + Drizzle ORM (SQLite) |
| Testing | Jest (unit + integration, per-file 80% branch / 90% statement gate) + Playwright (E2E) |
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

- [GitHub Repository](https://github.com/Vikrant038/lead-scoring-engine)
- [Live Demo](https://YOUR_APP.onrender.com) — login with `demo@example.com / password`
- [Architecture Decision Records](./architecture/)
- [Architecture Overview](./ARCHITECTURE.md)
