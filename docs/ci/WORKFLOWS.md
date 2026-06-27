# Continuous Integration & Security Workflows Documentation

This repository enforces automated quality and security checks on every pull request and commit to `main` or `develop` branches via GitHub Actions.

---

## 🛡️ Security Workflow (`.github/workflows/security.yml`)

The **Security Workflow** safeguards the application against supply chain vulnerabilities, leaked credentials, risky pull-request dependencies, and compliance gaps.

### Steps & Security Standards
1. **Software Composition Analysis (SCA):** Runs `npm audit --audit-level=high` to fail the build if high or critical severity vulnerabilities exist in the dependency tree. (Mitigated via `overrides` in `package.json`).
2. **Secret Scanning (Gitleaks):** Uses `gitleaks/gitleaks-action@v2` to scan commits and repository files for exposed API keys, private keys, passwords, or tokens.
3. **Dependency Review:** Executes `actions/dependency-review-action@v4` on PRs to evaluate newly introduced dependencies for known CVEs before merging.
4. **Software Bill of Materials (SBOM):** Generates a CycloneDX JSON format SBOM via `anchore/sbom-action@v0` and stores it as a 90-day retained artifact.

---

## ⚡ CI Pipeline (`.github/workflows/ci.yml`)

The **CI Workflow** verifies core codebase integrity, type safety, and test coverage floor compliance before code merging.

### Steps & Quality Gates
1. **Strict Type Checking:** Runs `npm run typecheck` (`tsc --noEmit`) under strict TypeScript compiler settings.
2. **Global Linting:** Runs `npm run lint` (`eslint . --ext .ts`) enforcing strict rules (no `any`, no `console.log`).
3. **Unit & Integration Coverage Gate:** Runs `npm test -- --coverage` requiring ≥90% statement coverage and ≥80% branch coverage on every source file.

---

## 🎭 E2E Testing Workflow (`.github/workflows/e2e.yml`)

The **E2E Workflow** validates end-to-end user journeys in a real headless browser against a live server instance.

### Steps & Verification
1. Boots the production server bundle (`npm run build`).
2. Installs Playwright browser dependencies (`npx playwright install --with-deps chromium`).
3. Executes top-5 user journeys (`npm run test:e2e`): file upload, persona management, config editing, email settings, and clearing data.
4. Uploads diagnostic artifacts (`playwright-report/`) retained for 7 days if any test fails.
