const pool = require("../src/db/pool");

const AGENTS = [
  {
    name: "Agent_Atlas",
    walletAddress: "0xAtlas000000000000000000000000000000000001",
    description: "High-frequency liquidity optimizer."
  },
  {
    name: "Agent_Borealis",
    walletAddress: "0xBorea00000000000000000000000000000000002",
    description: "Cross-market arbitrage execution agent."
  },
  {
    name: "Agent_Cinder",
    walletAddress: "0xCinde00000000000000000000000000000000003",
    description: "Directional momentum strategy with leverage."
  }
];

async function run() {
  for (const agent of AGENTS) {
    await pool.query(
      `
      INSERT INTO agents (name, wallet_address, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (wallet_address) DO UPDATE
      SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = NOW();
      `,
      [agent.name, agent.walletAddress, agent.description]
    );
  }

  console.log("Seed completed.");
}

run()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
