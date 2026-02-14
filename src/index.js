const express = require("express");
const path = require("node:path");
const fs = require("node:fs/promises");
const env = require("./config/env");
const pool = require("./db/pool");
const apiRouter = require("./routes/api");
const { startAuditWorker } = require("./workers/auditWorker");

async function ensureSchema() {
  const schemaPath = path.resolve(__dirname, "./db/schema.sql");
  const sql = await fs.readFile(schemaPath, "utf8");
  await pool.query(sql);
}

async function start() {
  await ensureSchema();

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use(apiRouter);
  app.use(express.static(path.resolve(__dirname, "../public")));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/") || req.path === "/health") {
      return res.status(404).json({ error: "Not found" });
    }
    return res.sendFile(path.resolve(__dirname, "../public/index.html"));
  });

  app.use((error, _req, res, _next) => {
    console.error("[Server]", error);
    res.status(500).json({ error: "Internal server error", detail: error.message });
  });

  app.listen(env.port, () => {
    console.log(`S&A Ratings server listening on :${env.port}`);
  });

  startAuditWorker();
}

start().catch((error) => {
  console.error("Bootstrap failed:", error);
  process.exit(1);
});
