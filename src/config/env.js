const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  moltbookApiBase: process.env.MOLTBOOK_API_BASE || "https://www.moltbook.com/api/v1",
  moltbookApiKey: process.env.MOLTBOOK_API_KEY || "",
  moltbookSubmolt: process.env.MOLTBOOK_SUBMOLT || "general",
  onchainApiUrl: process.env.ONCHAIN_API_URL || "",
  onchainApiKey: process.env.ONCHAIN_API_KEY || "",
  enableBroadcaster: process.env.ENABLE_BROADCASTER !== "false",
  auditCron: process.env.AUDIT_CRON || "*/2 * * * *",
  feedLimit: Number(process.env.FEED_LIMIT || 30)
};

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

module.exports = env;
