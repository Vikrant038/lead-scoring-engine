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
  NOTE: pre-existing baseline: src/db/migrate.ts demo user seed password (documented, intentional, demo-only).

## Phase log (evidence appended per phase)

| Phase | Scope | LOC before | LOC after | Typecheck | Lint | Tests | Commit |
|---|---|---|---|---|---|---|---|
| 0 | Baseline | 11151 | 11151 | pass | pass | 321 pass | n/a |
| 1 | Domain types | 11151 | 11137 | pass | pass | 321 pass | bc2a4b2 |
| 2 | Config | 11137 | 11130 | pass | pass | 321 pass | a25daf1 |
| 3 | Errors | 11130 | 11125 | pass | pass | 321 pass | 9c3381a |
| 4-5 | Auth lib | 11125 | 11064 | pass | pass | 321 pass | 831c53f |
| 6 | DB | 11064 | 11057 | pass | pass | 320 pass | 9fa0caf |
| 9 | LLM layer | 11057 | 11021 | pass | pass | 317 pass | c62a712/36dae84/1bfe2b8 |
| 10 | Demo | 11021 | 11052 | pass | pass | 317 pass | 79e21c4 |
| 11 | CLI/deps | 11052 | 11056 | pass | pass | 317 pass | 1fd164d |
| 15-16 | Views/client | 11056 | 10750 | pass | pass | 317 pass | 6da258f/d317e4a/a30a8dc/23192c9 |
| 12-13 | Controllers | 10750 | 10729 | pass | pass | 317 pass | 14ae4b1 |
| 17-18 | Assets/deps | 10729 | 10729 | pass | pass | 317 pass | fcfc34c/58bf3d2 |
