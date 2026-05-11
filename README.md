# Workflow Tracker

A real-time workflow checklist app for tracking design and production items through a 14-step process, with live read/write sync to Notion.

---

## What it does

Each item (drawing, specification, hardware piece, etc.) moves through 14 steps across 7 phases. The app gives you three ways to view and advance work:

- **Matrix** — a spreadsheet-style grid of all items × all steps. Click a cell to complete a step, shift-click to block it.
- **Focus / Queue** — a single-column inbox sorted by urgency. Space bar to mark done, B to block/unblock.
- **Reports** — portfolio-level stats: phase throughput, ball-in-court load, blocker breakdown, project progress.

Every action writes back to Notion immediately (optimistic UI — the change shows instantly; it rolls back with a toast if the API call fails).

---

## Workflow phases and steps

| # | Step | Phase |
|---|------|-------|
| 1 | Set up scope | SETUP |
| 2 | Item number and programme | SETUP |
| 3 | Design intent info and collab space | DESIGN |
| 4 | Hand off to DT for review | DESIGN |
| 5 | Raise initial RFIs | DESIGN |
| 6 | Coordinate with other trades | COORDINATION |
| 7 | Review DT approval draft | APPROVAL |
| 8 | Issue for client approval | APPROVAL |
| 9 | Review client comments with DT | REVISION |
| 10 | Coordinate queried comments | REVISION |
| 11 | Review DT revision | REVISION |
| 12 | Issue revision for sign off | SIGN OFF |
| 13 | Production Pack | PRODUCTION |
| 14 | Schedule Task | PRODUCTION |

---

## Notion setup

The app reads from and writes to five Notion databases. You need a Notion integration token and the IDs of each database.

### Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New integration**, give it a name, select your workspace
3. Copy the **Internal Integration Token** — this is your `NOTION_TOKEN`

### Connect the integration to each database

Open each database in Notion → click `···` (top right) → **Connections** → add your integration.

### Get database IDs

Open a database as a full page in Notion. The URL looks like:
```
https://www.notion.so/yourworkspace/DATABASE_ID?v=VIEW_ID
```
Copy the 32-character `DATABASE_ID`.

### Required databases

| Variable | Database | Key properties used |
|----------|----------|---------------------|
| `NOTION_DB_TASKS` | Items / Drawing schedule | `Item Name` (title), `DM Phase` (select), `Item Status` (status), `Ball In Court` (select), `Priority` (select), `Blocker` (multi-select), `Projects` (relation), `Drawing Ref` (rich text), `Original Allocation (Hrs)` (number), `Draw Days - DD1` (number), `1st DT Start (Plan)` (date), `1st Submission Date (Actual)` (date), `2nd Submission Date (Actual)` (date), `Related RFI` (relation) |
| `NOTION_DB_PROJECTS` | Projects | `Project Name` (title) |
| `NOTION_DB_RFIS` | RFIs | — |
| `NOTION_DB_TODO` | To-do / actions | — |
| `NOTION_DB_DRAWINGS` | Drawings | — |
| `NOTION_DB_FINISHES` | Finishes | — |
| `NOTION_DB_HARDWARE` | Hardware | — |
| `NOTION_DB_VARIATIONS` | Variations | — |
| `NOTION_DB_CLIENTS` | Clients | — |

The app actively reads/writes `NOTION_DB_TASKS` and `NOTION_DB_PROJECTS`. The others are reserved for future views.

### DM Phase options

The `DM Phase` select property on your Tasks database must include these options (the app adds the last two automatically on first run if they're missing):

```
Agree Scope · Set Up Item & Drawing No's · Review Design Intent · Handed Off
Submit RFI's · Coordinate Trades · Review Drawings · Submit Drawings
Review Comments · Coordinate Model · Agree Program & Hours · Schedule Production
Production Pack · Schedule Task · Phase Complete · Phase Blocked
```

---

## Local development

### Prerequisites

- Node.js 18+
- A populated `.env` file (see below)

### Install

```bash
cd workflow-tracker
npm install
```

### Environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

NOTION_DB_TASKS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_PROJECTS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_RFIS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_TODO=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_DRAWINGS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_FINISHES=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_HARDWARE=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_VARIATIONS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_CLIENTS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Run

```bash
npm start
# or for auto-reload during development:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Netlify

The app is pre-configured for Netlify via `netlify.toml`. The Express server is wrapped as a serverless function so no persistent server is needed.

1. Push to GitHub (run `push-to-github.bat` or `git push`)
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
3. Connect GitHub and select `greigorius/workflow-tracker`
4. Netlify auto-detects the config — build command is `npm install`, publish dir is `public`
5. Go to **Site settings → Environment variables** and add all 9 variables from your `.env`
6. Trigger a deploy — the app will be live at your Netlify URL

Any `git push` to `main` triggers an automatic redeploy.

---

## Architecture

```
workflow-tracker/
├── app.js                      # Express app — all API routes + Notion client
├── server.js                   # Local dev launcher (starts app.js on port 3000)
├── netlify/
│   └── functions/api.js        # Serverless wrapper for Netlify deployment
├── public/
│   ├── index.html              # Shell — loads React, Babel, and all JSX files
│   ├── data.js                 # Static config: phases, steps, BIC colours, helpers
│   ├── store.jsx               # useWorkflowStore — optimistic state + Notion API calls
│   ├── app.jsx                 # App shell: routing, filter state, loading screen
│   ├── matrix.jsx              # Matrix grid view
│   ├── focus.jsx               # Focus rows view
│   ├── focus-queue.jsx         # Focus queue view
│   ├── reports.jsx             # Reports / analytics view
│   ├── inspector.jsx           # Slide-in panel: step detail, block, properties
│   ├── tweaks-panel.jsx        # Settings sidebar (theme, density, view)
│   └── styles.css              # All styles
├── .env.example                # Environment variable template
├── netlify.toml                # Netlify build + redirect config
└── package.json
```

**Frontend stack:** React 18 + Babel Standalone (no build step — JSX is transpiled in-browser). All state is in React hooks; no external state library.

**API routes:**

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/items` | Fetch all non-omitted tasks with project names |
| `PATCH` | `/api/items/:id/advance` | Complete current step → write DM Phase + Item Status |
| `PATCH` | `/api/items/:id/undo` | Step back one |
| `PATCH` | `/api/items/:id/block` | Mark item blocked + set Blocker reason |
| `PATCH` | `/api/items/:id/unblock` | Clear block |
| `PATCH` | `/api/items/:id/bic` | Update Ball In Court |
| `PATCH` | `/api/items/:id/property` | Write a single property (date, number, text) |

---

## Keyboard shortcuts

### Matrix view
| Key | Action |
|-----|--------|
| `↑ ↓ ← →` | Navigate cells |
| `Space` | Complete active step |
| `B` | Block active step |
| `U` | Unblock item |
| `I` | Open inspector |

### Focus / Queue view
| Key | Action |
|-----|--------|
| `↑ ↓` | Navigate rows |
| `Space` | Complete current step |
| `B` | Block / unblock |
| `I` | Open inspector |
