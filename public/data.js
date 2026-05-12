// Static workflow data — phases, steps, BIC palette, blocker reasons.
// INITIAL_ITEMS is no longer here — items are loaded live from Notion.

window.PHASES = [
  { label: "SET UP",    steps: [0, 1, 2],                               short: "Set Up"    },
  { label: "DESIGN",   steps: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],  short: "Design"    },
  { label: "CLOSE OUT", steps: [14, 15, 16, 17, 18, 19],               short: "Close Out" },
];

// Each step carries the Notion properties that should be set while it is active.
// dmPhases: first entry is the primary DM Phase written on advance; extras are sub-phases
//           the inspector can surface as a checklist.
// bic: fixed Ball In Court for this step, or null when the user selects it.
// canBlock: whether the block action is available on this step.
window.STEPS = [
  // ── Set Up ─────────────────────────────────────────────────────────────────
  { name: "Initiate",             short: "Initiate",   dmPhases: ["Agree Scope"],                                                      itemStatus: "Backlog",           bic: "DM",         canBlock: false },
  { name: "Scope",                short: "Scope",      dmPhases: ["Agree Scope"],                                                      itemStatus: "Set Up",            bic: null,         canBlock: true  },
  { name: "Launch",               short: "Launch",     dmPhases: ["Set Up Item & Drawing No's"],                                       itemStatus: "Set Up",            bic: "DM",         canBlock: false },
  // ── Design ─────────────────────────────────────────────────────────────────
  { name: "Gather and Share",     short: "Gather",     dmPhases: ["Review Design Intent", "Create Handover Pack"],                     itemStatus: "In Design",         bic: "DM",         canBlock: false },
  { name: "DT Review",            short: "DT Review",  dmPhases: ["Handover"],                                                         itemStatus: "In Design",         bic: "DM",         canBlock: false },
  { name: "Raise Submittals",     short: "Submittals", dmPhases: ["Submit RFI's", "Create Samples"],                                   itemStatus: "In Design",         bic: "DM",         canBlock: false },
  { name: "Trade Coordination",   short: "Trades",     dmPhases: ["Coordinate Trades", "Coordinate Model"],                            itemStatus: "In Design",         bic: null,         canBlock: true  },
  { name: "DT Draft",             short: "DT Draft",   dmPhases: ["Review Drawings"],                                                  itemStatus: "In Design",         bic: "DM",         canBlock: false },
  { name: "Approval Submission",  short: "Submit",     dmPhases: ["Submit Drawings"],                                                  itemStatus: "In Design",         bic: "DM",         canBlock: false },
  { name: "Client Response",      short: "Response",   dmPhases: ["Pending Response"],                                                 itemStatus: "Awaiting Approval", bic: "Contractor", canBlock: false },
  { name: "Query Comments",       short: "Queries",    dmPhases: ["Review Comments", "Coordinate Trades", "Coordinate Model", "Submit RFI's"], itemStatus: "In Design", bic: null,         canBlock: true  },
  { name: "DT Revision",          short: "DT Rev.",    dmPhases: ["Handover", "Review Drawings"],                                      itemStatus: "In Design",         bic: "DM",         canBlock: false },
  { name: "Revised Submission",   short: "Re-Submit",  dmPhases: ["Submit Drawings"],                                                  itemStatus: "In Design",         bic: "DM",         canBlock: false },
  { name: "Client Sign Off",      short: "Sign Off",   dmPhases: ["Pending Response"],                                                 itemStatus: "Awaiting Approval", bic: "Architect",  canBlock: false },
  // ── Close Out ──────────────────────────────────────────────────────────────
  { name: "Pre-Production",       short: "Pre-Prod.",  dmPhases: ["Handover", "Review Drawings"],                                      itemStatus: "In Design",         bic: "DM",         canBlock: false },
  { name: "Production Hand Off",  short: "Prod. H/O",  dmPhases: ["Schedule Production"],                                              itemStatus: "In Design",         bic: "DM",         canBlock: false },
  { name: "Pre-Install",          short: "Pre-Install",dmPhases: ["Production Coordination"],                                          itemStatus: "In Production",     bic: "Production", canBlock: false },
  { name: "Install",              short: "Install",    dmPhases: ["Site Coordination"],                                                itemStatus: "On Site",           bic: "Site",       canBlock: false },
  { name: "Practical Completion", short: "PC",         dmPhases: ["Handover", "Review Drawings", "Submit Drawings"],                   itemStatus: "In Design",         bic: "DM",         canBlock: false },
  { name: "Close",                short: "Close",      dmPhases: ["Final Report"],                                                     itemStatus: "Close Out",         bic: "DM",         canBlock: false },
];

// Steps that show property inputs in the Inspector (1-indexed in UI, 0-indexed here)
window.STEP_PROPS = {
  2: [  // Step 3 — Launch
    { key: "origAlloc",  label: "Original Hours Allocation", type: "number", placeholder: "40" },
    { key: "startPlan",  label: "1st DT Start (Plan)",       type: "date" },
    { key: "dd1",        label: "Draw Days - DD1",           type: "number", placeholder: "10" },
  ],
  4: [  // Step 5 — DT Review
    { key: "startActual", label: "1st DT Start (Actual)", type: "date" },
  ],
  15: [  // Step 16 — Production Hand Off
    { key: "prodDate", label: "Production Date (Actual)", type: "date" },
  ],
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
window.TOTAL_STEPS = 20;

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
