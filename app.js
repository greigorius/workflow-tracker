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
const TOTAL_STEPS = 20;

// ─── Step → Notion property mappings ─────────────────────────────────────────
// Primary DM Phase written when a step becomes active.
// Multi-phase steps (with sub-phases in data.js) use the first entry here.
const STEP_TO_DM_PHASE = [
  "Agree Scope",                 // 0  — Initiate
  "Agree Scope",                 // 1  — Scope
  "Set Up Item & Drawing No's",  // 2  — Launch
  "Review Design Intent",        // 3  — Gather and Share
  "Handover",                    // 4  — DT Review
  "Submit RFI's",                // 5  — Raise Submittals
  "Coordinate Trades",           // 6  — Trade Coordination
  "Review Drawings",             // 7  — DT Draft
  "Submit Drawings",             // 8  — Approval Submission
  "Pending Response",            // 9  — Client Response
  "Review Comments",             // 10 — Query Comments
  "Handover",                    // 11 — DT Revision
  "Submit Drawings",             // 12 — Revised Submission
  "Pending Response",            // 13 — Client Sign Off
  "Handover",                    // 14 — Pre-Production
  "Schedule Production",         // 15 — Production Hand Off
  "Production Coordination",     // 16 — Pre-Install
  "Site Coordination",           // 17 — Install
  "Handover",                    // 18 — Practical Completion
  "Final Report",                // 19 — Close
];

const STEP_ITEM_STATUS = [
  "Backlog",           // 0  — Initiate
  "Set Up",            // 1  — Scope
  "Set Up",            // 2  — Launch
  "In Design",         // 3  — Gather and Share
  "In Design",         // 4  — DT Review
  "In Design",         // 5  — Raise Submittals
  "In Design",         // 6  — Trade Coordination
  "In Design",         // 7  — DT Draft
  "In Design",         // 8  — Approval Submission
  "Awaiting Approval", // 9  — Client Response
  "In Design",         // 10 — Query Comments
  "In Design",         // 11 — DT Revision
  "In Design",         // 12 — Revised Submission
  "Awaiting Approval", // 13 — Client Sign Off
  "In Design",         // 14 — Pre-Production
  "In Design",         // 15 — Production Hand Off
  "In Production",     // 16 — Pre-Install
  "On Site",           // 17 — Install
  "In Design",         // 18 — Practical Completion
  "Close Out",         // 19 — Close
];

// Fixed BIC per step; null means the user sets it manually for that step.
const STEP_BIC = [
  "DM",         // 0  — Initiate
  null,         // 1  — Scope (user-selectable)
  "DM",         // 2  — Launch
  "DM",         // 3  — Gather and Share
  "DM",         // 4  — DT Review
  "DM",         // 5  — Raise Submittals
  null,         // 6  — Trade Coordination (user-selectable)
  "DM",         // 7  — DT Draft
  "DM",         // 8  — Approval Submission
  "Contractor", // 9  — Client Response
  null,         // 10 — Query Comments (user-selectable)
  "DM",         // 11 — DT Revision
  "DM",         // 12 — Revised Submission
  "Architect",  // 13 — Client Sign Off
  "DM",         // 14 — Pre-Production
  "DM",         // 15 — Production Hand Off
  "Production", // 16 — Pre-Install
  "Site",       // 17 — Install
  "DM",         // 18 — Practical Completion
  "DM",         // 19 — Close
];

// Sub-phases per step — mirrors dmPhases in public/data.js.
// Used to determine the active sub-phase index from the current DM Phase value.
const STEP_SUB_PHASES = [
  ["Agree Scope"],                                                                 // 0  Initiate
  ["Agree Scope"],                                                                 // 1  Scope
  ["Set Up Item & Drawing No's"],                                                  // 2  Launch
  ["Review Design Intent", "Create Handover Pack"],                                // 3  Gather and Share
  ["Handover"],                                                                    // 4  DT Review
  ["Submit RFI's", "Create Samples"],                                              // 5  Raise Submittals
  ["Coordinate Trades", "Coordinate Model"],                                       // 6  Trade Coordination
  ["Review Drawings"],                                                             // 7  DT Draft
  ["Submit Drawings"],                                                             // 8  Approval Submission
  ["Pending Response"],                                                            // 9  Client Response
  ["Review Comments", "Coordinate Trades", "Coordinate Model", "Submit RFI's"],   // 10 Query Comments
  ["Handover", "Review Drawings"],                                                 // 11 DT Revision
  ["Submit Drawings"],                                                             // 12 Revised Submission
  ["Pending Response"],                                                            // 13 Client Sign Off
  ["Handover", "Review Drawings"],                                                 // 14 Pre-Production
  ["Schedule Production"],                                                         // 15 Production Hand Off
  ["Production Coordination"],                                                     // 16 Pre-Install
  ["Site Coordination"],                                                           // 17 Install
  ["Handover", "Review Drawings", "Submit Drawings"],                              // 18 Practical Completion
  ["Final Report"],                                                                // 19 Close
];

// Fallback: DM Phase → step index for items that predate the "DM Step" property.
// Where multiple steps share a DM Phase, map to the earliest occurrence.
const DM_PHASE_TO_STEP = {
  "Agree Scope":                 0,
  "Set Up Item & Drawing No's":  2,
  "Review Design Intent":        3,
  "Create Handover Pack":        3,
  "Handover":                    4,
  "Submit RFI's":                5,
  "Create Samples":              5,
  "Coordinate Trades":           6,
  "Coordinate Model":            6,
  "Review Drawings":             7,
  "Submit Drawings":             8,
  "Pending Response":            9,
  "Review Comments":            10,
  "Schedule Production":        15,
  "Production Coordination":    16,
  "Site Coordination":          17,
  "Final Report":               19,
  // Legacy phase names kept for backwards compat
  "Handed Off":                  4,
  "Agree Program & Hours":      11,
  "Production Pack":            14,
  "Schedule Task":              15,
  // Sentinels
  "Phase Complete":             TOTAL_STEPS,
  "Phase Blocked":              -1,
};

// ─── Notion schema migration ──────────────────────────────────────────────────
async function ensureNotionSchema() {
  try {
    const db = await notion.databases.retrieve({ database_id: TASKS_DB });

    // Add any missing DM Phase select options
    const currentOptions = db.properties["DM Phase"]?.select?.options || [];
    const currentNames   = new Set(currentOptions.map((o) => o.name));
    const requiredPhases = [
      "Agree Scope", "Set Up Item & Drawing No's", "Review Design Intent",
      "Create Handover Pack", "Handover", "Submit RFI's", "Create Samples",
      "Coordinate Trades", "Coordinate Model", "Review Drawings", "Submit Drawings",
      "Pending Response", "Review Comments", "Schedule Production",
      "Production Coordination", "Site Coordination", "Final Report", "Phase Complete",
    ];
    const toAdd = requiredPhases.filter((n) => !currentNames.has(n));
    const schemaUpdates = {};
    if (toAdd.length > 0) {
      schemaUpdates["DM Phase"] = {
        select: { options: [...currentOptions, ...toAdd.map((name) => ({ name }))] },
      };
    }

    // Add "DM Step" number property if absent (primary step-index tracker)
    if (!db.properties["DM Step"]) {
      schemaUpdates["DM Step"] = { number: { format: "number" } };
    }

    if (Object.keys(schemaUpdates).length === 0) return;
    await notion.databases.update({ database_id: TASKS_DB, properties: schemaUpdates });
    console.log("✅ Notion schema updated:", Object.keys(schemaUpdates).join(", "));
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

  const dmStep    = p["DM Step"]?.number;   // preferred — exact step index
  const dmPhase   = p["DM Phase"]?.select?.name;
  const isBlocked = p["Item Status"]?.status?.name === "Blocked";

  let progress    = 0;
  let blockerStep = null;

  if (typeof dmStep === "number") {
    // "DM Step" is the reliable source of truth
    progress = dmStep;
    if (isBlocked) blockerStep = progress;
  } else if (dmPhase === "Phase Complete") {
    progress = TOTAL_STEPS;
  } else if (dmPhase && dmPhase in DM_PHASE_TO_STEP && DM_PHASE_TO_STEP[dmPhase] >= 0) {
    progress = DM_PHASE_TO_STEP[dmPhase];
    if (isBlocked) blockerStep = progress;
  } else if (dmPhase === "Phase Blocked") {
    progress = 0; blockerStep = 0;
  }

  // Determine active sub-phase index within the current step
  const subPhases = STEP_SUB_PHASES[progress] || [];
  let subPhaseIdx = 0;
  if (subPhases.length > 1 && dmPhase) {
    const sp = subPhases.indexOf(dmPhase);
    if (sp > 0) subPhaseIdx = sp;
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
    progress, subPhaseIdx, blockerStep, blockerText: blockerText || "", props,
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
  return items.filter((it) => !it.name.toUpperCase().includes("PCSA"));
}

// ─── Property helpers ─────────────────────────────────────────────────────────
function stepNotionProps(stepIdx) {
  const isComplete = stepIdx >= TOTAL_STEPS;
  const props = {
    "DM Step":    { number: stepIdx },
    "DM Phase":   isComplete
      ? { select: { name: "Phase Complete" } }
      : { select: { name: STEP_TO_DM_PHASE[stepIdx] } },
    "Item Status": { status: { name: isComplete ? "Complete" : STEP_ITEM_STATUS[stepIdx] } },
  };
  if (isComplete) {
    props["Ball In Court"] = { select: null };
  } else {
    const bic = STEP_BIC[stepIdx];
    if (bic) props["Ball In Court"] = { select: { name: bic } };
  }
  return props;
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
      properties: { ...stepNotionProps(nextStep), "Blocker": { multi_select: [] } },
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
      properties: stepNotionProps(prevStep),
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
  const status = (stepIdx != null && stepIdx < TOTAL_STEPS)
    ? STEP_ITEM_STATUS[stepIdx]
    : "In Design";
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "Item Status": itemStatusPatch(status),
        "Blocker":     { multi_select: [] },
      },
    });
    res.json({ ok: true });
  } catch (err) { console.error("unblock", err); res.status(500).json({ error: err.message }); }
});

app.patch("/api/items/:pageId/subphase", async (req, res) => {
  const { pageId } = req.params;
  const { stepIdx, subPhaseIdx } = req.body;
  const subPhases = STEP_SUB_PHASES[stepIdx] || [];
  const nextSubPhaseIdx = subPhaseIdx + 1;
  try {
    if (nextSubPhaseIdx >= subPhases.length) {
      // Last sub-phase checked — advance to next step
      const nextStep = Math.min(stepIdx + 1, TOTAL_STEPS);
      await notion.pages.update({
        page_id: pageId,
        properties: { ...stepNotionProps(nextStep), "Blocker": { multi_select: [] } },
      });
      res.json({ ok: true, advanced: true, newStep: nextStep });
    } else {
      // Advance DM Phase to next sub-phase; DM Step stays the same
      await notion.pages.update({
        page_id: pageId,
        properties: { "DM Phase": { select: { name: subPhases[nextSubPhaseIdx] } } },
      });
      res.json({ ok: true, advanced: false, newSubPhaseIdx: nextSubPhaseIdx });
    }
  } catch (err) { console.error("subphase", err); res.status(500).json({ error: err.message }); }
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
