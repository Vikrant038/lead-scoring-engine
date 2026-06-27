# NEXT_PHASE.md — Lead Scoring Engine (ICP Profiler)

> **Execution Roadmap & Showcase Status**  
> Turning the lead scoring engine into a high-impact, client-ready portfolio showcase piece.

---

## 🏆 Completed Achievements & Production Features

- [x] **Better Auth & SQLite Integration (`data/icp.db`):** Production-grade authentication with user identity persistence, secure passwords, and Drizzle ORM integration.
- [x] **Google OAuth 2.0 Integration:** Full social single sign-on support via server-forwarded REST proxies (`/api/auth/sign-in/social`).
- [x] **Per-User Session Silos (`data/sessions/{userId}/`):** Strict filesystem isolation ensuring each user's job inputs, qualified outputs, and history remain private and secure.
- [x] **Glassmorphic Dark Mode UI & Notifications:** Modern, responsive EJS templates with custom Tailwind styling, single-use per-user Instant Demo Profiling (`demo_batch_run_{userId}`), and floating top-right completion toasts.
- [x] **Strict Quality Gates:** 27 test suites, 238 passing unit/integration tests meeting per-file coverage floors (90% statements, 80% branches). Zero ESLint errors.

---

## 🚀 Phase 1: Cloud Deployment (Render / Railway / AWS EC2)

### 1.1 Deploying to Render / Fly.io
1. Connect GitHub repository to Render / Fly.io Web Service.
2. Set **Build Command:** `npm ci && npm run build`
3. Set **Start Command:** `npm start` (or `node dist/src/web/server.js`)
4. Attach a **Persistent Volume** mounted at `/app/data` (stores `icp.db` and user session silos across deployments).
5. Configure Environment Variables:
   ```env
   NODE_ENV=production
   PORT=3000
   SESSION_SECRET=your_production_secret_key
   AI_PROVIDER=gemini (or openai / none)
   GEMINI_API_KEY=your_gemini_key
   AUTH_GOOGLE_CLIENT_ID=your_google_client_id
   AUTH_GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

---

## 📊 Phase 2: Enterprise SaaS Enhancements (Portfolio Scaling)

1. **Metered Billing (Stripe Webhooks):** Track lead qualification credits per user account.
2. **PostgreSQL Migration:** Move SQLite relational models to PostgreSQL for enterprise horizontal scaling.
3. **CRM Synchronization:** Bidirectional webhooks for HubSpot and Salesforce lead syncing.
