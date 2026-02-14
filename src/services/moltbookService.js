const axios = require("axios");
const env = require("../config/env");

async function postDecree({ agentName, previousGrade, currentGrade, feeMultiplier, reason }) {
  if (!env.enableBroadcaster || !env.moltbookApiKey) {
    return { skipped: true, reason: "Broadcaster disabled or missing API key." };
  }

  const movement = previousGrade ? `${previousGrade} -> ${currentGrade}` : `INIT -> ${currentGrade}`;
  const content = `[DECREE] S&A Ratings has issued a sovereign action for ${agentName}. Grade: ${movement}. Risk premium active at ${feeMultiplier.toFixed(
    2
  )}x. Reason: ${reason}`;

  const response = await axios.post(
    `${env.moltbookApiBase}/posts`,
    {
      submolt: env.moltbookSubmolt,
      title: `S&A Sovereign Action: ${agentName}`,
      content
    },
    {
      headers: {
        Authorization: `Bearer ${env.moltbookApiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 10_000
    }
  );

  return response.data;
}

module.exports = {
  postDecree
};
