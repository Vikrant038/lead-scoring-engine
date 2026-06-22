# ADR-002: Result envelopes + a typed DomainError hierarchy

**Status:** Accepted (2026-06-21)

**Context:** Two kinds of failure cross module boundaries: *expected* failures the caller should
handle (an LLM call fails, a config edit is invalid, a record is missing) and *internal* failures.
Throwing for everything makes graceful degradation awkward — every optional AI call would need a
try/catch — and risks leaking stack traces or DB errors to HTTP clients (GUARDRAILS 2.6).

**Decision:**

- **LLM and other "may-fail-and-that's-fine" calls return a result envelope** —
  `{ success, data?, error? }` — never throw. Callers branch on `success` and fall back to
  rule-based logic.
- **Domain failures throw a typed `DomainError`** (`NotFoundError`, `ValidationError`,
  `ForbiddenError`, `CsrfError`, `InvalidConfigError`, …), each carrying a code from a central
  registry (`src/lib/errors/codes.ts`).
- **One global Express error handler** maps codes → HTTP status and returns a generic envelope,
  logging the real error with a `correlationId`. Internal details never reach the client.

**Consequences:** Slightly more verbose call sites for AI paths, in exchange for graceful
degradation, no exceptions propagating across boundaries, consistent API error shapes, and no
information disclosure. Underpins the optional-AI design in [ADR-003](./adr-003-llm-abstraction.md).
