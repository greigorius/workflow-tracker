// Static workflow data — phases, steps, BIC palette, blocker reasons.
// INITIAL_ITEMS is no longer here — items are loaded live from Notion.

window.PHASES = [
  { label: "SETUP",         steps: [0, 1],          short: "Setup" },
  { label: "DESIGN",        steps: [2, 3, 4],       short: "Design" },
  { label: "COORDINATION",  steps: [5],             short: "Coord." },
  { label: "APPROVAL",      steps: [6, 7],          short: "Approval" },
  { label: "REVISION",      steps: [8, 9, 10],      short: "Revision" },
  { label: "SIGN OFF",      steps: [11],            short: "Sign off" },
  { label: "PRODUCTION",    steps: [12, 13],        short: "Prod." },
  { label: "SITE",          steps: [14, 15],        short: "Site" },
];

window.STEPS = [
  { name: "Set up scope",                            short: "Scope" },
  { name: "Item number and programme",               short: "Item no." },
  { name: "Design intent info and collab space",     short: "Intent" },
  { name: "Hand off to DT for review",               short: "DT review" },
  { name: "Raise initial RFIs",                      short: "RFIs" },
  { name: "Coordinate with other trades",            short: "Trades" },
  { name: "Review DT approval draft",                short: "DT draft" },
  { name: "Issue for client approval",               short: "Client" },
  { name: "Review client comments with DT",          short: "Comments" },
  { name: "Coordinate queried comments",             short: "Queries" },
  { name: "Review DT revision",                      short: "DT rev." },
  { name: "Issue revision for sign off",             short: "Sign off" },
  { name: "Production Pack",                         short: "Pack" },
  { name: "Schedule Task",                           short: "Schedule" },
  { name: "Install",                                 short: "Install" },
  { name: "As Built",                               short: "As Built" },
];

// Steps that show property inputs in the Inspector
window.STEP_PROPS = {
  0: [{ key: "origAlloc", label: "Original allocation (hrs)", type: "number", placeholder: "40" }],
  1: [
    { key: "dd1",       label: "Draw days — DD1",     type: "number", placeholder: "10" },
    { key: "startPlan", label: "1st DT start (plan)", type: "date" },
  ],
  6: [{ key: "draftRev",  label: "Drawing ref",        type: "text",   placeholder: "Rev A" }],
  7: [{ key: "issueDate", label: "Issued to client",   type: "date" }],
  10: [{ key: "revLabel", label: "Revision label",     type: "text",   placeholder: "Rev B" }],
  11: [{ key: "signOffDate", label: "Signed off",      type: "date" }],
};

// Ball In Court options — matches Notion's "Ball In Court" select options
window.BIC_OPTIONS = ["DM", "DT", "Architect", "Contractor", "Supplier", "Project Team", "Production", "Site"];

window.BIC_COLORS = {
  DM:             { bg: "#1e1a3a", fg: "#AFA9EC" },
  DT:             { bg: "#0c1929", fg: "#85B7EB" },
  Architect:      { bg: "#1f1506", fg: "#FAC775" },
  Contractor:     { bg: "#0a1f16", fg: "#5DCAA5" },
  Supplier:       { bg: "#1f0d07", fg: "#F0997B" },
  "Project Team": { bg: "#251829", fg: "#ED93B1" },
  Production:     { bg: "#111a10", fg: "#78C97A" },
  Site:           { bg: "#1a1410", fg: "#D4956A" },
};

window.PRIORITY_COLORS = {
  high:   "#E24B4A",
  medium: "#EF9F27",
  low:    "#888780",
};

// Blocker reasons — matches Notion's "Blocker" multi_select options
window.BLOCKER_REASONS = [
  "Awaiting Supplier",
  "Awaiting Instruction",
  "Awaiting RFI Response",
  "Awaiting Design Info",
  "Other",
];

// Helpers (used by matrix, focus, reports views)
window.cellStatus = function (item, idx) {
  if (item.blockerStep === idx) return "blocked";
  if (idx < item.progress) return "done";
  if (idx === item.progress) return "active";
  return "locked";
};

// Total number of workflow steps (update here if steps are added/removed)
window.TOTAL_STEPS = 16;

window.itemStatus = function (item) {
  if (item.progress >= window.TOTAL_STEPS) return "complete";
  if (item.blockerStep !== null) return "blocked";
  if (item.progress === 0) return "not-started";
  return "in-progress";
};

window.itemPct = function (item) {
  const n = window.TOTAL_STEPS;
  return Math.round((Math.min(item.progress, n) / n) * 100);
};

// filterItems is used by matrix, focus, and focus-queue views
window.filterItems = function (items, filters) {
  if (!filters) return items;
  return items.filter((it) => {
    if (filters.q) {
      const q = filters.q.toLowerCase().trim();
      if (!it.name.toLowerCase().includes(q) && !(it.id || "").toLowerCase().includes(q)) return false;
    }
    if (filters.project && filters.project !== "All projects") {
      if ((it.project || "").trim() !== filters.project.trim()) return false;
    }
    if (filters.bic && filters.bic !== "All BIC") {
      if ((it.bic || "").trim() !== filters.bic.trim()) return false;
    }
    if (filters.status && filters.status !== "All statuses") {
      const s = window.itemStatus(it);
      const map = {
        "Not started": "not-started",
        "In progress": "in-progress",
        "Blocked":     "blocked",
        "Complete":    "complete",
      };
      if (s !== map[filters.status]) return false;
    }
    return true;
  });
};
