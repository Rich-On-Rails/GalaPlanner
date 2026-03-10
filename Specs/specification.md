# AI Agent Specification: Train Gala Planner Web App

## 0. Document Goal

This specification defines **exactly how an AI coding agent should assist** in building the Train Gala Planner web application.

It focuses on:

* agent responsibilities and boundaries
* a stepwise build plan (milestones → tasks)
* required outputs (code, tests, docs)
* acceptance criteria the agent must satisfy

**Agent persona:** collaborative, cautious, explainable, and “calm UX first.”

---

## 1. Product Summary

Build a web app that:

1. Accepts uploaded gala documents (PDF/Excel/CSV)
2. Extracts and normalises timetable + locomotive/service data
3. Lets users filter/slice the day
4. Helps users generate an **explainable plan** to see as many locomotives as possible within constraints

The app is a planning assistant, not a real-time operations system.

---

## 2. Agent Responsibilities

### 2.1 The agent MUST

* Produce working code increments that run locally
* Prefer deterministic parsing/optimisation where possible; use LLM reasoning for:

  * ambiguous extraction
  * mapping inconsistent station names
  * explaining plans / conflicts
* Make all assumptions explicit
* Add tests for core logic
* Keep the UI modern, clean, accessible
* Preserve existing behaviour when modifying code (no “Picasso on steroids” changes)

### 2.2 The agent MUST NOT

* Invent timetable data when extraction is uncertain (must flag uncertainty)
* Hide errors or silently discard rows
* Require users to share personal data
* Store uploaded files longer than necessary (unless explicitly implemented as a feature)

---

## 3. Agent Operating Workflow

### 3.1 Execution loop

For each task:

1. Restate intent (1–2 sentences)
2. Identify files to change/create
3. Implement smallest viable change
4. Run/describe checks
5. Summarise what changed + how to verify

### 3.2 Milestone delivery

The agent must deliver milestones in order, keeping the app runnable after each.

---

## 4. Milestones (Implementation Roadmap)

### Milestone A — Skeleton App

**Goal:** a running app with upload UI, backend endpoint, and basic data model.

Deliverables:

* Frontend page with file upload + “parsed preview” placeholder
* Backend endpoint: `POST /api/upload`
* Storage: in-memory for MVP; swap later
* Shared data schema (see Section 7)

Acceptance criteria:

* User can upload a file
* Backend stores it temporarily and returns a stub `ParseResult`

---

### Milestone B — Deterministic Parsing

**Goal:** parse Excel/CSV deterministically.

Deliverables:

* Excel reader (xlsx)
* CSV reader
* Column mapping UI (if headers unknown)
* Normalisation routines (time parsing, station name trim, loco ID)

Acceptance criteria:

* A sample CSV and XLSX parse into consistent `Service` objects
* Parsing errors are returned as structured `ParseIssue[]`

---

### Milestone C — PDF Extraction Pipeline

**Goal:** extract timetable tables from PDFs.

Approach:

* Prefer non-LLM extraction first (table/text extraction)
* Only use LLM assistance when extraction is ambiguous

Deliverables:

* PDF text/table extraction module
* “uncertainty highlighting” in preview

Acceptance criteria:

* A digital PDF with a timetable table yields `Service[]`
* If the PDF is messy/scanned, the app reports limitations rather than hallucinating

---

### Milestone D — Planning Engine v1 (Deterministic)

**Goal:** compute feasible viewing plans.

Deliverables:

* A deterministic planner that:

  * treats each service as a time-bounded segment
  * checks station/time feasibility
  * creates candidate itineraries
* A scoring function:

  * maximise unique locomotives seen
  * tie-breakers: minimise idle time, minimise backtracking, prefer must-see locos

Acceptance criteria:

* Given a sample dataset, the planner returns:

  * best plan
  * top N alternatives
  * explanation of why they differ

---

### Milestone E — AI Explain + Assist Layer

**Goal:** wrap planner outputs in an explainable assistant.

Deliverables:

* Chat-style assistant panel (optional MVP)
* “Explain this plan” output
* “What if I arrive at 11:00?” re-run with new constraints

Acceptance criteria:

* Assistant can answer:

  * why a loco is missed
  * which constraints cause a conflict
  * best alternative with one changed preference

---

### Milestone F — Polished UI + Accessibility

**Goal:** modern, calm presentation.

Deliverables:

* Timeline view
* Locomotive-centric view
* Plan summary view
* Keyboard navigation + sensible ARIA

Acceptance criteria:

* Users can understand the day in under 60 seconds from upload

---

## 5. UX Requirements (Agent-Enforced)

The agent must implement UI with:

* low visual noise
* clear typography hierarchy
* consistent spacing
* accessible contrast
* “calm defaults” (avoid aggressive colours/animations)

UI must include:

* Upload + preview
* Filters / slices:

  * day selection
  * time window
  * station filters
  * loco filters (must-see)
  * break blocks
* Plan results:

  * coverage: “X of Y locomotives”
  * conflicts + reasons

---

## 6. Functional Requirements

### 6.1 Upload

* Support PDF, XLSX, CSV
* Max file size configurable
* Parse on server; return structured result

### 6.2 Data Review

* Display extracted services as a table
* Highlight:

  * missing times
  * unknown stations
  * unclear locomotive assignment
* Allow user edits before planning

### 6.3 Planning

* Generate plans for:

  * one day
  * optionally multi-day later
* Respect constraints:

  * arrival/departure time
  * must-see locomotives
  * station avoid/prefer
  * breaks
  * mobility/walking buffers

---

## 7. Core Data Model (Internal)

### 7.1 Entities

* `Event`

  * `name`, `location`, `timezone`
* `Station`

  * `id`, `name`, `aliases[]`
* `Locomotive`

  * `id`, `name/number`, `type` (steam/diesel/electric/other)
* `Service`

  * `id`
  * `day`
  * `originStationId`, `destStationId`
  * `departTime`, `arriveTime`
  * `locomotiveIds[]`
  * `serviceNotes[]`
  * `sourceConfidence` (0–1)
* `ParseResult`

  * `services[]`, `stations[]`, `locomotives[]`
  * `issues[]` (warnings/errors)
* `UserConstraints`

  * `timeWindow`, `mustSeeLocoIds[]`, `stationPreferences`, `breaks[]`, `transferBufferMinutes`
* `Plan`

  * `legs[]` (each references a `Service`)
  * `uniqueLocosSeen[]`
  * `score`
  * `explanations[]`

### 7.2 Parse Issues

* `ParseIssue`

  * `severity` (info/warn/error)
  * `message`
  * `lineage` (which file/page/table/row)
  * `suggestedFix` (optional)

---

## 8. AI Prompting Requirements

### 8.1 When the agent may use LLM reasoning

* mapping station aliases (e.g., “Oswestry” vs “Oswestry (Cambrian)”)
* inferring column meaning when headers are missing
* summarising plan trade-offs

### 8.2 Guardrails

* Never fabricate times/services
* If uncertain, output:

  * confidence score
  * issue explaining what’s missing
  * request user confirmation via UI

### 8.3 Explainability format

Explanations must be short and structured, e.g.:

* **Why missed:** overlap, transfer time, out-of-window
* **Fix options:** change arrival time, swap leg 3, relax must-see

---

## 9. Testing Requirements (Agent-Enforced)

Minimum test suite:

* Parsing tests (CSV, XLSX)
* Normalisation tests (time formats, station aliasing)
* Planning tests:

  * overlap rejection
  * must-see prioritisation
  * transfer buffer respected

Golden datasets:

* Provide at least 1 small sample dataset in repo (`/samples/`) used by tests.

---

## 10. Observability & Error Handling

The agent must implement:

* structured server logs for parsing and planning
* user-visible error states (no blank screens)
* consistent error objects returned from API

---

## 11. Security & Privacy

* Do not store uploads longer than needed for processing (MVP: in-memory)
* If persistent storage is added later:

  * require explicit user action to save
  * ensure clear deletion option

---

## 12. Definition of Done (Per Milestone)

A milestone is “done” when:

* app runs locally
* core flows work end-to-end
* tests pass
* UI is usable without reading the code
* the agent provides a short verification checklist

---

## 13. Suggested Initial Stack (Agent-Friendly)

(Agent may adapt, but must keep it simple.)

* Frontend: React + TypeScript
* Backend: Node (Express/Fastify) *or* .NET minimal API
* Parsing:

  * XLSX/CSV: deterministic libraries
  * PDF: extraction library + optional LLM assist
* Planning engine: deterministic module with unit tests

---

## 14. Agent Output Requirements

For each implementation cycle, the agent must output:

* the files changed/added
* how to run the app
* how to run tests
* a quick demo path (upload → preview → plan)

---

*This is an agent-first specification: build in small safe steps, keep it explainable, keep it calm, and never invent timetable reality.*
