# ADR-004: Per-session file silos + a path-guard (multi-user, no database)

**Status:** Accepted (2026-06-21)

**Context:** The spec forbids a database; all state is files. The web app is multi-user. That
combination creates the core risk: one session reading another's data, or a crafted identifier
(cookie, upload name, record id) escaping the data directory via `../` traversal (GUARDRAILS 6.3 /
SEC-05/06).

**Decision:**

- **Session silos.** Each browser session gets `data/sessions/{sessionId}/{input,output}`,
  resolved by `SessionStoreRepository`. History, download, and clear-data only ever operate inside
  the caller's own silo — enforced by deriving the directory from `req.sessionID`, never from
  user-supplied input.
- **Path-guard.** A `resolveWithin(root, name)` helper resolves any user-derived path and throws if
  it lands outside the intended root. Every filename (upload, record id, session id, persona id)
  passes through it.

**Consequences:** Strong isolation without a database (verified by an E2E test where a second
session sees an empty history and cannot reach the first's records). The trade-off: state is tied to
the filesystem and the in-memory queue, so the web tier scales as a single process unless silos and
the queue are externalised later. This is the Principle of Least Privilege applied to storage.
