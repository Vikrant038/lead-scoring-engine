# Video Script — ICP Profiler Demo (≤ 2 minutes)

> Record this as a Loom video. Keep it tight — every second counts.

---

## Setup (before recording)

- Have the terminal ready with this project open
- Have the live app running at http://localhost:3000 (or the Render URL)
- A test lead file ready in `./input/` (e.g. `jane-doe.json`)
- Browser open to the app, logged out (so the login page shows first)

---

## Script

### 0:00 — Hook (10 seconds)
> *"Sales teams waste hours manually qualifying leads. I built a tool that does it in seconds."*

Open the terminal. Run:
```
npm run demo -- --no-ai --html --count 10
```
Watch the coloured terminal output.

### 0:20 — Show the HTML report (20 seconds)
> *"With the `--html` flag, it generates a standalone report you can share with anyone."*

Open `demo-output/demo-report.html` in the browser. Scroll slowly.
- Point to the bucket distribution
- Point to the top-10 leads table with score bars
- Point to the sample outreach email

### 0:45 — Show the web app (40 seconds)
> *"There's also a full web app. Let me show you."*

Navigate to the live URL. The login page shows.

> *"Anyone can try it — I've got a demo account."*

Click **"Try the demo"** button. Land on the home page.

> *"Drag and drop a JSON lead file..."*

Drag `jane-doe.json` onto the dropzone. Watch the live progress indicator.

Click on **History** in the nav. The result appears.

> *"Expand it — you get the full breakdown: component scores, persona fit, and a drafted outreach email."*

Click **Details** on the row. Scroll through the expanded panel.

### 1:30 — Architecture moment (20 seconds)
> *"The scoring pipeline is modular: Data Quality → Education → Experience → Thinking Quality → Scorer → Profiler. Weights are configurable, AI is optional."*

Click on **Config** in the nav. Show the LLM provider dropdown.

### 1:55 — CTA (5 seconds)
> *"Repo and live demo links are in the description. Thanks for watching."*

---

## Key Links to include in description

- GitHub: `https://github.com/Vikrant038/lead-scoring-engine`
- Live Demo: `https://YOUR_APP.onrender.com`

---

## Tips for recording

- Use [Loom](https://loom.com) (free, shareable link instantly)
- Record at 1280×720 minimum
- Use `--count 10 --no-ai` so the terminal output is quick and readable
- Speak slowly and clearly — let the visuals do the work
