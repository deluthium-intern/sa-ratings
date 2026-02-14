const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../src/db/pool");

async function run() {
  const filePath = path.resolve(__dirname, "../src/db/schema.sql");
  const sql = await fs.readFile(filePath, "utf8");
  await pool.query(sql);
  console.log("Migration completed.");
}

run()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
