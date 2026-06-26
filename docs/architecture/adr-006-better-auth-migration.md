# ADR-006: Migration to Better Auth backed by SQLite (Drizzle ORM)

**Status:** Accepted (2026-06-25)

**Context:** The application originally proposed custom authentication (bcryptjs + express-session + manual SQL strings) to avoid external auth dependencies. However, custom auth lacks modern production capabilities such as dynamic OAuth providers, robust token verification workflows, built-in rate limiting, password reset flows, and automated session invalidation.

**Decision:**
- **Better Auth Framework:** Replaced legacy `BcryptAuthService` with Better Auth (https://better-auth.com), a modern TypeScript-first authentication framework.
- **Database & Storage Silos:** Better Auth is backed by a local SQLite database (`data/icp.db`) using Drizzle ORM. User scoring job files remain partitioned on disk (`data/sessions/{userId}/`) to ensure persistence and filesystem inspection.
- **Co-existence with CSRF:** Express-session (`icp.sid`) is retained strictly for synchronizer-token CSRF verification, separating identity sessions (`better-auth.sid`) from CSRF security state.

**Consequences:** Enterprise-grade security architecture with full TypeScript inference. Tests verify complete session isolation across concurrent agents without cookie collisions.
