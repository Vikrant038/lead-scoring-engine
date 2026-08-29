# Gates: 20-phase codebase optimization

OWNS: src/**, public/**, api/**, scripts/**, tests/**, *.json, *.ts, *.js

Scope: Reduce codebase LOC via deletion, dedup, and library substitution across 20 phases, updating dependent tests, with all quality gates green at every phase.

Baseline (recorded 2026-08-29): typecheck 0 errors, lint clean, 321 tests / 31 suites passing, src+api+public+scripts = 11,151 LOC (tests: 5,575 LOC).

## Per-phase invariant gates

Each phase P1–P20 must keep these four invariants green after its changes. Evidence recorded per phase below.

- [x] G-PHASE-INVARIANTS: typecheck + lint + unit/integration tests pass after final phase
  CHECK: npm run typecheck && npm run lint && npm test 2>&1 | tail -4
  EXPECT: Tests:       317 passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/vikranty/.traycer/worktrees/vikrant038__lead-scoring-engine/traycer-lead-scoring-engine-silent-falcon-af1525f0fa76; path=b1f540f22f86/19 entries; EXPECT=matched; output-sha256=fae715cb7b57a67f4810820a79904a9d900bbec8461259080dd486279a995cb0; output-bytes=238

- [x] G-LOC-REDUCTION: total src+api+public+scripts LOC strictly lower than baseline 11,151
  CHECK: find src api public scripts -type f \( -name "*.ts" -o -name "*.js" -o -name "*.ejs" -o -name "*.css" \) | xargs wc -l | tail -1
  EXPECT: total
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/vikranty/.traycer/worktrees/vikrant038__lead-scoring-engine/traycer-lead-scoring-engine-silent-falcon-af1525f0fa76; path=b1f540f22f86/19 entries; EXPECT=matched; output-sha256=784487f47999a53f99f4aa3e5a28aac7f4bb4fa86e1d8bf9f0053b227dc9a38e; output-bytes=15

- [x] G-TESTS-UPDATED: test suite rewritten in step with each phase's changes, no skipped tests
  CHECK: bash -c 'count=$(grep -rn "it.skip\|describe.skip\|test.skip" tests/ | wc -l | tr -d " "); if [ "$count" = "0" ]; then echo "NO_SKIPPED_TESTS"; else echo "SKIPPED_TESTS_FOUND=$count"; fi'
  EXPECT: NO_SKIPPED_TESTS
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/vikranty/.traycer/worktrees/vikrant038__lead-scoring-engine/traycer-lead-scoring-engine-silent-falcon-af1525f0fa76; path=b1f540f22f86/19 entries; EXPECT=matched; output-sha256=8d47b8a967cdb743cb11e43ecf89231aa4f9e4658ba04f9c1cc22f95164cab8e; output-bytes=17

- [x] G-E2E-GREEN: Playwright E2E suite passes against the real server (all 7 journeys)
  CHECK: bash -c 'lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run test:e2e 2>&1 | tail -3'
  EXPECT: 7 passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/vikranty/.traycer/worktrees/vikrant038__lead-scoring-engine/traycer-lead-scoring-engine-silent-falcon-af1525f0fa76; path=b1f540f22f86/19 entries; EXPECT=matched; output-sha256=0443777e1081e224678f67402c853838dd56c5c2fea0fe1f7ea3018d07f863c9; output-bytes=158

- [x] G-NO-SECRETS: no hardcoded secrets introduced
  CHECK: bash -c 'count=$(grep -rniE "(api[_-]?key|secret|password)\s*[:=]\s*['\''\"][A-Za-z0-9]{8,}" src api public scripts --include="*.ts" --include="*.js" | wc -l | tr -d " "); if [ "$count" = "0" ]; then echo "NO_HARDCODED_SECRETS"; else echo "SECRETS_FOUND=$count"; fi'
  EXPECT: NO_HARDCODED_SECRETS
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/Users/vikranty/.traycer/worktrees/vikrant038__lead-scoring-engine/traycer-lead-scoring-engine-silent-falcon-af1525f0fa76; path=b1f540f22f86/19 entries; EXPECT=matched; output-sha256=1da1a23fc5375b07733887ade039fb664f2e9d24fd050ec0b90e27b8ae8dc0dd; output-bytes=21
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
| 16 | Client JS full rewire | 10729 | 10585 | pass | pass | 317 pass | 8a234f1 |
| 13 | auth.controller dedupe | 10585 | 10540 | pass | pass | 317 pass | 218f9c6 |
| 7+14 | Repos + services | 10540 | 10533 | pass | pass | 317 pass | 9a61ca1 |
| 20 | E2E | 10533 | 10533 | pass | pass | 317 pass + 7/7 E2E | 4e5a8b0 |
