# NEXT_PHASE.md — Lead Scoring Engine (ICP Profiler)

> **4–6 week roadmap** to turn the working engine into a **live, polished, client‑ready portfolio piece**.  
> This plan is built for **5–10 hours per week** of focused work. Every decision serves one goal:  
> **Make a stranger watch your 2‑minute Loom video and think “this person can solve my problem.”**

---

## Guiding Principles (for this phase)

1. **No new monthly costs.** Use free tiers (Render persistent disk, SQLite, no paid auth services).  
2. **No infrastructure you don’t need.** One Node process, one SQLite file, one server.  
3. **Every feature must be demoable in 10 seconds.** If you can’t show it in a Loom, it doesn’t count.  
4. **Polish beats scope.** Five flawless screens beat fifteen half‑finished ones.

---

## Phase 0 – Live Deployment & Demo Polish (Week 1–2)

**Goal:** The app is live on a public URL and the demo mode is so good that people *want* to clone the repo.

### 0.1 Deploy to Render (or Railway / Fly.io)

**Why Render?** Free tier includes 1 GB persistent disk, auto‑deploy from GitHub, and custom domains.  
1. Push your repository to GitHub.  
2. Create a new **Web Service** on Render, connect the repo.  
3. Set the **Build Command**: `npm ci && npm run build && npm run build:css`  
4. Set the **Start Command**: `node dist/src/web/server.js`  
5. Under **Advanced → Disks**, add a disk with mount path `/app/data` and size 1 GB.  
6. Add environment variables:
SESSION_SECRET=<a long random string>
NODE_ENV=production
PORT=3000
AI_PROVIDER=none (or gemini/openai if you have a key)

text
7. Deploy. Once live, visit `https://<your-app>.onrender.com` – you should see the upload page.

**Important:** The `data/` folder (including `data/icp.db` later) will be created **automatically** by your app on the persistent disk. No manual setup is needed.

### 0.2 CSS & Visual Polish

- Run `npm run build:css` and commit the generated `public/css/app.css`.
- Verify that every page uses the accent colour `#0029ff` consistently.
- Test on a real mobile phone (or browser dev tools) – fix any layout issues with the history table, persona cards, or hamburger menu.
- Add a **favicon** – reuse the rocket SVG from the hero.

### 0.3 Self‑Demo Overhaul (`npm run demo`)

Make the demo command the star of the project:

- Add `chalk` to `devDependencies` for colourful terminal output.
- Modify `demo.ts` so that when AI is available it generates 20 fake leads with diverse backgrounds; when AI is unavailable, it uses the fallback dataset silently.
- Print a **structured summary**:
📊 Batch Summary
Total: 20 | Processed: 19 | Rejected: 1
HIGH: 5 | MEDIUM: 8 | LOW: 5 | NOT FIT: 1
Average ICP score: 74.2

text
- Always show **one sample email** at the end (if AI enabled).
- Add an `--html` flag: `npm run demo -- --html`  
This writes `demo-output/demo-report.html` – a standalone, beautiful HTML report (inline Tailwind, no server needed) with:
- Summary statistics
- Top 10 leads in a styled table
- A sample outreach email
- The persona match breakdown (if a persona was used)
- This is your Loom hero shot.

### 0.4 Loom Video Script

Write the script in `docs/VIDEO_SCRIPT.md`. Keep it ≤ 2 minutes:
1. “Let me show you a lead‑scoring tool I built.”  
2. Run `npm run demo -- --html` – show the terminal output, then open the HTML report.  
3. Open the live web app – log in as `demo@example.com` (demo user, see Phase 1), drag‑drop a file, watch it score, open the history page with email preview.  
4. “Here’s the repo and the live demo – links in the description.”

**Exit criteria (Phase 0):**  
- [ ] Live URL loads the upload page.  
- [ ] `npm run demo -- --html` produces a stunning report.  
- [ ] Loom video is recorded and linked in the README.

---

## Phase 1 – Simple Auth & Real Multi‑User Persistence (Week 3–4)

**Goal:** Replace the ephemeral session‑silo with persistent user accounts. No billing, no teams – just “a user can log in and their data is theirs forever.”

### 1.1 Add SQLite with `better-sqlite3`

- Install: `npm install better-sqlite3 && npm install -D @types/better-sqlite3`
- Create `src/db/connection.ts`:
```ts
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'icp.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');   // better concurrent reads

export default db;
The file data/icp.db will be created automatically on first run, on the Render persistent disk.

Why not PostgreSQL? SQLite is a perfect fit for a single‑server demo app. Zero infrastructure, zero cost, and more than enough for hundreds of users.

### 1.2 User Model & Better Auth Integration

**Why Better Auth instead of custom auth?**
- **Modern TypeScript-First Standards:** Better Auth provides end-to-end type safety, built-in rate limiting, session management, password reset flows, email verification, and OAuth (Google, GitHub) out of the box.
- **Database Backend:** Mounted via Drizzle ORM to SQLite (`data/icp.db`), handling schema migrations cleanly.
- **CSRF & Isolation Co-existence:** Existing `express-session` is retained strictly for CSRF synchronizer tokens (`icp.sid`), separating user identity state into Better Auth sessions (`better-auth.sid`).

**Implementation Details:**
- Better Auth handler mounted at `/api/auth/*`.
- Express auth routes (`/auth/login`, `/auth/register`, `/auth/logout`) handled by `auth.controller.ts` interacting with Better Auth API.
- Session silos updated to partition storage per user (`data/sessions/{userId}/`), ensuring multi-device persistence while `resolveWithin` prevents path traversal.

1.3 Demo User & Quick Login
After migration, seed a demo user if not exists: demo@example.com / password.

On the login page, add a prominent “Try the demo” button that logs in as this user.

This replaces the old anonymous session silo – reviewers always see a curated demo dataset.

1.4 Session Store Migration
Replace the file‑based session store with the SQLite sessions table (shown above).

The old session silo directories (data/sessions/{userId}/input, output) remain unchanged – they hold the actual lead files. Only the session metadata moves to SQLite.

On Render, the persistent disk ensures data/icp.db survives redeploys.

Exit criteria (Phase 1):

A reviewer visits the live URL and sees a login page.

They click “Try the demo” and are logged in as demo@example.com.

They upload a file, see it scored, and view it on /history.

They open a second browser, register a new account, upload a different file, and see only their own leads – isolation proven.

Restarting the server does not lose data.

Phase 2 – Portfolio‑Grade Polish (Week 5–6)
Goal: The app feels finished. Every rough edge is sanded. The documentation makes you look like a professional.

2.1 Error Handling & Empty States
Add a custom 404 page (views/404.ejs).

Add empty states: “No leads scored yet” on /history, “No personas yet” on /personas.

If a user is not authenticated, show a friendly message with a login link instead of a raw redirect.

On the upload page, show a clear error if a file is not valid JSON.

2.2 Responsive & Accessibility Audit
Run Lighthouse (in Chrome DevTools) on every page. Aim for 90+ on Performance, Accessibility, Best Practices.

Fix any keyboard navigation issues (dropzone, modals, history row expand/collapse).

Add aria-label and role attributes where missing.

Test the entire flow using only the keyboard (Tab, Enter, Escape).

2.3 README & Documentation
Finalise README.md:

Problem statement (what this solves)

Screenshot or GIF of the demo report

Quickstart (clone, install, run demo, open localhost)

Link to live demo and Loom video

Tech stack

Architecture diagram (ASCII is fine)

Add docs/CASE_STUDY.md:

Problem: “Sales teams waste hours manually qualifying leads.”

What I built: “A modular 4‑dimension scoring system with batch processing and a web UI.”

Result: “3× faster evaluation; ~8–10 hrs/week saved for the team.” (use the internship outcome numbers)

Tech: Node.js, Express, SQLite, Tailwind, Gemini/OpenAI (optional)

Add a link to the case study from the app’s footer.

2.4 Final GitHub & LinkedIn Polish
Pin the repo to your GitHub profile.

Write a LinkedIn post: one paragraph about the problem, a screenshot, and the Loom link.

Update your LinkedIn headline to “I build AI‑powered automation & data tools for businesses” and link the repo in the Featured section.

Exit criteria (Phase 2):

Lighthouse score ≥ 90 on all pages.

README includes problem, screenshot, quickstart, live link.

docs/CASE_STUDY.md is written.

LinkedIn post is published.

A cold visitor can land on your repo, watch the Loom, click the live URL, log in as demo, and score a lead – all in under 2 minutes.

