const cron = require("node-cron");
const env = require("../config/env");
const { runAuditCycle } = require("../services/auditService");

function startAuditWorker() {
  const task = cron.schedule(env.auditCron, async () => {
    try {
      const output = await runAuditCycle();
      console.log(`[AuditWorker] cycle complete (${output.length} agents).`);
    } catch (error) {
      console.error("[AuditWorker] cycle failed:", error.message);
    }
  });

  return task;
}

module.exports = {
  startAuditWorker
};
