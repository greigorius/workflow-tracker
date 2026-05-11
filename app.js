// app.js — Express application (no server listener)
// Used by server.js for local dev AND netlify/functions/api.js for production.

const express  = require("express");
const { Client } = require("@notionhq/client");
const path     = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const notion      = new Client({ auth: process.env.NOTION_TOKEN });
const TASKS_DB    = process.env.NOTION_DB_TASKS;
const PROJECTS_DB = process.env.NOTION_DB_PROJECTS;

// Total steps — keep in sync with TOTAL_STEPS in public/data.js
const TOTAL_STEPS = 14;

// ─── Step ↔ DM Phase mapping ─────────────────────────────────────────────────
const STEP_TO_DM_PHASE = [
  "Agree Scope",                // 0  — Set up scope
  "Set Up Item & Drawing No's", // 1  — Item number and programme
  "Review Design Intent",       // 2  — Design intent info and collab space
  "Handed Off",                 // 3  — Hand off to DT for review
  "Submit RFI's",               // 4  — Raise initial RFIs
  "Coordinate Trades",          // 5  — Coordinate with other trades
  "Review Drawings",            // 6  — Review DT approval draft
  "Submit Drawings",            // 7  — Issue for client approval
  "Review Comments",            // 8  — Review client comments with DT
  "Coordinate Model",           // 9  — Coordinate queried comments
  "Agree Program & Hours",      // 10 — Review DT revision
  "Schedule Production",        // 11 — Issue revision for sign off
  "Production Pack",            // 12 — Production Pack
  "Schedule Task",              // 13 — Schedule Task
];

const DM_PHASE_TO_STEP = {};
STEP_TO_DM_PHASE.forEach((phase, i) => { DM_PHASE_TO_STEP[phase] = i; });
DM_PHASE_TO_STEP["Production Pack"] = 12;
DM_PHASE_TO_STEP["Schedule Task"]   = 13;
DM_PHASE_TO_STEP["Phase Complete"]  = TOTAL_STEPS;
DM_PHASE_TO_STEP["Phase Blocked"]   = -1;

function itemStatusForStep(stepIdx) {
  if (stepIdx >= TOTAL_STEPS) return "Complete";
  if (stepIdx >= 12)  return "In Production";
  if (stepIdx === 8)  return "1st Comments Received";
  if (stepIdx >= 9)   return "In Design - Revisions";
  if (stepIdx >= 4)   return "In Design - First Issue";
  return "Ongoing";
}

// ─── Notion schema migration ──────────────────────────────────────────────────
async function ensureNotionSchema() {
  try {
    const db = await notion.databases.retrieve({ database_id: TASKS_DB });
    const currentOptions = db.properties["DM Phase"]?.select?.options || [];
    const currentNames   = new Set(currentOptions.map((o) => o.name));
    const toAdd = ["Production Pack", "Schedule Task"].filter((n) => !currentNames.has(n));
    if (toAdd.length === 0) return;
    await notion.databases.update({
      database_id: TASKS_DB,
      properties: {
        "DM Phase": {
          select: { options: [...currentOptions, ...toAdd.map((name) => ({ name }))] },
        },
      },
    });
    console.log(`✅ Added DM Phase options: ${toAdd.join(", ")}`);
  } catch (err) {
    console.warn("⚠️  Could not update Notion schema:", err.message);
  }
}

// ─── Project cache ────────────────────────────────────────────────────────────
let projectsCache    = {};
let projectsCacheTime = 0;
const CACHE_TTL_MS   = 5 * 60 * 1000;

async function getProjectsMap() {
  if (Date.now() - projectsCacheTime < CACHE_TTL_MS) return projectsCache;
  const results = {};
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: PROJECTS_DB,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results) {
      const title = page.properties["Project Name"]?.title?.[0]?.plain_text || "Untitled Project";
      results[page.id] = title;
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  projectsCache     = results;
  projectsCacheTime = Date.now();
  return results;
}

// ─── Notion page → app item ───────────────────────────────────────────────────
function notionPageToItem(page, projectsMap) {
  const p = page.properties;

  const drawingRef = p["Drawing Ref"]?.rich_text?.[0]?.plain_text?.trim() || null;
  const id = drawingRef || page.id.replace(/-/g, "").slice(-6).toUpperCase();
  const name = p["Item Name"]?.title?.[0]?.plain_text || "Untitled";

  const projectIds = p["Projects"]?.relation?.map((r) => r.id) || [];
  const project = projectIds.length > 0
    ? (projectsMap[projectIds[0]] || "Unknown Project")
    : "No Project";

  const bic      = p["Ball In Court"]?.select?.name || "DM";
  const priority = (p["Priority"]?.select?.name || "Medium").toLowerCase();

  const dmPhase   = p["DM Phase"]?.select?.name;
  const isBlocked = p["Item Status"]?.status?.name === "Blocked";

  let progress    = 0;
  let blockerStep = null;

  if (dmPhase === "Phase Complete") {
    progress = TOTAL_STEPS;
  } else if (dmPhase && dmPhase in DM_PHASE_TO_STEP && DM_PHASE_TO_STEP[dmPhase] >= 0) {
    progress = DM_PHASE_TO_STEP[dmPhase];
    if (isBlocked) blockerStep = progress;
  } else if (dmPhase === "Phase Blocked") {
    progress = 0; blockerStep = 0;
  }

  const blockerArr  = p["Blocker"]?.multi_select || [];
  const blockerText = blockerArr.map((b) => b.name).join(", ");
  const rfiCount    = (p["Related RFI"]?.relation || []).length;

  const props = {};
  const origAlloc = p["Original Allocation (Hrs)"]?.number;
  if (origAlloc != null) props.origAlloc = String(origAlloc);
  const dd1 = p["Draw Days - DD1"]?.number;
  if (dd1 != null) props.dd1 = String(dd1);
  const startPlan = p["1st DT Start (Plan)"]?.date?.start;
  if (startPlan) props.startPlan = startPlan;
  const issueDate = p["1st Submission Date (Actual)"]?.date?.start;
  if (issueDate) props.issueDate = issueDate;
  if (drawingRef) props.draftRev = drawingRef;
  const signOffDate = p["2nd Submission Date (Actual)"]?.date?.start;
  if (signOffDate) props.signOffDate = signOffDate;
  if (rfiCount > 0) props.rfiCount = String(rfiCount);

  return {
    id, notionId: page.id, name, project, bic, priority,
    progress, blockerStep, blockerText: blockerText || "", props,
  };
}

// ─── Fetch all tasks ──────────────────────────────────────────────────────────
async function fetchAllTasks() {
  const projectsMap = await getProjectsMap();
  const items = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: TASKS_DB,
      filter: { property: "Item Status", status: { does_not_equal: "Omitted" } },
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results) {
      try { items.push(notionPageToItem(page, projectsMap)); }
      catch (err) { console.warn("Skipping page", page.id, err.message); }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  // Exclude items whose name contains "PCSA" (case-insensitive)
  return items.filter((it) => !it.name.toUpperCase().includes("PCSA"));
}

// ─── Property helpers ─────────────────────────────────────────────────────────
function dmPhasePatch(stepIdx) {
  const phase = stepIdx >= TOTAL_STEPS ? "Phase Complete" : STEP_TO_DM_PHASE[stepIdx];
  return { select: { name: phase } };
}
function itemStatusPatch(statusName) { return { status: { name: statusName } }; }

const PROP_KEY_MAP = {
  origAlloc:   { name: "Original Allocation (Hrs)",        type: "number"     },
  dd1:         { name: "Draw Days - DD1",                  type: "number"     },
  startPlan:   { name: "1st DT Start (Plan)",              type: "date"       },
  issueDate:   { name: "1st Submission Date (Actual)",     type: "date"       },
  draftRev:    { name: "Drawing Ref",                      type: "rich_text"  },
  revLabel:    { name: "Drawing Ref",                      type: "rich_text"  },
  signOffDate: { name: "2nd Submission Date (Actual)",     type: "date"       },
};

function buildPropPatch(key, value) {
  const mapping = PROP_KEY_MAP[key];
  if (!mapping) return null;
  const { name, type } = mapping;
  if (type === "number")    return { [name]: { number: value === "" || value == null ? null : Number(value) } };
  if (type === "date")      return { [name]: value ? { date: { start: value } } : { date: null } };
  if (type === "rich_text") return { [name]: { rich_text: value ? [{ text: { content: value } }] : [] } };
  return null;
}

// ─── API routes ───────────────────────────────────────────────────────────────
app.get("/api/items", async (req, res) => {
  try {
    const items = await fetchAllTasks();
    items.sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })
    );
    res.json({ items });
  } catch (err) { console.error("GET /api/items", err); res.status(500).json({ error: err.message }); }
});

app.patch("/api/items/:pageId/advance", async (req, res) => {
  const { pageId } = req.params;
  const { fromStep } = req.body;
  const nextStep = Math.min(fromStep + 1, TOTAL_STEPS);
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "DM Phase":    dmPhasePatch(nextStep),
        "Item Status": itemStatusPatch(itemStatusForStep(nextStep)),
        "Blocker":     { multi_select: [] },
      },
    });
    res.json({ ok: true, newStep: nextStep });
  } catch (err) { console.error("advance", err); res.status(500).json({ error: err.message }); }
});

app.patch("/api/items/:pageId/undo", async (req, res) => {
  const { pageId } = req.params;
  const { fromStep } = req.body;
  const prevStep = Math.max(fromStep - 1, 0);
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "DM Phase":    dmPhasePatch(prevStep),
        "Item Status": itemStatusPatch(itemStatusForStep(prevStep)),
      },
    });
    res.json({ ok: true, newStep: prevStep });
  } catch (err) { console.error("undo", err); res.status(500).json({ error: err.message }); }
});

app.patch("/api/items/:pageId/block", async (req, res) => {
  const { pageId } = req.params;
  const { stepIdx, reason } = req.body;
  const validBlockers = ["Awaiting Supplier","Awaiting Instruction","Awaiting RFI Response","Awaiting Design Info"];
  const matchedBlocker = validBlockers.includes(reason) ? reason : "Awaiting Instruction";
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "Item Status": itemStatusPatch("Blocked"),
        "Blocker":     { multi_select: [{ name: matchedBlocker }] },
      },
    });
    res.json({ ok: true });
  } catch (err) { console.error("block", err); res.status(500).json({ error: err.message }); }
});

app.patch("/api/items/:pageId/unblock", async (req, res) => {
  const { pageId } = req.params;
  const { stepIdx } = req.body;
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "Item Status": itemStatusPatch(itemStatusForStep(stepIdx ?? 0)),
        "Blocker":     { multi_select: [] },
      },
    });
    res.json({ ok: true });
  } catch (err) { console.error("unblock", err); res.status(500).json({ error: err.message }); }
});

app.patch("/api/items/:pageId/bic", async (req, res) => {
  const { pageId } = req.params;
  const { bic } = req.body;
  try {
    await notion.pages.update({ page_id: pageId, properties: { "Ball In Court": { select: { name: bic } } } });
    res.json({ ok: true });
  } catch (err) { console.error("bic", err); res.status(500).json({ error: err.message }); }
});

app.patch("/api/items/:pageId/property", async (req, res) => {
  const { pageId } = req.params;
  const { key, value } = req.body;
  const patch = buildPropPatch(key, value);
  if (!patch) return res.status(400).json({ error: `Unknown property key: ${key}` });
  try {
    await notion.pages.update({ page_id: pageId, properties: patch });
    res.json({ ok: true });
  } catch (err) { console.error("property", err); res.status(500).json({ error: err.message }); }
});

app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

module.exports = { app, ensureNotionSchema };
