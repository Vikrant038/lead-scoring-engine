# ADR-003: LLM behind one interface, with a NullProvider

**Status:** Accepted (2026-06-21)

**Context:** The LLM is the only dependency the system does not control — it can be absent
(no API key), slow, rate-limited, or wrong. The product must be fully usable without it (a core
requirement: AI features are optional and degrade to rule-based logic).

**Decision:** Define a single `LLMClient` interface (tier classification, explanation, email,
profile generation), implemented by `GeminiProvider`, `OpenAIProvider`, and a `NullProvider`. A
factory selects the provider from `AI_PROVIDER` + the matching key; with no key it returns the
`NullProvider`, whose `available` flag is `false`. Every consumer checks `available` and uses
rule-based logic otherwise. All methods return result envelopes ([ADR-002](./adr-002-result-envelope-errors.md)),
so a failed call degrades locally instead of throwing.

**Consequences:** The AI is swappable with a one-line factory decision; the `--no-ai` demo and the
offline test suite work for free; adding a provider (e.g. Anthropic) is a new class, not a rewrite.
This is the Strategy pattern carrying the system's resilience guarantee.
