# ADR-005: Strict per-file coverage gates (80% branch / 90% statement floor)

**Status:** Accepted (2026-06-25)

**Context:** Most software projects track test coverage as an aggregate project average (e.g., 85% overall). In practice, aggregate metrics hide untested rot: a 98% covered math utility can launder a 20% covered authentication controller or payment handler. Furthermore, developers often add file exclusions or lower threshold overrides to bypass difficult branch testing in HTTP controllers, standalone report scripts, and server bootstrap layers.

**Decision:**

- **Per-file coverage floor.** Jest `coverageThreshold` is configured targeting `src/**/*.ts` directly, enforcing a non-negotiable floor on *every individual source file* (80% branches, 90% lines, functions, and statements).
- **Zero source file exclusions.** No application layer is exempt. HTTP controllers are unit tested by injecting mock Express request/response state (`MockResState`). Standalone CLI generators and HTML demo report formatters are structured into pure functions to achieve complete branch coverage.
- **Explicit entry glue exclusion.** Unreachable OS bootstrap boundaries (`app.listen` calls and `require.main === module` direct execution guards) are explicitly demarcated with `/* istanbul ignore next */` rather than lowering thresholds or excluding entire files.

**Consequences:** A CI build gate where no developer or AI agent can merge code with untested branch paths. Every file guarantees its own correctness. The trade-off: higher testing effort when writing controllers and middleware, requiring disciplined dependency injection and mock scaffolding.
