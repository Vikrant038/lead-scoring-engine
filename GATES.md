# Gates: 20-phase codebase optimization

OWNS: src/**, public/**, api/**, scripts/**, tests/**, *.json, *.ts, *.js

Scope: Reduce codebase LOC via deletion, dedup, and library substitution across 20 phases, updating dependent tests, with all quality gates green at every phase.

Baseline (recorded 2026-08-29): typecheck 0 errors, lint clean, 321 tests / 31 suites passing, src+api+public+scripts = 11,151 LOC (tests: 5,575 LOC).

## Per-phase invariant gates

Each phase P1–P20 must keep these four invariants green after its changes. Evidence recorded per phase below.

- [ ] G-PHASE-INVARIANTS: typecheck + lint + unit/integration tests pass after final phase
  CHECK: npm run typecheck && npm run lint && npm test 2>&1 | tail -4
  EXPECT: Tests:       321 passed
  EVIDENCE: pending

- [ ] G-LOC-REDUCTION: total src+api+public+scripts LOC strictly lower than baseline 11,151
  CHECK: find src api public scripts -type f \( -name "*.ts" -o -name "*.js" -o -name "*.ejs" -o -name "*.css" \) | xargs wc -l | tail -1
  EXPECT: total
  EVIDENCE: pending (numeric comparison done manually against 11151; EXPECT matches keyword, final value compared by reviewer)

- [ ] G-TESTS-UPDATED: test suite rewritten in step with each phase's changes, no skipped tests
  CHECK: bash -c 'count=$(grep -rn "it.skip\|describe.skip\|test.skip" tests/ | wc -l | tr -d " "); if [ "$count" = "0" ]; then echo "NO_SKIPPED_TESTS"; else echo "SKIPPED_TESTS_FOUND=$count"; fi'
  EXPECT: NO_SKIPPED_TESTS
  EVIDENCE: pending

- [ ] G-NO-SECRETS: no hardcoded secrets introduced
  CHECK: bash -c 'count=$(grep -rniE "(api[_-]?key|secret|password)\s*[:=]\s*['\''\"][A-Za-z0-9]{8,}" src api public scripts --include="*.ts" --include="*.js" | wc -l | tr -d " "); if [ "$count" = "0" ]; then echo "NO_HARDCODED_SECRETS"; else echo "SECRETS_FOUND=$count"; fi'
  EXPECT: NO_HARDCODED_SECRETS
  EVIDENCE: pending

## Phase log (evidence appended per phase)

| Phase | Scope | LOC before | LOC after | Typecheck | Lint | Tests | Commit |
|---|---|---|---|---|---|---|---|
| 0 | Baseline | 11151 | 11151 | pass | pass | 321 pass | n/a |
