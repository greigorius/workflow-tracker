// netlify/functions/api.js
// Wraps the Express app as a Netlify serverless function.

const serverless = require("serverless-http");
const { app, ensureNotionSchema } = require("../../app");

// Run schema migration once per cold start (non-blocking)
ensureNotionSchema().catch((e) => console.warn("Schema check:", e.message));

module.exports.handler = serverless(app);
