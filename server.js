// server.js — Local development server only.
// For production (Netlify), the app is served via netlify/functions/api.js.

require("dotenv").config();
const { app, ensureNotionSchema } = require("./app");

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n✅ Workflow Tracker running at http://localhost:${PORT}`);
  console.log(`   Tasks DB : ${process.env.NOTION_DB_TASKS}`);
  console.log(`   Projects : ${process.env.NOTION_DB_PROJECTS}`);
  console.log(`   Token    : ${process.env.NOTION_TOKEN ? "set ✓" : "MISSING ✗"}\n`);
  await ensureNotionSchema();
});
