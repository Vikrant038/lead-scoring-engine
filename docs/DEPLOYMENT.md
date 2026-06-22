# Deployment & Operations Guide

How to take the Lead Scoring Engine from a clone to a running service — locally, or in production.
It needs no database and no external services; AI is optional. That makes it genuinely easy to run,
but there are a few things you *must* get right for the web app in production (chiefly the session
secret and HTTPS). This guide covers all of it.

---

## 1. Prerequisites

- **Node.js ≥ 18** (the project is developed and tested on Node 20).
- **npm** (a committed `package-lock.json` guarantees reproducible installs).
- That's it. No database, no Redis, no message queue.

Optional, only if you want AI features:

- A **Google Gemini** API key, or
- An **OpenAI** API key.

Without either, the system runs fully on rule-based logic.

---

## 2. Environment variables

Copy the template and fill in what you need:

```bash
cp .env.example .env
```

| Variable          | Scope  | Required?                     | Purpose                                                            |
| ----------------- | ------ | ----------------------------- | ------------------------------------------------------------------ |
| `AI_PROVIDER`     | server | No (default `none`)           | `none` \| `gemini` \| `openai`. Selects the LLM provider.          |
| `GEMINI_API_KEY`  | server | If `AI_PROVIDER=gemini`       | Google Gemini key.                                                 |
| `OPENAI_API_KEY`  | server | If `AI_PROVIDER=openai`       | OpenAI key.                                                        |
| `SESSION_SECRET`  | server | **Yes, in production**        | Signs session cookies. Use a long random string. **See §5.**       |
| `PORT`            | server | No (default `3000`)           | Web server port.                                                   |
| `LOG_LEVEL`       | server | No (default `info`)           | pino level: `error` \| `warn` \| `info` \| `debug`.                |

> **Never commit `.env`.** It is gitignored. Secrets belong in your platform's secret manager
> (AWS Secrets Manager, Vault, Render/Railway/Fly env settings), not in the repo.

---

## 3. Build

```bash
npm ci          # reproducible install from the lockfile
npm run build   # tsc -> dist/  (also surfaces any type error before deploy)
```

For a styled UI, build the CSS too (the app works without it, just unstyled):

```bash
npm run build:css   # Tailwind -> public/css/app.css
```

Compiled output lands in `dist/`. The web entry is `dist/src/web/server.js`; the CLI entry is
`dist/src/cli/index.js`.

---

## 4. Running

### Batch CLI

```bash
# put JSON lead files in ./input, then:
npm start                       # node dist/src/cli/index.js
```

Writes per-lead results, a batch summary, and a CSV into `./output`.

### Web app

```bash
npm run server                  # node dist/src/web/server.js  (production: built)
# or, for development with reload:
npm run dev:server              # tsx src/web/server.ts
```

Serves on `http://localhost:$PORT` (default 3000).

### Self-demo

```bash
npm run demo -- --no-ai --persona default-icp --output ./demo-output
```

---

## 5. Production checklist (the parts that actually matter)

1. **Set a strong `SESSION_SECRET`.** If you don't, the server generates a random one at startup and
   warns you — which means every restart invalidates all sessions. Set a fixed, secret value.
2. **Terminate TLS.** Session cookies are flagged `Secure` when `NODE_ENV=production`, so the app
   must be served over HTTPS (via a reverse proxy or platform TLS). Over plain HTTP in production,
   cookies won't be sent and sessions will appear broken.
3. **Set `NODE_ENV=production`.** Enables the `Secure` cookie flag and production logging.
4. **Run behind a reverse proxy** (nginx/Caddy/your platform's router) for TLS, gzip, and a sane
   request timeout. If the proxy sets `X-Forwarded-*`, enable Express `trust proxy` accordingly.
5. **Persist `data/`.** Session silos, inputs, and outputs live under `data/`. On ephemeral
   filesystems (containers, serverless), mount a volume or accept that session data resets on
   redeploy. The app is designed to tolerate a reset (sessions simply start fresh).
6. **Mind the in-memory queue.** Job processing is a single-process in-memory queue. Run **one**
   web instance, or make the queue/sticky-sessions explicit before scaling horizontally — two
   instances would not share each other's queue or session files.

---

## 6. Deployment options

### Bare Node + process manager (PM2)

```bash
npm ci && npm run build && npm run build:css
NODE_ENV=production SESSION_SECRET=... pm2 start dist/src/web/server.js --name icp-web
```

Put nginx/Caddy in front for HTTPS.

### Docker (sketch)

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:css
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/src/web/server.js"]
```

Run with a mounted volume for `data/` and the secret injected at runtime:

```bash
docker run -p 3000:3000 -e SESSION_SECRET=... -v $(pwd)/data:/app/data icp-engine
```

### PaaS (Render / Railway / Fly.io)

- Build command: `npm ci && npm run build && npm run build:css`
- Start command: `node dist/src/web/server.js`
- Set `SESSION_SECRET`, `NODE_ENV=production`, and any AI keys in the platform's env settings.
- Attach a persistent disk mounted at `/app/data` if you want session data to survive redeploys.

---

## 7. Verifying a deployment (smoke test)

After deploy, confirm the critical path before declaring victory:

1. `GET /` returns 200 and renders the upload page (check for the `x-content-type-options: nosniff`
   header — proves helmet is active).
2. Upload a small JSON lead via the dropzone; confirm it appears scored on `/history`.
3. Open the app in a second browser/incognito window — confirm it sees an **empty** history (proves
   session isolation).

The Playwright suite (`npm run test:e2e`) automates exactly these journeys and can be pointed at a
deployed URL via `E2E_BASE_URL`.

---

## 8. Operations notes

- **Logs** are structured JSON (pino) with a `correlationId` per request and automatic redaction of
  sensitive fields. Ship them to your log aggregator as-is.
- **No background jobs or cron** are required.
- **Upgrades**: `npm ci` from the committed lockfile gives a deterministic install. Run
  `npm audit` and the CI security workflow before shipping a dependency bump.
- **Rollback**: the app is stateless apart from `data/`. Redeploy the previous build; session silos
  on disk remain compatible.

---

## 9. CI/CD

Three GitHub Actions workflows gate every change (see `.github/workflows/`):

- **ci.yml** — typecheck → lint → tests with the per-file coverage gate.
- **security.yml** — `npm audit`, Gitleaks secret scan, dependency review, and a CycloneDX SBOM
  artifact (90-day retention).
- **e2e.yml** — builds, installs Chromium, and runs the Playwright top-5 journeys on pull requests.
