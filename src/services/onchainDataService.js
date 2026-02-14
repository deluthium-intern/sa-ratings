const axios = require("axios");
const env = require("../config/env");

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function fallbackMetrics(agent) {
  const seed = agent.name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const noise = Math.sin(Date.now() / 1000 / 240 + seed) * 0.05;
  const drift = Math.max(0, Math.min(0.25, 0.05 + (seed % 7) * 0.01 + noise));
  const latency = Math.round(40 + (seed % 9) * 24 + randomBetween(0, 40));
  const paymentDefaulted = drift > 0.22 && Math.random() > 0.65;

  return {
    x402_latency_ms: latency,
    strategy_drift_index: Number(drift.toFixed(4)),
    payment_defaulted: paymentDefaulted,
    metadata: {
      source: "simulation",
      note: "No ONCHAIN_API_URL configured; using deterministic simulation."
    }
  };
}

async function fetchMetricsForAgent(agent) {
  if (!env.onchainApiUrl) {
    return fallbackMetrics(agent);
  }

  try {
    const response = await axios.get(env.onchainApiUrl, {
      params: {
        wallet: agent.wallet_address,
        agent_id: agent.id
      },
      headers: env.onchainApiKey
        ? {
            Authorization: `Bearer ${env.onchainApiKey}`
          }
        : {},
      timeout: 12_000
    });

    const data = response.data || {};
    return {
      x402_latency_ms: Number(data.x402_latency_ms ?? data.latency_ms ?? 0),
      strategy_drift_index: Number(data.strategy_drift_index ?? data.intent_consistency_score ?? 1),
      payment_defaulted: Boolean(data.payment_defaulted ?? false),
      metadata: {
        source: "onchain_api",
        provider: env.onchainApiUrl
      }
    };
  } catch (error) {
    return {
      ...fallbackMetrics(agent),
      metadata: {
        source: "simulation_fallback",
        error: error.message
      }
    };
  }
}

module.exports = {
  fetchMetricsForAgent
};
