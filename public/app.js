const elements = {
  searchInput: document.querySelector("#search-input"),
  searchBtn: document.querySelector("#search-btn"),
  searchStatus: document.querySelector("#search-status"),
  agentList: document.querySelector("#agent-list"),
  scorecard: document.querySelector("#scorecard"),
  ticker: document.querySelector("#ticker"),
  leaderboardBody: document.querySelector("#leaderboard-body"),
  verifyOutput: document.querySelector("#verify-output"),
  verifyAgentBtn: document.querySelector("#verify-agent"),
  downloadReportBtn: document.querySelector("#download-report"),
  auditNowBtn: document.querySelector("#audit-now")
};

let selectedAgent = null;

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || "Request failed");
  }
  return json.data;
}

function renderAgentList(agents) {
  if (!agents.length) {
    elements.agentList.innerHTML = `<div class="agent-card">No records found.</div>`;
    return;
  }

  elements.agentList.innerHTML = agents
    .map(
      (agent) => `
      <button class="agent-card" data-id="${agent.id}">
        <div><strong>${agent.name}</strong></div>
        <div>${agent.wallet_address}</div>
        <div>Grade: ${agent.grade || "UNRATED"} | Fee: ${
          agent.fee_multiplier ? Number(agent.fee_multiplier).toFixed(2) + "x" : "N/A"
        }</div>
      </button>
    `
    )
    .join("");

  document.querySelectorAll(".agent-card[data-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      await loadAgent(node.dataset.id);
    });
  });
}

function renderScorecard(payload) {
  const { agent, rating, metrics, credit_events: events } = payload;
  selectedAgent = agent;
  elements.downloadReportBtn.disabled = false;
  elements.verifyAgentBtn.disabled = false;

  if (!rating || !metrics) {
    elements.scorecard.classList.add("empty");
    elements.scorecard.textContent = "No rating data available yet.";
    return;
  }

  elements.scorecard.classList.remove("empty");
  elements.scorecard.textContent = `
AGENT: ${agent.name}
WALLET: ${agent.wallet_address}
GRADE: ${rating.grade}
OUTLOOK: ${rating.outlook}
FEE MULTIPLIER: ${Number(rating.fee_multiplier).toFixed(2)}x
SCORE: ${Number(rating.score).toFixed(2)}

SOLVENCY (x402_latency_ms): ${metrics.x402_latency_ms}
EXECUTION INTEGRITY (strategy_drift_index): ${Number(metrics.strategy_drift_index).toFixed(4)}
PAYMENT DEFAULTED: ${metrics.payment_defaulted ? "YES" : "NO"}

PERMANENT RECORD:
${events.length ? events.map((item) => `- ${item.event_type} | ${item.reason}`).join("\n") : "- CLEAN"}
  `.trim();
}

function renderTicker(events) {
  const feed = events.length
    ? events
        .map(
          (event) =>
            `[${event.event_type}] ${event.agent_name}: ${event.from_grade || "N/A"} -> ${event.to_grade || "N/A"} (${event.reason})`
        )
        .join("  ||  ")
    : "No sovereign actions recorded.";

  elements.ticker.innerHTML = `${feed}  ||  ${feed}`;
}

function renderLeaderboard(rows) {
  elements.leaderboardBody.innerHTML = rows
    .map(
      (row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${row.name}</td>
        <td>${row.grade}</td>
        <td>${Number(row.fee_multiplier).toFixed(2)}x</td>
        <td>${Number(row.score).toFixed(2)}</td>
      </tr>
    `
    )
    .join("");
}

async function searchAgents() {
  const query = elements.searchInput.value.trim();
  elements.searchStatus.textContent = "Retrieving case files...";
  const agents = await api(`/api/v1/agents?query=${encodeURIComponent(query)}`);
  renderAgentList(agents);
  elements.searchStatus.textContent = `Retrieved ${agents.length} case file(s).`;
}

async function loadAgent(id) {
  const payload = await api(`/api/v1/agents/${encodeURIComponent(id)}`);
  renderScorecard(payload);
}

async function refreshTickerAndBoard() {
  const [feed, board] = await Promise.all([api("/api/v1/feed"), api("/api/v1/leaderboard")]);
  renderTicker(feed);
  renderLeaderboard(board);
}

elements.searchBtn.addEventListener("click", () => {
  searchAgents().catch((error) => {
    elements.searchStatus.textContent = error.message;
  });
});

elements.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchAgents().catch((error) => {
      elements.searchStatus.textContent = error.message;
    });
  }
});

elements.verifyAgentBtn.addEventListener("click", async () => {
  if (!selectedAgent) {
    return;
  }
  try {
    const payload = await api(`/api/v1/verify/${encodeURIComponent(selectedAgent.id)}`);
    elements.verifyOutput.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    elements.verifyOutput.textContent = `Verification failed: ${error.message}`;
  }
});

elements.downloadReportBtn.addEventListener("click", () => {
  if (!selectedAgent) {
    return;
  }
  window.open(`/api/v1/report/${encodeURIComponent(selectedAgent.id)}.pdf`, "_blank");
});

elements.auditNowBtn.addEventListener("click", async () => {
  try {
    await api("/api/v1/audit/run", { method: "POST" });
    await refreshTickerAndBoard();
    if (selectedAgent) {
      await loadAgent(selectedAgent.id);
    }
  } catch (error) {
    elements.verifyOutput.textContent = `Audit run failed: ${error.message}`;
  }
});

async function init() {
  await Promise.all([searchAgents(), refreshTickerAndBoard()]);
}

setInterval(() => {
  refreshTickerAndBoard().catch(() => {
    // Intentionally silent in passive refresh loop.
  });
}, 10_000);

init().catch((error) => {
  elements.searchStatus.textContent = `Bootstrap error: ${error.message}`;
});
