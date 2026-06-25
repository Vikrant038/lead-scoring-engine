This is a network/infrastructure timeout between the agent runtime and the tool execution environment â not something I can fix in your codebase.
What it means
The connection to the file-write service timed out while "preparing" (likely establishing the write stream or checking permissions). Common causes:
Cause
Large file write (>100KB) taking too long to stream
Network blip between agent sandbox and tool runner
Tool runner temporarily overloaded
File system latency (NFS, mounted volumes)
Workarounds (try in order)
1. Split the write â Break large content into multiple smaller write calls
2. Use edit instead â Write a small placeholder file first, then edit to replace with full content
3. Retry immediately â Often succeeds on 2nd attempt
4. Write to /tmp first â Then bash cp /tmp/file /target/path
For the AGENTS.md you want
Since I can't reliably write large files right now, here are two paths:
Option A: I give you the full content here â you copy-paste into AGENTS.md locally
Option B: I write it in 2-3 chunks â smaller writes that won't timeout
Which do you prefer? If Option A, I'll output the complete markdown in my next response.
â£  Plan Â· Nemotron 3 Ultra Free Â· 56.3s
first do option b 
 QUEUED 
Thinking: The user wants me to write the AGENTS.md file using Option B (split into smaller chunks). However, I'm in "Plan Mode" which means I can only read/observe - not make any edits.
I should clarify this with the user - they want me to execute the write, but I'm in read-only mode. I need to ask them to either:
1. Switch me out of plan mode
2. Or they can copy-paste the content themselves
Let me explain this and ask for clarification.
I'm currently in Plan Mode (read-only) â the system blocks all file writes, including the chunked approach.
Two options:
1. You switch me out of Plan Mode â then I'll write the AGENTS.md in 2-3 small chunks (Option B)
2. I output the full content here â you copy-paste into AGENTS.md locally (instant, no timeout risk)
Which do you prefer?
â£  Plan Â· Nemotron 3 Ultra Free Â· 1m 15s
no write the specs.md 
 QUEUED 
â£  Build Â· Nemotron 3 Ultra Free Â· interrupted
no write the specs.md  in one go 
 QUEUED 
no write the specs.md  in one go 
 QUEUED 
Thinking: The user wants me to write a SPECS.md file for the project. They want it in one go. Let me create a comprehensive SPECS.md based on my understanding of the project from all the files I've read.
~ Preparing write...
Tool execution aborted
"Upstream idle timeout exceeded"
IMPLEMENTATION_PLAN.md writw this 3 go 
 QUEUED 
â£  Build Â· Nemotron 3 Ultra Free Â· interrupted
IMPLEMENTATION_PLAN.md writw this in 3 go 
 QUEUED 
Thinking: The user wants me to create an IMPLEMENTATION_PLAN.md file in 3 chunks. Let me create a comprehensive implementation plan based on the project analysis I've done. I'll write it in 3 parts to avoid timeout issues.
~ Preparing write...
Tool execution aborted
"Upstream idle timeout exceeded"
just write the output in the output , whole md file
 QUEUED 
Thinking: The user wants me to write an IMPLEMENTATION_PLAN.md file. They want me to output the whole content in the output window (not write to file due to timeout issues). Let me create a comprehensive implementation plan based on the project analysis I've done.
Given the project is a Lead Scoring Engine (ICP Profiler) with three entry points (CLI, Web, Demo), I'll create a detailed implementation plan that covers:
1. Current state analysis
2. Missing features/gaps
3. Implementation phases
4. Technical details
5. Testing strategy
6. Deployment considerations
Let me output this as a comprehensive markdown file in the response.
IMPLEMENTATION_PLAN.md â Lead Scoring Engine (ICP Profiler)
> Detailed implementation roadmap to take the project from "working demo" to "sellable product"
---
1. Current State Assessment
â What Exists (Production-Ready)
- Core scoring pipeline â 6 modules, weighted, explainable, per-file tested
- AI abstraction â Strategy pattern, NullProvider fallback, result envelopes
- Three entry points â CLI, Web (Express+EJS), Demo (self-contained)
- Multi-user isolation â Session silos + resolveWithin path guard
- Config system â Zod schema, live ConfigService, web Config Editor
- Security â CSRF, CSP, PII redaction, supply chain scanning in CI
- Testing â Unit + Integration (per-file 90/80 coverage), E2E (5 journeys)
- Documentation â ARCHITECTURE.md, ADRs, DEPLOYMENT.md, PROJECT_PLAN.md
â What's Missing (Product Gaps)
Category
Auth
Billing
Email Delivery
Admin
Scalability
Onboarding
API
ObservabilityExport**
Compliance
---
2. Implementation Phases
Phase 0: Foundation (Week 1) â Prerequisites for everything else
Task	Description
0.1 Auth Foundation	Add Clerk/NextAuth (email/password + OAuth), session sync with existing cookie store
0.2 User Model	Extend session store with userId, email, role, subscription status
0.3 Protected Routes	Wrap all existing routes with requireAuth middleware; add role-based access
0.4 Database Migration	Replace file-based session store with Prisma + PostgreSQL (or keep files + add user index)
0.5 Env & Config	Add DATABASE_URL, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY to .env.example and config schema
Exit Criteria: User can register, login, logout; sessions persist across restarts; existing scoring works for authenticated users.
---
Phase 1: Billing & Subscriptions (Week 2)
Task	Description
1.1 Stripe Integration	Products: Free (100 scores/mo), Pro (10k/mo), Team (100k/mo + seats)
1.2 Webhook Handler	Handle checkout.session.completed, invoice.payment_failed, customer.subscription.deleted
1.3 Usage Metering	Track scores per user/month; enforce limits at queue entry
1.4 Billing Portal	Customer portal link in settings; upgrade/downgrade/cancel flows
1.5 Trial Logic	14-day Pro trial on signup; grace period on payment failure
Exit Criteria: User can subscribe, hit limits, upgrade, cancel; webhooks update DB correctly; no revenue leakage.
---
Phase 2: Email Delivery & Notifications (Week 3)
Task	Description
2.1 Provider Abstraction	EmailProvider interface + Resend/SendGrid/SMTP implementations
2.2 Email Queue	BullMQ/Redis queue for reliable delivery; retry with backoff
2.3 Transactional Emails	Welcome, trial ending, invoice, score complete (with PDF attachment)
2.4 Email Settings UI	Connect Resend/SendGrid/SMTP; test send; verify domain status
2.5 Unsubscribe/Preferences	List-unsubscribe header; preference center link
Exit Criteria: Emails send reliably in production; bounce/complaint handling; user can configure provider.
---
Phase 3: Admin & Team Features (Week 4)
Task	Description
3.1 Admin Dashboard	User list, revenue metrics, system health, score volume, error rates
3.2 Team/Workspace Model	Multi-user workspaces with roles (Owner, Admin, Member); shared personas/config
3.3 Invitation Flow	Email invite â accept â join workspace; seat management
3.4 Shared Resources	Workspace-level personas, config, API keys; per-user overrides
3.5 Audit Log	Immutable log of config changes, user actions, billing events
Exit Criteria: Teams can collaborate; admin sees business metrics; all actions auditable.
---
Phase 4: API & Integrations (Week 5)
Task	Description
4.1 REST API	POST /api/v1/score (async), GET /api/v1/results/:id, GET /api/v1/usage
4.2 API Keys	Per-workspace keys with scopes (score:read, score:write, config:read)
4.3 Webhooks	Configure URLs for score.completed, lead.rejected, usage.limit_warning
4.4 CRM Connectors	HubSpot, Salesforce, Pipedrive â push scored leads as contacts/deals
4.5 API Docs	OpenAPI 3.1 spec + Scalar/Redoc UI at /api/docs
Exit Criteria: External systems can score leads programmatically; webhooks fire reliably; API keys scoped.
---
Phase 5: Polish & Scale (Week 6)
Task	Description
5.1 Horizontal Scaling	Redis session store, BullMQ for job queue, stateless web workers
5.2 Onboarding Wizard	4-step: connect email â create persona â upload sample â see results
5.3 GDPR/CCPA	Data export (ZIP), data delete (cascade), consent banner
5.4 Advanced Reporting	PDF reports (Puppeteer), scheduled digests, cohort analysis
5.5 Load Testing	k6 scripts for 1k concurrent users; identify bottlenecks
5.6 Production Hardening	Rate limiting, request size limits, structured logging correlation, Sentry
Exit Criteria: Handles 1k concurrent users; onboarding <3 min; compliance ready; monitoring in place.
---
3. Technical Architecture Decisions
Database Choice
Option	Pros
Prisma + PostgreSQL	Type-safe, migrations, relations, mature
SQLite + better-sqlite3	Zero-infra, fast, file-based
Keep JSON + add user index	Zero migration, current code works
Queue Choice
Option	Pros
BullMQ + Redis	Reliable, retry, priority, monitoring, scaling
In-memory + file backup	Zero-infra
Auth Choice
Option	Pros
Clerk	Drop-in, UI components, orgs, billing sync
NextAuth (Auth.js)	Free, self-hosted, flexible
Custom JWT	Full control
---
4. Database Schema (Prisma)
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
model User {
  id            String    @id @default(cuid())
  clerkId       String    @unique
  email         String    @unique
  name          String?
  role          Role      @default(MEMBER)
  workspaceId   String?
  workspace     Workspace? @relation(fields: [workspaceId], references: [id])
  subscription  Subscription?
  apiKeys       ApiKey[]
  sessions      Session[]
  auditLogs     AuditLog[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
model Workspace {
  id            String    @id @default(cuid())
  name          String
  slug          String    @unique
  ownerId       String
  owner         User      @relation(fields: [ownerId], references: [id])
  members       User[]
  subscription  Subscription?
  personas      Persona[]
  config        WorkspaceConfig?
  apiKeys       ApiKey[]
  webhooks      Webhook[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
model Subscription {
  id                    String   @id @default(cuid())
  userId                String?  @unique
  workspaceId           String?  @unique
  stripeCustomerId      String   @unique
  stripeSubscriptionId  String?  @unique
  stripePriceId         String?
  status                SubscriptionStatus @default(TRIALING)
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean  @default(false)
  trialEndsAt           DateTime?
  user                  User?    @relation(fields: [userId], references: [id])
  workspace             Workspace? @relation(fields: [workspaceId], references: [id])
}
model Persona {
  id          String   @id @default(cuid())
  name        String
  description String?
  config      Json     // PersonaConfig JSON
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  isDefault   Boolean  @default(false)
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
model WorkspaceConfig {
  id        String @id @default(cuid())
  workspace Workspace @relation(fields: [workspaceId], references: [id])
  workspaceId String @unique
  config    Json   // AppConfig JSON (validated by Zod at write)
  updatedAt DateTime @updatedAt
}
model ApiKey {
  id          String   @id @default(cuid())
  name        String
  keyHash     String   @unique // bcrypt hash
  prefix      String   // "sk_live_abc123"
  scopes      String[] // ["score:write", "config:read"]
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
}
model Webhook {
  id          String   @id @default(cuid())
  url         String
  secret      String   // HMAC secret
  events      String[] // ["score.completed", "lead.rejected"]
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  isActive    Boolean  @default(true)
  failureCount Int     @default(0)
  lastTriggeredAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  data      Json     // { inputDir, outputDir, queue, history }
  expiresAt DateTime
  createdAt DateTime @default(now())
}
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  action    String   // "config.updated", "persona.created", "subscription.changed"
  metadata  Json
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
}
enum Role {
  OWNER
  ADMIN
  MEMBER
}
enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  INCOMPLETE
}
---
5. API Contract (OpenAPI 3.1)
# src/config/openapi.ts (excerpt)
openapi: 3.1.0
info:
  title: ICP Profiler API
  version: 1.0.0
servers:
  - url: https://api.icpprofiler.com/v1
paths:
  /score:
    post:
      summary: Score a lead asynchronously
      security: [{ ApiKeyAuth: ["score:write"] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ScoreRequest'
      responses:
        '202':
          description: Accepted for processing
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ScoreJob'
  /results/{id}:
    get:
      summary: Get scoring result
      security: [{ ApiKeyAuth: ["score:read"] }]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProfileResult'
  /usage:
    get:
      summary: Get current usage
      security: [{ ApiKeyAuth: ["score:read"] }]
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Usage'
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
  schemas:
    ScoreRequest:
      type: object
      required: [profile]
      properties:
        profile:
          $ref: '#/components/schemas/ProfileInput'
        personaId:
          type: string
        async:
          type: boolean
          default: true
    ScoreJob:
      type: object
      properties:
        jobId: { type: string }
        status: { type: string, enum: [queued, processing, completed, failed] }
        resultUrl: { type: string, format: uri }
    ProfileInput:
      type: object
      required: [name]
      properties:
        name: { type: string }
        education: { type: array, items: { type: string } }
        jobs: { type: array, items: { type: string } }
        skills: { type: array, items: { type: string } }
        company_details:
          type: object
          properties:
            name: { type: string }
            category: { type: string }
        years_experience: { type: integer, minimum: 0 }
        lastActive: { type: string, format: date }
    ProfileResult:
      # ... existing result types
    Usage:
      type: object
      properties:
        used: { type: integer }
        limit: { type: integer }
        resetAt: { type: string, format: date-time }
        plan: { type: string }
---
6. Testing Strategy per Phase
Phase	Unit Tests
0 Auth	Auth middleware, token validation
1 Billing	Usage metering, trial logic, limit enforcement
2 Email	Template rendering, provider fallback
3 Admin/Team	RBAC, workspace scoping, invitation token
4 API	API key validation, scope enforcement
5 Scale	Rate limiter, Redis session fallback
Coverage Rule: Every new file must clear 90/80 per-file gate. No exceptions.
---
7. CI/CD Pipeline Updates
.github/workflows/ci.yml (additions)
jobs:
  verify:
    # ... existing steps ...
    - name: Database migration check
      run: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /dev/null
    - name: Build API docs
      run: npx @scalar/cli generate -o public/api-docs.html --spec src/config/openapi.json
New workflow: .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:   steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20, cache: npm }
    - run: npm ci
    - run: npm run build
    - run: npx prisma migrate deploy
      env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }
    - name: Deploy to Railway/Render/Fly
      # ... platform-specific deploy step
    - name: Run smoke tests
      run: |
        sleep 10
        curl -f https://icpprofiler.com/health
        curl -f -H "X-API-Key: ${{ secrets.TEST_API_KEY }}" https://api.icpprofiler.com/v1/usage
---
8. Environment Variables (Production)
# .env.production
# --- Core ---
NODE_ENV=production
PORT=3000
SESSION_SECRET=            # 64-char random, generated once
DATABASE_URL=              # PostgreSQL connection string
REDIS_URL=                 # Redis for sessions + BullMQ
# --- Auth (Clerk) ---
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
# --- Billing (Stripe) ---
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_FREE=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...
# --- Email (Resend recommended) ---
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@icpprofiler.com
# --- AI (optional) ---
AI_PROVIDER=gemini
GEMINI_API_KEY=...
OPENAI_API_KEY=...
# --- Observability ---
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info
# --- Feature Flags ---
ENABLE_ONBOARDING_WIZARD=true
ENABLE_API=true
ENABLE_WEBHOOKS=true
---
9. Rollout Plan
Week	Branch
1	feat/auth-foundation
2	feat/billing
3	feat/email
4	feat/admin-teams
5	feat/api-integrations
6	feat/polish-scale
6+	main
Rollback Trigger: Error rate > 1% or p95 latency > 2x baseline â instant rollback via platform CLI.
---
10. Risk Register
Risk
Stripe webhook failures cause subscription desync
Redis failure takes down queue + sessions
Clerk pricing spikes at scale
GDPR delete request breaks referential integrity
CRM API rate limits block webhook delivery
---
11. Success Metrics (Post-Launch)
| Metric | Target | Measurement |



Metric	Target	Measurement
Activation	â¥40% of signups score â¥1 lead in 24h	Mixpanel/PostHog event lead.scored
Retention	â¥60% monthly active (MAU/WAU)	Subscription status + API usage
Revenue	$10k MRR by month 3	Stripe dashboard
Performance	p95 < 500ms (score), < 2s (web)	Sentry/APM
Reliability	99.9% uptime, < 0.1% error rate	Health endpoint + Sentry
NPS	â¥50	In-app survey quarterly
---
12. File Tree (Post-Implementation)
src/
  batch/                    # unchanged
  cli/                      # unchanged
  config/
    config.schema.ts        # + auth, billing, api, webhook, workspace keys
    config.service.ts       # + workspace scoping
    openapi.ts              # NEW: OpenAPI spec generation
  demo/                     # unchanged
  domain/
    *.types.ts              # + user, workspace, subscription, api-key, webhook
    user.types.ts           # NEW
    workspace.types.ts      # NEW
  lib/
    errors/                 # + BillingError, AuthError, RateLimitError
    logger/                 # unchanged
    security/               # + rate-limit.middleware.ts
  llm/
    email-provider.interface.ts  # NEW
    resend.provider.ts           # NEW
    sendgrid.provider.ts         # NEW
    ...existing providers...
  modules/
    billing/
      stripe.client.ts         # NEW
      subscription.service.ts  # NEW
      trial.service.ts         # NEW
      usage.service.ts         # NEW
    email/
      templates/               # NEW: welcome.ejs, trial-ending.ejs, invoice.ejs, score-complete.ejs
      transactional.service.ts # NEW
      unsubscribe.service.ts   # NEW
      email.queue.ts           # NEW (BullMQ)
    api/
      api-key.service.ts       # NEW
    webhooks/
      webhook.service.ts       # NEW
    integrations/
      hubspot.connector.ts     # NEW
      salesforce.connector.ts  # NEW
      pipedrive.connector.ts   # NEW
    reporting/
      pdf.generator.ts         # NEW (Puppeteer)
      digest.service.ts        # NEW
    compliance/
      gdpr.service.ts          # NEW
    team/
      invitation.service.ts    # NEW
    audit/
      audit.service.ts         # NEW
  repositories/
    user.repository.ts         # NEW
    workspace.repository.ts    # NEW
    prisma.session.store.ts    # NEW (replaces file-based)
    ...existing...
  schemas/
    auth.schema.ts             # NEW
    api-key.schema.ts          # NEW
    webhook.schema.ts          # NEW
    workspace.schema.ts        # NEW
    ...existing...
  web/
    middleware/
      auth.middleware.ts       # NEW
      rbac.middleware.ts       # NEW
      rate-limit.middleware.ts # NEW
      ...existing...
    controllers/
      auth.controller.ts       # NEW
      billing.controller.ts    # NEW
      billing.webhook.ts       # NEW
      admin.controller.ts      # NEW
      api.controller.ts        # NEW
      onboarding.controller.ts # NEW
      team.controller.ts       # NEW
      ...existing...
    routes/
      auth.routes.ts           # NEW
      billing.routes.ts        # NEW
      admin.routes.ts          # NEW
      api.routes.ts            # NEW
      team.routes.ts           # NEW
      index.routes.ts          # + mount new routes
    services/
      email.queue.ts           # NEW
      email.processor.ts       # NEW
      redis.queue.ts           # NEW
      usage.service.ts         # NEW
      ...existing...
    views/
      login.ejs                # NEW
      register.ejs             # NEW
      billing.ejs              # NEW
      admin/
        dashboard.ejs          # NEW
        audit.ejs              # NEW
      team/
        invite.ejs             # NEW
        members.ejs            # NEW
      onboarding/
        step1-connect-email.ejs # NEW
        step2-create-persona.ejs # NEW
        step3-upload-sample.ejs  # NEW
        step4-results.ejs       # NEW
      api-docs.ejs             # NEW
      webhooks.ejs             # NEW
      privacy.ejs              # NEW
      ...existing...
    context.ts                 # + user, workspace, subscription
  server.ts                    # + Prisma, Redis, BullMQ init
prisma/
  schema.prisma                # NEW
  migrations/                  # NEW
tests/
  unit/
    auth.middleware.test.ts    # NEW
    billing.service.test.ts    # NEW
    email.service.test.ts      # NEW
    api-key.service.test.ts    # NEW
    gdpr.service.test.ts       # NEW
    ...existing...
  integration/
    auth.flow.test.ts          # NEW
    billing.webhook.test.ts    # NEW
    api.scoring.test.ts        # NEW
    team.collaboration.test.ts # NEW
    ...existing...
  e2e/
    auth.spec.ts               # NEW
    billing.spec.ts            # NEW
    admin.spec.ts              # NEW
    api.spec.ts                # NEW
    onboarding.spec.ts         # NEW
    ...existing...
.github/workflows/
  deploy.yml                   # NEW
  ...existing...
k6/
  load-test.js                 # NEW
docs/
  LOAD_TEST_RESULTS.md         # NEW
  API.md                       # NEW (generated from OpenAPI)
---
13. Quick Start for New Developer
# 1. Clone & install
git clone https://github.com/yourorg/lead-scoring-engine
cd lead-scoring-engine
npm install
# 2. Infrastructure (Docker Compose for local)
docker compose up -d postgres redis
# 3. Env
cp .env.example .env
# Fill in: DATABASE_URL, REDIS_URL, CLERK keys, STRIPE keys, RESEND key
# 4. Database
npx prisma migrate dev --name init
# 5. Build & run
npm run build:css
npm run dev:server    # http://localhost:3000
# 6. Test
npm run typecheck
npm run lint
npm test -- --coverage
npm run test:e2e
---
14. Decision Log (Key Choices)
Decision	Rationale	Alternative Considered
Clerk over NextAuth	10x faster to market; orgs, billing sync, UI components built-in	NextAuth (free, self-hosted) â chosen for v2 if cost becomes issue
Prisma + PostgreSQL	Type-safe, migrations, relations, team familiar	Raw SQL (too manual), Drizzle (less mature migrations)
BullMQ + Redis	Industry standard, monitoring, priority queues, retries	In-memory (dev only), RabbitMQ (overkill)
Resend for email	Developer experience, deliverability, React Email support	SendGrid (legacy UI), SMTP (deliverability risk)
Per-file coverage gate	Catches module rot; enforced in CI	Project-level only (hides gaps) â rejected
Zod as single source	No drift between validation, types, config	Manual types + Joi (drift inevitable) â rejected
Session silos + path-guard	Real isolation without DB; proven in E2E	Shared DB with RLS (complexity, not needed yet)
---
## 15. Notes for the Agent
- **Never skip quality gates** â `typecheck â lint â test --coverage` must pass locally before push
- **Always check `llm.available`** before calling AI â `NullProvider` is the default
- **All user paths go through `resolveWithin`** â test path traversal in `tests/unit/path-guard.test.ts`
- **Config edits are live** â `ConfigService.set()` replaces atomically; no restart needed
- **Entry points excluded from coverage** â `/* istanbul ignore next */` on `src/cli/index.ts`, `src/web/server.ts`, `demo.ts`
- **No `any`, no `console.*`** â ESLint enforces; use `logger` (redacts PII)
- **Types are `z.infer<typeof schema>`** â never hand-write domain types
- **CI order is strict** â `typecheck â lint â test` â `security` â `e2e` (all must pass)
- **When in doubt, read `docs/ARCHITECTURE.md`** â it explains the *why* behind every pattern
---
End of Implementation Plan