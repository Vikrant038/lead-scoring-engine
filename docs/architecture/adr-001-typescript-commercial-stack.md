# ADR-001: TypeScript + Commercial-tier stack

**Status:** Accepted (2026-06-21)

**Context:** `docs/REQUIREMENTS.md` §2.5 mandated plain JS; the governing CLAUDE.md (Commercial tier,
"CLAUDE.md fully wins") mandates strict typing, Zod, CSRF, helmet, structured logging, and tests.

**Decision:** Build in strict TypeScript (compiled to CommonJS) with Express/EJS/Multer 2.x,
Zod, pino, Jest/Playwright/MSW, ESLint+Prettier+Husky+gitleaks, and SBOM/dependency-review CI.

**Consequences:** Adds a `tsc` build step (negates spec's "no transpilation"); full manifesto
compliance; richer tooling. See PROJECT_PLAN.md.
