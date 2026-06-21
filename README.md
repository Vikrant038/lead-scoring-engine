# Lead Scoring Engine (ICP Profiler)

A modular, multi-user system that automates qualification of prospect profiles. It ingests lead
data as JSON, computes an **Ideal Customer Profile (ICP) score**, classifies leads into priority
buckets, and (optionally) generates AI narratives, outreach emails, and persona-based fit
assessments. Ships a **batch CLI**, a **multi-user web app**, and a **self-demo mode**.

> **Status:** Phase 2 scaffold. Feature logic is implemented unit-by-unit in Phase 3
> (see [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)).

## Stack

TypeScript (strict) · Express + EJS + Multer 2.x · Zod · pino · Tailwind · Gemini/OpenAI
(graceful rule-based fallback) · Jest + Playwright + MSW · ESLint/Prettier/Husky/gitleaks.

## Quickstart

```bash
npm install
cp .env.example .env        # then fill in (AI keys optional; SESSION_SECRET for prod)
npm run build               # tsc -> dist/
npm start                   # batch CLI over ./input
npm run dev:server          # web app at http://localhost:3000
npm run demo                # self-demo (no manual data needed)
```

## Input format

Each input file is a single profile object or an array of them:

```json
{
  "_recordId": "optional",
  "name": "Jane Doe",
  "education": ["MBA @ Harvard University"],
  "jobs": ["Product Manager @ Google"],
  "skills": ["Leadership"],
  "company_details": { "name": "Google", "category": "Tech" }
}
```

## Configuration & environment

See [`.env.example`](./.env.example) for all variables (`AI_PROVIDER`, `GEMINI_API_KEY`,
`OPENAI_API_KEY`, `SESSION_SECRET`, `PORT`, `LOG_LEVEL`) and `src/config/config.ts` for scoring
weights, tier lists, buckets, and feature flags (also editable in the web Config Editor).

## Scripts

`build` · `start` · `dev` · `server` / `dev:server` · `demo` · `typecheck` · `lint` · `test` ·
`test:e2e` · `format`.

## Documentation

- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) — architecture, module catalogue, roadmap, traceability.
- [`requirement.md`](./requirement.md) — full SRS.
- `docs/architecture/` — ADRs.

_Demo screenshot/GIF and Loom walkthrough: TODO (added after Phase 3)._

## License

MIT
