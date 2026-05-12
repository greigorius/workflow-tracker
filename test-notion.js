// test-notion.js — Notion API write diagnostic
// Usage: NOTION_TOKEN=secret_xxx NOTION_DB_TASKS=xxx node test-notion.js
//
// Run from project root. Fetches the first item in the tasks DB and attempts
// to write to each tracked property, reporting pass/fail for each one.

require("dotenv").config();

const { Client } = require("@notionhq/client");

const TOKEN   = process.env.NOTION_TOKEN;
const DB      = process.env.NOTION_DB_TASKS;

if (!TOKEN || !DB) {
  console.error("❌  Missing env vars. Set NOTION_TOKEN and NOTION_DB_TASKS.");
  process.exit(1);
}

const notion = new Client({ auth: TOKEN });

async function fetchFirstPage() {
  const res = await notion.databases.query({ database_id: DB, page_size: 1 });
  if (!res.results.length) throw new Error("No pages found in database.");
  return res.results[0];
}

async function tryWrite(pageId, label, patch) {
  try {
    await notion.pages.update({ page_id: pageId, properties: patch });
    console.log(`  ✅  ${label}`);
    return true;
  } catch (err) {
    console.log(`  ❌  ${label}`);
    console.log(`       ${err.message}`);
    return false;
  }
}

async function readProps(page) {
  const p = page.properties;
  console.log("\n── Current property values ─────────────────────────────");
  const read = (label, val) => console.log(`  ${label.padEnd(30)} ${val ?? "(empty)"}`);
  read("Item Name",           p["Item Name"]?.title?.[0]?.plain_text);
  read("DM Phase",            p["DM Phase"]?.select?.name);
  read("DM Step",             p["DM Step"]?.number);
  read("Item Status",         p["Item Status"]?.status?.name);
  read("Ball In Court",       p["Ball In Court"]?.select?.name);
  read("Estimated Progress",  p["Estimated Progress"]?.number);
  read("1st DT Start (Plan)", p["1st DT Start (Plan)"]?.date?.start);
  read("1st DT Start (Actual)",p["1st DT Start (Actual)"]?.date?.start);
  read("Production Date (Actual)", p["Production Date (Actual)"]?.date?.start);
  read("Original Allocation (Hrs)", p["Original Allocation (Hrs)"]?.number);
  read("Draw Days - DD1",     p["Draw Days - DD1"]?.number);
  read("Blocker",             p["Blocker"]?.multi_select?.map(b=>b.name).join(", "));
  console.log("────────────────────────────────────────────────────────\n");
}

async function main() {
  console.log("\n🔍  Fetching first item from tasks DB…");
  let page;
  try {
    page = await fetchFirstPage();
  } catch (err) {
    console.error("❌  Could not query database:", err.message);
    process.exit(1);
  }

  const id = page.id;
  const name = page.properties["Item Name"]?.title?.[0]?.plain_text || id;
  console.log(`✅  Found: "${name}" (${id})\n`);

  await readProps(page);

  // Snapshot current values so we can restore them
  const original = {
    dmPhase:    page.properties["DM Phase"]?.select?.name,
    dmStep:     page.properties["DM Step"]?.number,
    itemStatus: page.properties["Item Status"]?.status?.name,
    bic:        page.properties["Ball In Court"]?.select?.name,
    estProg:    page.properties["Estimated Progress"]?.number,
  };

  console.log("── Write tests ─────────────────────────────────────────");

  await tryWrite(id, "DM Phase (select)",
    { "DM Phase": { select: { name: original.dmPhase || "Agree Scope" } } });

  await tryWrite(id, "DM Step (number)",
    { "DM Step": { number: original.dmStep ?? 0 } });

  await tryWrite(id, "Item Status (status)",
    { "Item Status": { status: { name: original.itemStatus || "Backlog" } } });

  await tryWrite(id, "Ball In Court (select)",
    { "Ball In Court": { select: { name: original.bic || "DM" } } });

  await tryWrite(id, "Estimated Progress (number)",
    { "Estimated Progress": { number: original.estProg ?? 0 } });

  await tryWrite(id, "1st DT Start (Plan) (date)",
    { "1st DT Start (Plan)": { date: null } });

  await tryWrite(id, "1st DT Start (Actual) (date)",
    { "1st DT Start (Actual)": { date: null } });

  await tryWrite(id, "Production Date (Actual) (date)",
    { "Production Date (Actual)": { date: null } });

  await tryWrite(id, "Original Allocation (Hrs) (number)",
    { "Original Allocation (Hrs)": { number: original.estProg ?? null } });

  await tryWrite(id, "Draw Days - DD1 (number)",
    { "Draw Days - DD1": { number: null } });

  await tryWrite(id, "Blocker (multi_select clear)",
    { "Blocker": { multi_select: [] } });

  console.log("\n── Schema check ────────────────────────────────────────");
  try {
    const db = await notion.databases.retrieve({ database_id: DB });
    const props = Object.keys(db.properties).sort();
    const required = [
      "DM Phase", "DM Step", "Item Status", "Ball In Court",
      "Estimated Progress", "1st DT Start (Plan)", "1st DT Start (Actual)",
      "Production Date (Actual)", "Original Allocation (Hrs)", "Draw Days - DD1", "Blocker",
    ];
    for (const r of required) {
      const found = db.properties[r];
      if (found) {
        console.log(`  ✅  "${r}" — type: ${found.type}`);
      } else {
        console.log(`  ❌  "${r}" — NOT FOUND in database schema`);
      }
    }
  } catch (err) {
    console.log("  ❌  Could not retrieve database schema:", err.message);
  }

  console.log("\n────────────────────────────────────────────────────────");
  console.log("Done. Original values were not changed (writes used existing values or null).\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
