# Lead Scoring Engine (ICP Profiler)

## Software Requirements Specification

### Part 1 of 2

**Version:** 1.0  
**Date:** 2026-06-21  
**Author:** [Vikrant]

---

## 1. Introduction

### 1.1 Purpose

This document defines the complete functional and non‑functional requirements for the **Lead Scoring Engine (ICP Profiler)** — a modular, multi‑user system that automates the qualification of prospect profiles. The system ingests lead data in JSON format (manually curated from sources like RocketReach), computes an Ideal Customer Profile (ICP) score, classifies leads into priority buckets, and optionally generates AI‑powered narrative explanations, personalised outreach emails, and persona‑based fit assessments. The system exposes both a batch‑processing command‑line interface (CLI) and a multi‑user web application, and includes a self‑demonstration mode.

### 1.2 Document Conventions

- **Shall** indicates a mandatory requirement.
- **Should** indicates a recommended but optional requirement.
- **May** indicates a permissible but fully optional capability.
- All requirements are identified with a unique ID (e.g., `FR-01-001`).
- The system configuration is referred to as “config”; the core scoring pipeline is composed of Data Quality, Education, Experience, Thinking Quality, Scorer, and Profiler modules.

### 1.3 Intended Audience

- **Developers** responsible for implementing and maintaining the system.
- **Quality Assurance** testers verifying the system behaviour.
- **Product Owners / Freelance Clients** wanting a clear picture of what is delivered.
- **Portfolio Reviewers** evaluating the project’s completeness and design.

### 1.4 Product Scope

The system comprises:

- A **batch processing CLI** (`npm start` or `node index.js`) that reads JSON profiles from an input directory, scores them, and writes per‑lead results, a batch summary, and a CSV export.
- A **web application** (`node server.js`) providing:
  - Drag‑and‑drop JSON upload with an in‑memory processing queue and real‑time progress polling.
  - A history page listing all processed leads with download links.
  - A configuration editor (JSON).
  - Persona management (create, edit, delete, set active) and persona‑based lead matching.
  - AI‑powered features: ICP score explanation narrative, personalised outreach email draft, and a self‑demonstration mode.
- **Multi‑user isolation** through session‑scoped file directories, ensuring each browser session sees only its own uploaded data and results.
- A **self‑demonstration CLI** (`npm run demo`) that generates fake leads and runs the full pipeline to showcase all features without any manual data entry.

The system is designed to run entirely from local files; it requires no database, though session data is stored in memory (with optional file‑based session stores for persistence across restarts). All AI capabilities are optional and gracefully degrade to rule‑based logic when no LLM API key is provided.

---

## 2. Overall Description

### 2.1 Product Perspective

The Lead Scoring Engine is a standalone Node.js application. It can be installed on any system with Node.js ≥ 18. It does not integrate with external services except for optional AI APIs (Google Gemini or OpenAI) and optional persistent session stores. The web interface is a classic server‑rendered application using Express, EJS, and Multer; there is no separate frontend build step. All data is stored as plain JSON and CSV files on the server’s filesystem, partitioned per user session in multi‑user mode.

### 2.2 Product Functions (High‑Level Summary)

1. **Batch Scoring** – Process a folder of JSON lead files and produce individual results, a batch summary, and a CSV export.
2. **Web Upload & Processing** – Accept JSON file uploads, queue them, process sequentially, and expose progress via polling API.
3. **ICP Signal Extraction** – Analyse education, work experience, and thinking quality from lead profiles using configurable rules and optional AI classification.
4. **Final Scoring & Bucketing** – Weighted combination of education, experience, thinking quality, and a recency bonus; assignment to HIGH/MEDIUM/LOW/NOT FIT buckets with priority levels and expected conversion rates.
5. **Record Identification** – Automatic assignment of unique record IDs derived from input filename and index, or preservation of explicit `_recordId` fields.
6. **Result Persistence** – Write per‑lead JSON, batch summary JSON, and CSV file; all results are immediately available for download.
7. **Configuration Management** – Central configuration object (weights, tier lists, bucket thresholds, processing delays, etc.) editable via a web interface.
8. **AI Integration (Optional)** – Use LLM for university/company tier classification, score explanation narrative generation, outreach email drafting, and fake profile generation in demo mode. Falls back to deterministic rules when AI is unavailable.
9. **Persona Management & Matching** – Define target personas (e.g., “Ideal CTO”) with custom criteria; score leads against the active persona alongside the default ICP.
10. **Outreach Email Generator** – Produce a tailored email draft for each lead based on their score bucket, profile, and persona fit.
11. **Self‑Demo Mode** – CLI command that generates a configurable number of synthetic leads (or uses a pre‑packed fallback set) and runs the full scoring pipeline, displaying results and examples.
12. **Multi‑User Isolation** – Session‑based file partitioning so each browser session sees only its own uploaded files and results; persona selection and email settings are per‑session.
13. **Logging** – Timestamped log output to console and rotating log files with configurable log level.

### 2.3 User Classes and Characteristics

| User Class                      | Description                                                                                                                | Primary Interface                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Sales Analyst / RevOps**      | Non‑technical user who manually curates leads from RocketReach and wants to score and prioritise them. Uses web UI mostly. | Web UI (upload, history, persona selection)      |
| **Power User / Developer**      | Technical user who runs batch jobs, customises configuration, integrates with other tools.                                 | CLI (`npm start`, `npm run demo`), Config Editor |
| **Portfolio Reviewer / Client** | Person evaluating the system’s capabilities via a demo.                                                                    | Self‑Demo Mode (`npm run demo`)                  |
| **System Administrator**        | Person deploying the tool for a team, configuring environment variables, managing server restarts.                         | Environment variables, server startup            |

All users are assumed to have basic familiarity with JSON files and web browsers. No programming knowledge is required for the web UI.

### 2.4 Operating Environment

- **Runtime:** Node.js ≥ 18.x (CommonJS module system).
- **Operating System:** Any platform supporting Node.js (Linux, macOS, Windows). Path separators must be handled portably.
- **Network:** Web server listens on a configurable port (default 3000). Outbound HTTPS connections required only if AI features are enabled.
- **Storage:** Read/write access to the directories `input/`, `output/`, `logs/`, `personas/`, `data/`, and session‑scoped directories under `data/sessions/`.
- **Browser Support:** Modern browsers (Chrome, Firefox, Edge, Safari) for the web UI. JavaScript must be enabled for polling and dynamic interactions.

### 2.5 Design and Implementation Constraints

- The application **shall** be written in plain JavaScript using Node.js CommonJS modules (no transpilation, no TypeScript).
- The web framework **shall** be Express.js; server‑side templating **shall** be EJS.
- File uploads **shall** be handled by Multer.
- Session management **shall** use `express-session` with an in‑memory store by default; a file‑based session store may be added for persistence across restarts.
- No database **shall** be used; persistence is achieved through flat JSON and CSV files.
- The LLM client **shall** support both Google Gemini and OpenAI APIs, selected via the `AI_PROVIDER` environment variable. Without a valid API key, all AI features **shall** degrade gracefully.
- Configuration **shall** be stored in a single `src/config/config.js` file; overrides may be applied via environment variables or the web config editor.
- All generated output **shall** be stored in directories that are clearly separated from the application source code and `.gitignore`d where appropriate (except sample data).
- The system **shall** be installable and runnable with `npm install && npm start` (CLI) and `npm install && node server.js` (web). The demo **shall** be runnable with `npm run demo`.

### 2.6 User Documentation

The repository **shall** include a `README.md` that:

- Explains the problem and what the system does.
- Contains a quickstart guide (install, configure, run CLI, run web, run demo).
- Describes the input format with examples.
- Documents all configuration options and environment variables.
- Includes a screenshot/GIF of the demo output.
- Provides a link to a 2‑minute Loom video walkthrough (placeholder until video is recorded).

Additional `developer.md` documentation **may** be provided for contributor onboarding, but is not a requirement for the first public version.

### 2.7 Assumptions and Dependencies

- **Assumption 1:** Lead data is manually compiled into JSON files using tools like RocketReach’s free profile search; the system does not fetch data from any external source.
- **Assumption 2:** A valid Perplexity/Gemini/OpenAI API key is provided only if AI features are desired. The system functions fully without one.
- **Assumption 3:** The server is accessed by a small number of concurrent users (≤ 10) – no horizontal scaling or advanced concurrency is required.
- **Assumption 4:** Input JSON files are well‑formed and conform to the expected schema (though validation catches malformed ones).
- **Dependency:** The system depends on specific npm packages listed in `package.json`; these shall be installed via `npm install` with a correctly configured `package.json` that matches the `package-lock.json`.

---

## 3. System Features (Detailed Requirements)

### 3.1 Feature: Core Batch Scoring Pipeline

**Feature ID:** F‑01  
**Priority:** Critical  
**Description:** The system shall read all JSON files from the `input/` directory, process each profile through the ICP scoring pipeline, and generate output files.

#### Functional Requirements

| ID        | Requirement                                                                                                                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01-001 | The CLI entry point (`index.js`) shall load environment variables from `.env` using `dotenv` on startup.                                                                                                                                                         |
| FR-01-002 | The system shall ensure the directories `input/`, `output/`, and `logs/` exist; if missing, they shall be created automatically.                                                                                                                                 |
| FR-01-003 | All `.json` files in the `input/` directory shall be read. Non‑JSON files shall be ignored.                                                                                                                                                                      |
| FR-01-004 | Each input file may contain either a single profile object or an array of profile objects. The system shall detect and handle both cases.                                                                                                                        |
| FR-01-005 | For each profile, a unique `_recordId` shall be assigned: if the profile already contains an `_recordId` field, it shall be preserved; otherwise, the system shall generate one using the filename stem and, for arrays, the array index (e.g., `"filename_0"`). |
| FR-01-006 | The system shall process profiles sequentially. If an LLM client is active and the config specifies a batch delay, a pause of that duration shall be inserted between profiles to respect rate limits.                                                           |
| FR-01-007 | Each profile shall be passed to the ICPProfiler orchestrator, which executes the Data Quality → Education → Experience → Thinking Quality → Scorer pipeline.                                                                                                     |
| FR-01-008 | If the Data Quality module rejects a profile (`shouldProcess === false`), the profile shall be recorded as rejected with the reason; no further scoring steps shall be attempted.                                                                                |
| FR-01-009 | After processing all profiles, a batch summary JSON file and a CSV export shall be written to the output directory.                                                                                                                                              |
| FR-01-010 | A ranked report (top 10 leads by ICP score) shall be printed to the console.                                                                                                                                                                                     |

#### Data Flow

```
input/*.json → FileHandler.readInputFiles() → array of profiles →
for each profile: ICPProfiler.profile() → result object →
FileHandler.writeProfileResult(), FileHandler.writeSummary(), FileHandler.writeCSV()
```

#### Dependencies

- Modules: `FileHandler`, `ICPProfiler`, `Logger`, `Config`, `LLMClient` (optional)
- Config settings: `paths.inputDir`, `paths.outputDir`, `processing.batchDelay`

---

### 3.2 Feature: Data Quality Validation

**Feature ID:** F‑02  
**Priority:** Critical  
**Description:** The system shall validate each input profile for completeness and reject profiles with insufficient data.

#### Requirements

| ID        | Requirement                                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-02-001 | The Data Quality module shall check for the presence of `name` (non‑empty string), `education` (array with ≥1 entry), and `jobs` (array with ≥1 entry).                                      |
| FR-02-002 | A completeness score (0–100) shall be calculated: base 100, subtract 30 for each missing required field, minimum 0.                                                                          |
| FR-02-003 | An additional completeness percentage shall be computed as `(number of non‑empty top‑level fields) / 5`, where the five fields are `name`, `education`, `jobs`, `skills`, `company_details`. |
| FR-02-004 | If the completeness score is ≥ 40, `shouldProcess` shall be `true`; otherwise `false`.                                                                                                       |
| FR-02-005 | A `missingFields` array shall list the names of missing required fields.                                                                                                                     |

#### Output

```json
{
  "score": 70,
  "completeness": 0.8,
  "shouldProcess": true,
  "missingFields": ["skills"]
}
```

---

### 3.3 Feature: Education Signal Extraction

**Feature ID:** F‑03  
**Priority:** Critical  
**Description:** The system shall parse the highest education entry, extract the university name, classify its tier, and compute an education sub‑score.

#### Requirements

| ID        | Requirement                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-03-001 | The first string in the `education` array shall be treated as the highest degree.                                                                                                                |
| FR-03-002 | The university name shall be extracted using a regex that captures text after “@” or before the first comma; if neither pattern matches, the entire string shall be used as the university name. |
| FR-03-003 | If an LLM client is available and AI is not disabled, the system shall call `LLMClient.classifyUniversity(universityName)` to obtain a tier (`tier_1`, `tier_2`, `tier_3`, or `unknown`).        |
| FR-03-004 | If LLM is unavailable, the system shall perform a case‑insensitive exact match against the configured `tiers.universities` lists. Unmatched universities shall be assigned `tier_3`.             |
| FR-03-005 | The education sub‑score shall be mapped as: `tier_1` = 100, `tier_2` = 70, `tier_3` = 40, `unknown` = 20.                                                                                        |

#### AI Prompts (Example)

- System: “Classify the prestige tier of the following university. Reply ONLY with ‘tier_1’, ‘tier_2’, ‘tier_3’, or ‘unknown’.”
- User: university name string.

---

### 3.4 Feature: Experience Signal Extraction

**Feature ID:** F‑04  
**Priority:** Critical  
**Description:** The system shall extract company names from the `jobs` array, classify each company’s tier, and compute an experience sub‑score.

#### Requirements

| ID        | Requirement                                                                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-04-001 | Each entry in `jobs` shall be parsed to extract the company name. The system shall assume the format “Role @ Company” and take the portion after “@”; if “@” is absent, the entire string shall be used. |
| FR-04-002 | If AI is available, each company name shall be sent to `LLMClient.classifyCompany(name)`; otherwise, the configured `tiers.companies` lists shall be used.                                               |
| FR-04-003 | The system shall count distinct `tier_1` and `tier_2` companies (case‑insensitive).                                                                                                                      |
| FR-04-004 | The experience score shall be calculated as: `baseScore = 60 + (10 * tier1Count) + (5 * tier2Count)`. The score shall be capped at 100. If `tier1Count ≥ 3`, score shall be set to 100.                  |
| FR-04-005 | The output shall include an array of company objects `{ name, tier }`, the counts, and the final score.                                                                                                  |

---

### 3.5 Feature: Thinking Quality Analysis

**Feature ID:** F‑05  
**Priority:** Critical  
**Description:** The system shall analyse the profile’s skills and job titles for visionary and leadership keywords, producing a thinking quality sub‑score.

#### Requirements

| ID        | Requirement                                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-05-001 | A configurable list of visionary keywords shall be defined (e.g., “innovation”, “strategy”, “thought leader”, “AI”, “machine learning”, “data‑driven”, “scalable”).              |
| FR-05-002 | The system shall search the `skills` array and the `jobs` strings for these keywords (case‑insensitive substring match). Each distinct match shall add 10 points, capped at 100. |
| FR-05-003 | If any job title contains “Chief”, “VP”, or “Head”, a leadership bonus of 10 points shall be added once (total still capped at 100).                                             |
| FR-05-004 | The module shall return `{ visionaryScore, leadershipBonus, score }`.                                                                                                            |

---

### 3.6 Feature: Scorer & Recency Bonus

**Feature ID:** F‑06  
**Priority:** Critical  
**Description:** The system shall compute the final ICP score from component sub‑scores, apply a recency bonus, and assign a bucket and priority.

#### Requirements

| ID        | Requirement                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-06-001 | The weighted ICP score shall be calculated as: `weighted = educationScore * 0.20 + experienceScore * 0.35 + thinkingScore * 0.40`. Weights shall be configurable.         |
| FR-06-002 | If the profile contains a `lastActive` field whose value is a date within the last 6 months, a recency bonus of 5 points shall be added.                                  |
| FR-06-003 | The final score shall be rounded to one decimal place.                                                                                                                    |
| FR-06-004 | The bucket shall be determined by iterating over the configured `buckets` array and finding the first range where `finalScore` falls between `min` and `max` (inclusive). |
| FR-06-005 | The assigned bucket, priority, and expected conversion rate shall be included in the result.                                                                              |

---

### 3.7 Feature: File Output & Export

**Feature ID:** F‑07  
**Priority:** Critical  
**Description:** The system shall persist individual results, a batch summary, and a CSV export.

#### Requirements

| ID        | Requirement                                                                                                                                                                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-07-001 | For each processed profile, a file named `{recordId}_result.json` shall be written to the output directory containing the full result object.                                                                                                                                     |
| FR-07-002 | A batch summary file named `batch_summary_{timestamp}.json` shall contain: total profiles, processed count, rejected count, error count, bucket distribution, average score, and an array of all result objects.                                                                  |
| FR-07-003 | A CSV file named `icp_scores_{timestamp}.csv` shall be created with columns: Record ID, Name, ICP Score, Bucket, Priority, Expected Conversion, Education Score, Experience Score, Thinking Score, and (if applicable) Explanation, Persona Fit Score, Email Subject, Email Body. |
| FR-07-004 | File paths shall be sanitised to prevent path traversal.                                                                                                                                                                                                                          |

---

### 3.8 Feature: Record ID Management

**Feature ID:** F‑08  
**Priority:** Critical  
**Description:** Unique identifiers shall be assigned to every lead to enable tracking and retrieval.

#### Requirements

| ID        | Requirement                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| FR-08-001 | If the input profile contains a top‑level `_recordId` field, it shall be used as‑is.                               |
| FR-08-002 | For a file containing a single object, the record ID shall be the filename without extension (e.g., `"john_doe"`). |
| FR-08-003 | For a file containing an array, the record ID for the i‑th element shall be `"{filenameStem}_{i}"`.                |
| FR-08-004 | Record IDs shall be persisted in the output JSON and used in all per‑lead file naming.                             |

---

### 3.9 Feature: Logging

**Feature ID:** F‑09  
**Priority:** High  
**Description:** The system shall log operations to console and a timestamped log file.

#### Requirements

| ID        | Requirement                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| FR-09-001 | The Logger module shall accept a `logDir` and a `level` parameter.                                                             |
| FR-09-002 | Log levels shall be: `debug`, `info`, `warn`, `error`. The logger shall only output messages at or above the configured level. |
| FR-09-003 | Each log entry shall include a timestamp, level, and message.                                                                  |
| FR-09-004 | Log files shall be named `icp-profiler-{YYYY-MM-DD}.log` and stored in the configured `logDir`.                                |

---

### 3.10 Feature: Web Upload & Processing Queue

**Feature ID:** F‑10  
**Priority:** High  
**Description:** The web application shall allow users to upload JSON lead files, place them in an in‑memory processing queue, and display live progress.

#### Requirements

| ID        | Requirement                                                                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-10-001 | The server shall provide a `POST /api/upload` endpoint that accepts multipart file uploads with content type `application/json`.                                                                               |
| FR-10-002 | Uploaded files shall be saved to the session‑scoped input directory (see F‑17 for multi‑user isolation).                                                                                                       |
| FR-10-003 | Each upload shall create a job object with a unique ID, file path, progress percentage, log array, and the active persona ID from the session.                                                                 |
| FR-10-004 | The job shall be pushed to an in‑memory queue (`processingQueue.items`).                                                                                                                                       |
| FR-10-005 | The server shall process jobs sequentially: when `processing` flag is false and the queue is not empty, the next job shall be popped and processed.                                                            |
| FR-10-006 | While processing, the job’s `progress` shall be updated at each pipeline stage (0%, 20% after data quality, 40% after education, 60% after experience, 80% after thinking, 100% after scoring and file write). |
| FR-10-007 | A `GET /api/job/:jobId` endpoint shall return the current job status (progress, logs, results).                                                                                                                |
| FR-10-008 | A `GET /api/queue` endpoint shall return the list of pending and processing jobs.                                                                                                                              |
| FR-10-009 | The web UI shall poll the job status every 2 seconds while a job is processing, displaying progress and log messages.                                                                                          |

---

## 3. System Features (Detailed Requirements) — continued

### 3.11 Feature: Configuration Management (Web Editor)

**Feature ID:** F‑11  
**Priority:** High  
**Description:** The web application shall provide a page that allows users to view and edit the runtime scoring configuration without restarting the server. Changes are applied immediately to all subsequent processing but reset on server restart (a future version may persist overrides).

#### Functional Requirements

| ID        | Requirement                                                                                                                                                                                                                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-11-001 | The server shall serve a `GET /config` route that renders an EJS page containing a `<textarea>` pre‑filled with the current configuration object as pretty‑printed JSON.                                                                                                                           |
| FR-11-002 | The page shall include a “Save” button that sends a `POST /api/config` request with the edited JSON.                                                                                                                                                                                               |
| FR-11-003 | The `POST /api/config` endpoint shall validate that the posted body is a valid JSON object and contains the mandatory top‑level keys: `scoring`, `buckets`, `processing`, `paths`, `llm` (exact keys may be refined). If validation fails, it shall return a 400 error with a descriptive message. |
| FR-11-004 | If validation passes, the server shall update the in‑memory config object used by all modules; subsequent scoring operations shall use the new values immediately.                                                                                                                                 |
| FR-11-005 | The page shall include a “Reset to Defaults” button that sends a `POST /api/config/reset` request, restoring the original configuration shipped with the application.                                                                                                                              |
| FR-11-006 | The config editor page shall be accessible from the navigation bar and shall be styled consistently with the rest of the UI.                                                                                                                                                                       |

#### Dependencies

- Express routes, EJS view `config-editor.ejs` (new), server‑side config mutability.
- The original `src/config/config.js` exports the default object; the server shall maintain a mutable copy.

---

### 3.12 Feature: Persona Management & Persona‑Based Matching

**Feature ID:** F‑12  
**Priority:** High  
**Description:** The system shall allow users to define target “personas” — ideal candidate profiles with custom criteria — and score leads against the selected persona in addition to the default ICP. Persona files are stored as JSON files in a `personas/` directory and are manageable through a dedicated web interface. The active persona is stored in the session and persists across page reloads.

#### Functional Requirements

| ID                             | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persona File Format**        |
| FR-12-001                      | Each persona shall be a JSON file in `personas/` with the following structure: `{ "name": string, "description": string, "weights"?: { education: number, experience: number, thinking: number }, "education": { "preferred_tiers": string[] }, "experience": { "roles_must_include": string[], "preferred_companies_tiers": string[], "min_years_experience"?: number }, "skills_must_have": string[] }`. All fields except `name` and `description` are optional; missing fields are ignored during matching. |
| FR-12-002                      | A default persona file named `default-icp.json` shall be packaged with the system, representing the standard ICP weights and broad criteria (matching the default scoring model).                                                                                                                                                                                                                                                                                                                               |
| **Persona Management Page**    |
| FR-12-003                      | A web page at `GET /personas` shall render a table listing all persona files in `personas/`, showing their name, description, and last‑modified date.                                                                                                                                                                                                                                                                                                                                                           |
| FR-12-004                      | The page shall provide an “Upload Persona” form (file upload) that accepts a JSON file, validates its structure, and saves it to the `personas/` directory.                                                                                                                                                                                                                                                                                                                                                     |
| FR-12-005                      | Each persona row shall have “Edit” and “Delete” actions.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| FR-12-006                      | Editing a persona shall navigate to `/personas/:id/edit`, a page containing a `<textarea>` pre‑filled with the persona JSON; a “Save” button sends `PUT /api/persona/:id` to replace the file.                                                                                                                                                                                                                                                                                                                  |
| FR-12-007                      | Deleting a persona shall send `DELETE /api/persona/:id`, which moves the file to `personas/.trash/` or simply deletes it after confirmation.                                                                                                                                                                                                                                                                                                                                                                    |
| FR-12-008                      | The page shall allow a persona to be set as “active” via a button that calls `POST /api/set-persona` with `{ personaId: "xyz" }`.                                                                                                                                                                                                                                                                                                                                                                               |
| **Active Persona Integration** |
| FR-12-009                      | The home/upload page (`GET /`) shall include a dropdown populated with the names and IDs of all personas from the `personas/` directory. The dropdown shall default to the value stored in `req.session.selectedPersona` (or “default-icp” if none set).                                                                                                                                                                                                                                                        |
| FR-12-010                      | Changing the dropdown shall fire an AJAX call to `POST /api/set-persona` to update the session.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| FR-12-011                      | When a file is uploaded, the persona ID from the session shall be attached to the processing job. The pipeline shall load the corresponding persona file and compute a persona fit score for each lead.                                                                                                                                                                                                                                                                                                         |
| FR-12-012                      | If the session’s selected persona is `null` or `"default-icp"`, only the default ICP scoring shall be performed; no persona fit key shall appear in results.                                                                                                                                                                                                                                                                                                                                                    |
| **Persona Matching Algorithm** |
| FR-12-013                      | The `PersonaMatcher` module shall receive the extracted signals (education tier, company tiers, job roles, skills, years of experience) and the persona object.                                                                                                                                                                                                                                                                                                                                                 |
| FR-12-014                      | **Education match:** If the lead’s education tier is in `preferred_tiers`, score = 100; if in the next tier below (according to tier ordering `tier_1 > tier_2 > tier_3`), score = 60; else 30. If no preference, score = 100.                                                                                                                                                                                                                                                                                  |
| FR-12-015                      | **Experience – role match:** For each required role in `roles_must_include`, perform a case‑insensitive fuzzy substring match against each job title in the lead’s `jobs[]`. The percentage of required roles found is calculated; score = percentage × 100.                                                                                                                                                                                                                                                    |
| FR-12-016                      | **Experience – company match:** The score is the ratio of the lead’s `tier_1` and `tier_2` companies to total distinct companies, weighted higher for higher tiers (tier_1 count × 1.0 + tier_2 count × 0.5) / (total companies × 1.0). If no companies, score = 0.                                                                                                                                                                                                                                             |
| FR-12-017                      | **Experience – years:** If `min_years_experience` is set and the lead has a `years_experience` field (or it can be derived from earliest job), score = min(100, (years / min_years) \* 100). If field absent, score = 50.                                                                                                                                                                                                                                                                                       |
| FR-12-018                      | The three experience sub‑scores shall be combined using weights specified in the persona’s `experience` sub‑object (default: roles 0.4, companies 0.4, years 0.2).                                                                                                                                                                                                                                                                                                                                              |
| FR-12-019                      | **Skills match:** Percentage of `skills_must_have` present in the lead’s `skills` array (case‑insensitive exact match or substring if keyword contains multiple words); score = percentage × 100.                                                                                                                                                                                                                                                                                                               |
| FR-12-020                      | The final persona fit score is a weighted average of education, experience, and skills scores using the persona’s `weights` (if provided) or the default ICP weights. Result is rounded to one decimal.                                                                                                                                                                                                                                                                                                         |
| FR-12-021                      | Bucket assignment for persona fit: ≥90 “Excellent Fit”, ≥75 “Good Fit”, ≥50 “Partial Fit”, otherwise “Not a Fit”. (Configurable).                                                                                                                                                                                                                                                                                                                                                                               |
| FR-12-022                      | A `gap_analysis` array shall list: each missing required skill, each missing required role (by name), and a note if education tier or company tier is below preference.                                                                                                                                                                                                                                                                                                                                         |
| FR-12-023                      | The persona fit result object `{ persona_name, fit_score, bucket, gap_analysis }` shall be attached to the per‑lead result JSON under the key `persona_fit`.                                                                                                                                                                                                                                                                                                                                                    |

#### Dependencies

- `PersonaMatcher` module, `PersonaManager` utility, `personas/` directory.
- Express routes: `/personas`, `/api/personas`, `/api/set-persona`, `/api/current-persona`, `/api/upload-persona`, `/api/persona/:id`, `PUT /api/persona/:id`, `DELETE /api/persona/:id`.
- `express-session` for storing `selectedPersona`.

---

### 3.13 Feature: AI Score Explanation Generation

**Feature ID:** F‑13  
**Priority:** Medium  
**Description:** If an LLM provider is configured, the system shall produce a short, human‑readable paragraph explaining why the lead received its ICP score, referencing the lead’s education, companies, skills, and component scores.

#### Functional Requirements

| ID        | Requirement                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-13-001 | The feature shall be toggled via a config flag `enableScoreExplanation` (default `true` when an LLM is available).                                                                                                                                           |
| FR-13-002 | Inside the `ProfilerModule` (or via a post‑processing step), after the final ICP score is computed, if the flag is on and `llmClient` is not null, a method `generateExplanation(profile, scores)` shall be called.                                          |
| FR-13-003 | The explanation prompt shall include: profile name, education entries, top companies, skills, component scores, final score, bucket, and priority. The prompt shall instruct the LLM to produce a 2‑4 sentence explanation in a friendly, professional tone. |
| FR-13-004 | The LLM response shall be parsed and stored as a string in `result.explanation`. If the LLM call fails or returns an invalid response, the explanation shall be `"Unable to generate explanation."`.                                                         |
| FR-13-005 | When the LLM is not available, the field shall be set to `null`; the UI shall display “AI explanation not available.”                                                                                                                                        |
| FR-13-006 | The explanation text shall be included in the per‑lead result JSON and displayed in the history detail view.                                                                                                                                                 |

#### Dependencies

- `LLMClient` module, config flag.
- No new endpoints needed; generated during processing.

---

### 3.14 Feature: Outreach Email Generator

**Feature ID:** F‑14  
**Priority:** Medium  
**Description:** The system shall optionally generate a personalised outreach email draft for each lead that passes the data quality gate. The email tone and content shall adapt based on the lead’s bucket, and the sender’s identity shall be configurable.

#### Functional Requirements

| ID        | Requirement                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-14-001 | The feature shall be toggled via a config flag `enableEmailGeneration` (default `true` when LLM available).                                                                                                                                                  |
| FR-14-002 | A new module `OutreachEmailModule` shall encapsulate the generation logic.                                                                                                                                                                                   |
| FR-14-003 | The module shall receive the profile, the ICP score object, the persona fit object (if present), and an `emailSettings` object containing `{ senderName, company, tone }`.                                                                                   |
| FR-14-004 | The prompt shall include the lead’s name, highest education, current company/role, top skills, ICP score and bucket, persona fit (if available), and the desired tone.                                                                                       |
| FR-14-005 | Tone mapping: HIGH bucket → “warm and direct, suggest a specific call/meeting”; MEDIUM → “nurturing, mention potential synergy, ask for advice”; LOW → “light touch, share something valuable, no hard ask”; NOT FIT → no email generated.                   |
| FR-14-006 | The LLM shall be asked to return a JSON object with `subject` and `body` fields.                                                                                                                                                                             |
| FR-14-007 | The module shall parse the response and return `{ subject, body }` or null on failure.                                                                                                                                                                       |
| FR-14-008 | The result shall be stored in the per‑lead result JSON under `outreach_email`.                                                                                                                                                                               |
| FR-14-009 | **Email Settings:** The server shall provide `GET /email-settings` (renders a page/form) and `POST /api/email-settings` (stores `{ senderName, company, tone }` in `req.session.emailSettings`).                                                             |
| FR-14-010 | If email settings are not set, the system shall use fallback values: senderName = “Your Name”, company = “Your Company”, tone = “professional”. A banner on the history page shall remind the user to configure them.                                        |
| FR-14-011 | **History UI:** On the history page, each scored lead shall have an “📧 Email” button. Clicking it shall expand a section showing the subject and body with a “Copy to clipboard” button.                                                                    |
| FR-14-012 | A “Regenerate Email” button next to the email shall call `GET /api/regenerate-email/:recordId?tone=casual` which re‑runs the generation with a slightly varied prompt (e.g., different tone or angle) and returns the new draft without re‑scoring the lead. |
| FR-14-013 | The history page shall provide a “Export All Emails as TXT” button that calls `GET /api/export-emails` and downloads a concatenated text file of all available email drafts.                                                                                 |

#### Dependencies

- `OutreachEmailModule`, `LLMClient`, `express-session` for email settings.
- New routes: `/email-settings`, `/api/email-settings`, `/api/regenerate-email/:recordId`, `/api/export-emails`.
- Multer and file handling for reading result files.

---

### 3.15 Feature: Self‑Demo Mode

**Feature ID:** F‑15  
**Priority:** High (for portfolio presentation)  
**Description:** The system shall provide a CLI command (`npm run demo`) that generates or loads synthetic leads and runs the full processing pipeline, producing a visually rich console output and all result files. The demo shall work with zero manual configuration and shall showcase all major features.

#### Functional Requirements

| ID        | Requirement                                                                                                                                                                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-15-001 | A new file `demo.js` shall be the entry point for the demo, executable via `node demo.js` or the npm script `"demo": "node demo.js"`.                                                                                                                                                                                                                   |
| FR-15-002 | The script shall parse command‑line arguments: `--count <number>` (default 15), `--persona <personaId>` (none by default), `--no-ai` (flag), `--output <dir>` (default `./demo-output`), `--quiet` (flag).                                                                                                                                              |
| FR-15-003 | **Lead generation:** If the `--no-ai` flag is not set and an LLM client is successfully initialised, the script shall call `LLMClient` to generate `--count` diverse synthetic profiles in valid JSON array format. The prompt shall request profiles with varying backgrounds (tier‑1 to tier‑3 education, different company tiers, different skills). |
| FR-15-004 | If `--persona` is specified and AI generation is active, the prompt shall ask for roughly half the profiles to be strong matches for the described persona and half to be weaker matches, ensuring a meaningful persona fit display.                                                                                                                    |
| FR-15-005 | If `--no-ai` is set or LLM initialisation fails, the script shall fall back to copying the file `data/demo-fallback.json` (a pre‑packed set of 15+ profiles) into a temporary input directory.                                                                                                                                                          |
| FR-15-006 | The generated or fallback profiles shall be written as a single JSON file in a temporary `demo-input/` directory inside the output path (or a clean `./input` for the demo, isolated from real data).                                                                                                                                                   |
| FR-15-007 | **Processing:** The script shall import `runBatch()` from `index.js` and invoke it with the temporary input directory, the specified output directory, and options reflecting the flags: `llmClient` (null if `--no-ai`), `personaId` (if provided), `enableEmail` (true if AI available and not `--no-ai`), `enableExplanation` (same condition).      |
| FR-15-008 | After processing, the script shall print a colourful summary to the console using `chalk` or similar: total leads, bucket distribution, average ICP score, and if persona was active, the top 3 persona matches with fit scores and gaps.                                                                                                               |
| FR-15-009 | If email generation was enabled, the script shall print a sample email for the highest‑scored lead.                                                                                                                                                                                                                                                     |
| FR-15-010 | The script shall output the location of the generated result files and CSV.                                                                                                                                                                                                                                                                             |
| FR-15-011 | The demo shall be entirely self‑contained and not interfere with the web server’s session‑scoped directories.                                                                                                                                                                                                                                           |

#### Dependencies

- `demo.js`, `data/demo-fallback.json`, `chalk` (optional, add to `package.json`), shared `runBatch()` from `index.js`.
- `LLMClient` if AI used.

---

### 3.16 Feature: Multi‑User Session Isolation

**Feature ID:** F‑16  
**Priority:** High (for multi‑user deployment)  
**Description:** The web application shall ensure that data (uploads, results, configurations) of different browser sessions are kept separate through file‑system partitioning based on session ID. Users will only see their own leads and settings.

#### Functional Requirements

| ID        | Requirement                                                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-16-001 | The server shall use `express-session` with a unique session ID per browser (stored in a cookie).                                                                                                                                    |
| FR-16-002 | A middleware or utility function shall resolve the session‑scoped base directory: `data/sessions/{sessionID}`.                                                                                                                       |
| FR-16-003 | When a session is first used for an operation that requires file storage (upload, processing), the system shall create the directories `data/sessions/{sessionID}/input` and `data/sessions/{sessionID}/output` if they don’t exist. |
| FR-16-004 | The `FileHandler` instantiated for web jobs shall receive the session‑specific directories, not the global `input/` and `output/`.                                                                                                   |
| FR-16-005 | The `POST /api/upload` handler shall save uploaded files to the session’s `input` directory.                                                                                                                                         |
| FR-16-006 | The `/history` route shall read result files only from the session’s `output` directory.                                                                                                                                             |
| FR-16-007 | The `/api/download/:recordId` route shall resolve the file path within the session’s `output` directory and prevent access to files outside it.                                                                                      |
| FR-16-008 | Persona selection and email settings, stored on `req.session`, shall naturally be per‑session.                                                                                                                                       |
| FR-16-009 | The system shall not provide a UI for cross‑session data sharing; each session is an isolated silo.                                                                                                                                  |
| FR-16-010 | A “Clear My Data” button on the history page may be provided, which deletes the session’s `input` and `output` folders and resets the session.                                                                                       |

#### Dependencies

- `express-session`, session‑scoped `FileHandler` initialisation.
- Changes to `server.js` to pass dynamic paths.

---

### 3.17 Feature: Web History & Detail View

**Feature ID:** F‑17  
**Priority:** High  
**Description:** The web application shall provide a page that lists all leads processed in the current session, with options to view individual results, download JSON, view generated emails, and export all emails.

#### Functional Requirements

| ID        | Requirement                                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-17-001 | `GET /history` shall read all `*_result.json` files from the session’s output directory and render them in an HTML table.                                                               |
| FR-17-002 | The table shall include columns: Record ID, Name, ICP Score, Bucket, Persona Fit Score (if available), and Action buttons.                                                              |
| FR-17-003 | Clicking a lead’s name or a “Details” button shall expand a row or open a modal showing: all component scores, signals, explanation (if present), and persona fit details (if present). |
| FR-17-004 | If an outreach email exists, an “Email” button shall expand the email content with a copy‑to‑clipboard button, as specified in F‑14.                                                    |
| FR-17-005 | A “Download” button shall link to `/api/download/:recordId` to download the full result JSON.                                                                                           |
| FR-17-006 | A “Export All Emails as TXT” button (if any emails exist) shall link to `/api/export-emails` for bulk download.                                                                         |
| FR-17-007 | The page shall display a summary at the top: total leads processed, counts per bucket, average score.                                                                                   |
| FR-17-008 | Data shall be fetched server‑side on each request; no client‑side caching beyond the browser’s normal behaviour.                                                                        |

#### Dependencies

- `GET /history` route, EJS view `history.ejs`, `FileHandler` for reading results.

---

## 4. Non‑Functional Requirements

### 4.1 Security

| ID     | Requirement                                                                                                                                                                                                                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | **Secrets management:** All API keys, tokens, and the session secret shall be provided via environment variables (e.g., `GEMINI_API_KEY`, `OPENAI_API_KEY`, `SESSION_SECRET`). No hardcoded secrets shall exist in the codebase.                                                                                       |
| SEC-02 | **Environment file:** `.env` shall be listed in `.gitignore`. A `.env.example` shall be provided with placeholder values.                                                                                                                                                                                              |
| SEC-03 | **Session secret:** If `SESSION_SECRET` is not set, the server shall either refuse to start or use a randomly generated warning (documented). In production, a strong secret must be set.                                                                                                                              |
| SEC-04 | **File upload validation:** The upload endpoint shall validate that the uploaded file has MIME type `application/json` (or `.json` extension) and a reasonable file size limit (e.g., 5 MB). Further JSON parsing shall catch malformed files.                                                                         |
| SEC-05 | **Path traversal prevention:** All file read/write operations using user‑supplied identifiers (e.g., `recordId` in download) shall sanitise the input with `path.basename()` to strip directory components.                                                                                                            |
| SEC-06 | **Cross‑session isolation:** The server shall not serve files from a session other than the one identified by the cookie. The `/api/download/:recordId` route shall ensure the file is within the session’s output directory (e.g., by using `path.join(sessionOutputDir, path.basename(recordId + '_result.json'))`). |
| SEC-07 | **Logging privacy:** Logs shall not contain API keys, full profile JSON, or email contents. Only record IDs, scores, and status messages shall be logged.                                                                                                                                                              |
| SEC-08 | **HTTP headers:** The server shall set basic security headers (e.g., `X-Content-Type-Options: nosniff`) via a middleware like `helmet` (optional but recommended).                                                                                                                                                     |

### 4.2 Performance

| ID      | Requirement                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PERF-01 | The processing of a single profile with AI (two LLM calls) shall complete in under 10 seconds on a typical internet connection.                            |
| PERF-02 | The batch CLI shall process 100 profiles (with the configurable 2‑second delay) in under 15 minutes.                                                       |
| PERF-03 | The `/history` page shall load within 2 seconds for up to 200 result files.                                                                                |
| PERF-04 | The in‑memory queue shall not exceed 50 pending jobs; the UI shall indicate queue fullness.                                                                |
| PERF-05 | The web UI shall poll job status at a default interval of 2 seconds; this interval shall be configurable via config.                                       |
| PERF-06 | Synchronous file reads on `/history` are acceptable for the expected scale; if performance degrades, a future enhancement may add caching or lazy loading. |

### 4.3 Maintainability & Code Quality

| ID      | Requirement                                                                                                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAIN-01 | The codebase shall follow a modular architecture: each scoring concern (Data Quality, Education, Experience, Thinking Quality, Scorer, Persona Matcher) shall be a separate class with a single responsibility and clear interface. |
| MAIN-02 | All modules shall accept dependencies via constructor injection (config, logger, optional LLM client).                                                                                                                              |
| MAIN-03 | The batch processing logic shall be refactored into a reusable `runBatch()` function exported by `index.js`, used by both the CLI and `demo.js`.                                                                                    |
| MAIN-04 | Error handling shall use `async/await` with `try/catch`; cross‑module communication shall prefer result objects `{ success, data, error }` rather than throwing exceptions across boundaries.                                       |
| MAIN-05 | All file paths shall be constructed using `path.join()` for cross‑platform compatibility.                                                                                                                                           |
| MAIN-06 | The codebase shall be well‑commented, and the README shall serve as the primary user documentation.                                                                                                                                 |

### 4.4 Usability

| ID     | Requirement                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| USA-01 | The web UI shall use a responsive, minimal design powered by Tailwind CSS, with a consistent accent colour `#0029ff` for interactive elements. |
| USA-02 | All forms and buttons shall provide clear labels and feedback (loading spinners, success/error messages).                                      |
| USA-03 | The upload dropzone shall visually indicate when a file is dragged over it.                                                                    |
| USA-04 | The demo mode shall produce a colourful, well‑structured console output that is self‑explanatory.                                              |
| USA-05 | Error messages returned by the API shall be in plain English and displayed to the user (e.g., via toast notifications or inline messages).     |

### 4.5 Portability & Environment

| ID      | Requirement                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------- |
| PORT-01 | The application shall run on Node.js 18.x and later.                                            |
| PORT-02 | It shall be deployable on any Unix‑like system (Linux, macOS) and Windows without code changes. |
| PORT-03 | The server port shall be configurable via the `PORT` environment variable (default 3000).       |
| PORT-04 | The application shall not require root/administrator privileges.                                |

---

## 5. Appendix

### 5.1 Glossary

- **ICP** – Ideal Customer Profile; a composite score and bucket representing how well a lead fits the target criteria.
- **Record ID** – A unique string identifier assigned to each lead for tracking.
- **Persona** – A user‑defined ideal profile specifying target education tiers, job roles, skills, etc., for custom matching.
- **Bucket** – A classification tier (HIGH, MEDIUM, LOW, NOT FIT) based on score ranges.
- **LLM** – Large Language Model (e.g., Gemini, OpenAI).

### 5.2 Input JSON Schema (Informal)

```json
{
  "_recordId": "optional string",
  "name": "string (required)",
  "education": ["string, e.g., 'MBA @ Harvard University'"],
  "jobs": ["string, e.g., 'Product Manager @ Google'"],
  "skills": ["string, e.g., 'Leadership'"],
  "company_details": {
    "name": "string",
    "category": "string"
  }
}
```

### 5.3 Environment Variables

| Variable             | Required              | Default | Description                                                    |
| -------------------- | --------------------- | ------- | -------------------------------------------------------------- |
| `PERPLEXITY_API_KEY` | No                    | –       | (Legacy) Perplexity key. Not used if Gemini/OpenAI configured. |
| `GEMINI_API_KEY`     | If AI_PROVIDER=gemini | –       | Google Gemini API key                                          |
| `OPENAI_API_KEY`     | If AI_PROVIDER=openai | –       | OpenAI API key                                                 |
| `AI_PROVIDER`        | No                    | `none`  | `gemini` or `openai`                                           |
| `SESSION_SECRET`     | Yes (production)      | –       | Secret for express-session                                     |
| `PORT`               | No                    | `3000`  | Server listen port                                             |
| `LOG_LEVEL`          | No                    | `info`  | `debug`, `info`, `warn`, `error`                               |

### 5.4 Configuration Reference

The full default configuration object is defined in `src/config/config.js`. Key sections:

```javascript
{
  scoring: {
    weights: { education: 0.20, experience: 0.35, thinking: 0.40 }
  },
  tiers: {
    universities: { tier_1: [...], tier_2: [...], tier_3: [...] },
    companies: { tier_1: [...], tier_2: [...], tier_3: [...] }
  },
  buckets: [
    { min: 90, max: 100, bucket: 'HIGH', priority: 'Immediate Outreach', conversion: '40-60%' },
    // ...
  ],
  processing: {
    batchDelayMs: 2000
  },
  llm: {
    provider: 'gemini',
    timeout: 15000
  },
  paths: {
    inputDir: './input',
    outputDir: './output',
    logDir: './logs',
    personasDir: './personas'
  },
  features: {
    enableScoreExplanation: true,
    enableEmailGeneration: true
  }
}
```

---
