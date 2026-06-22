# 5-Minute Walkthrough — Video Script & Storyboard

A shot-by-shot script for a ~5-minute demo video. It's written so you can read the **Say** column
almost verbatim while doing the actions in the **Show** column. Total target: **5:00**. Keep energy
up, don't read specs — tell the story.

**Before you record**

- `npm run build && npm run build:css`
- Have two browser windows ready (one normal, one incognito) for the isolation demo.
- Pre-stage a small JSON lead file on your desktop (`jane.json`) and the persona file.
- Optional: set an AI key so the explanation + email render live. If not, narrate that it degrades
  gracefully — that's a feature, not a gap.
- Terminal font large; hide bookmarks bar; clear `./demo-output`.

---

## 0:00 – 0:30 — The hook (the problem)

**Show:** Your face, or a spreadsheet of 500 leads.

**Say:**
> "Here's a sales team's reality: a spreadsheet with 500 leads and one question — who do I actually
> call today? Answering that by hand is slow, inconsistent, and biased by whoever's reading the list.
> I built a Lead Scoring Engine that answers it in code — and, importantly, *explains* every score
> instead of hiding it in a black box. Let me show you."

---

## 0:30 – 1:15 — The self-demo (whole pipeline in one command)

**Show:** Terminal. Run:
```bash
npm run demo -- --no-ai --persona default-icp --output ./demo-output
```

**Say:**
> "Fastest way to see it work — the self-demo. One command. It generates leads, runs the full
> pipeline, and prints a summary. I'm running it with `--no-ai` on purpose, to make a point: no API
> key, and it still works. Here's the bucket distribution — HIGH, MEDIUM, LOW, NOT FIT — the average
> score, and the top persona matches with their fit. Every one of these numbers is explainable."

**Show:** Point at the bucket distribution and the top-3 persona matches in the output.

---

## 1:15 – 2:30 — The web app: upload → score → history

**Show:** Browser at `localhost:3000`. Drag `jane.json` onto the dropzone. Watch the queue tick to
completed. Click **History**.

**Say:**
> "Now the web app. Drag a lead in — it goes into a processing queue with live progress. When it's
> done, it shows up in history with its ICP score and bucket. And this is the part that matters:
> click in and you see the *component scores* — education, experience, thinking quality — the parts
> that produced the final number. A salesperson can argue with this score, which means they'll
> actually trust it."

**Show:** Open the lead's result / download. If AI is on, show the explanation + the 📧 email panel.

**Say (if AI on):**
> "With an AI key, it also writes a plain-English explanation and a ready-to-send outreach email,
> toned to the lead's bucket. With no key, those simply don't appear — the scoring never breaks."

---

## 2:30 – 3:15 — Personas & config (it's tunable)

**Show:** Go to **Personas**, upload/activate a persona. Then **Config** — change a weight, Save,
show "Saved." Then **Reset to Defaults**.

**Say:**
> "The scoring isn't hardcoded opinion — it's configurable. I can define a persona — the skills,
> roles, and company tiers I care about — and score leads against it with a gap analysis. And the
> whole scoring config is editable live, as validated JSON: change a weight, save, and the next
> score uses it immediately. Bad config is rejected, not silently applied."

---

## 3:15 – 4:00 — The thing most demos skip: multi-user isolation

**Show:** Side-by-side: your normal window (with Jane in history) and an incognito window. In
incognito, go to `/history` — it's empty.

**Say:**
> "Here's what I'm proudest of. This is multi-user, with no database. Every browser session gets its
> own sealed silo on disk. Watch — my first window has Jane in its history. This incognito window is
> a different session: empty. It cannot see, download, or even guess at the other session's data.
> And any filename derived from a request passes through a path-guard, so a crafted cookie can't
> escape the data directory. Isolation by design, not by hope."

---

## 4:00 – 4:40 — How it's built (system design, fast)

**Show:** Editor: the `src/` tree, then `llm/llm-client.interface.ts` and a controller.

**Say:**
> "Under the hood it's a strict layered architecture — route, controller, service, repository — and
> the AI sits behind one interface with three implementations, including a no-op. That's why it
> degrades gracefully: swapping the model for nothing is a one-line decision. Errors travel as typed
> data, not exceptions across boundaries. And the whole thing was built under a four-document
> engineering manifesto with per-file test coverage — every file earns its place, not just the
> average."

---

## 4:40 – 5:00 — Close

**Show:** Back to your face, or the README.

**Say:**
> "So: a transparent, explainable lead-scoring engine — CLI, web, and self-demo — that treats AI as
> an enhancement, never a crutch, and isolates every user without a database. It's all on GitHub,
> with the architecture and the reasoning written up. Thanks for watching."

---

## Cheat-sheet (on-screen actions, in order)

1. `npm run demo -- --no-ai --persona default-icp --output ./demo-output`
2. Web: drag `jane.json` → queue → History → open result (+ email if AI on)
3. Personas: upload + activate
4. Config: edit a weight → Save → Reset
5. Two windows: normal vs incognito `/history` (isolation)
6. Editor: `src/` tree, `LLMClient` interface, a controller
7. Close on README / GitHub

**Timing tip:** if you're running long, cut the editor section (4:00–4:40) first — the isolation
demo and the self-demo are the two moments that land hardest.
