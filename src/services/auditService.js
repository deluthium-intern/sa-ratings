const pool = require("../db/pool");
const { fetchMetricsForAgent } = require("./onchainDataService");
const { evaluateRating } = require("./ratingEngine");
const { isDowngrade } = require("../utils/grades");
const { postDecree } = require("./moltbookService");

async function recordCreditEvent(client, event) {
  await client.query(
    `
    INSERT INTO credit_events (agent_id, rating_id, event_type, from_grade, to_grade, reason, payload)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      event.agentId,
      event.ratingId || null,
      event.eventType,
      event.fromGrade || null,
      event.toGrade || null,
      event.reason,
      JSON.stringify(event.payload || {})
    ]
  );
}

async function auditAgent(agent) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const metrics = await fetchMetricsForAgent(agent);

    const metricResult = await client.query(
      `
      INSERT INTO metrics (agent_id, x402_latency_ms, strategy_drift_index, payment_defaulted, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING *;
      `,
      [
        agent.id,
        metrics.x402_latency_ms,
        metrics.strategy_drift_index,
        metrics.payment_defaulted,
        JSON.stringify(metrics.metadata || {})
      ]
    );
    const metric = metricResult.rows[0];

    const rating = evaluateRating(metric);

    const previousResult = await client.query(
      `
      SELECT * FROM ratings
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [agent.id]
    );
    const previous = previousResult.rows[0] || null;

    const insertedRatingResult = await client.query(
      `
      INSERT INTO ratings (agent_id, metric_id, grade, outlook, score, fee_multiplier, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
      `,
      [agent.id, metric.id, rating.grade, rating.outlook, rating.score, rating.feeMultiplier, rating.reason]
    );

    const current = insertedRatingResult.rows[0];

    await client.query(
      `
      UPDATE agents
      SET updated_at = NOW()
      WHERE id = $1
      `,
      [agent.id]
    );

    if (!previous) {
      await recordCreditEvent(client, {
        agentId: agent.id,
        ratingId: current.id,
        eventType: "INITIATION",
        toGrade: current.grade,
        reason: "Initial sovereign rating recorded.",
        payload: {
          fee_multiplier: Number(current.fee_multiplier)
        }
      });
    } else if (previous.grade !== current.grade) {
      const downgrade = isDowngrade(previous.grade, current.grade);
      await recordCreditEvent(client, {
        agentId: agent.id,
        ratingId: current.id,
        eventType: downgrade ? "DOWNGRADE" : "UPGRADE",
        fromGrade: previous.grade,
        toGrade: current.grade,
        reason: rating.reason,
        payload: {
          previous_fee_multiplier: Number(previous.fee_multiplier),
          current_fee_multiplier: Number(current.fee_multiplier)
        }
      });
    }

    if (metric.payment_defaulted || current.grade === "D") {
      await recordCreditEvent(client, {
        agentId: agent.id,
        ratingId: current.id,
        eventType: "DEFAULT",
        fromGrade: previous?.grade || null,
        toGrade: current.grade,
        reason: "X402 settlement default detected.",
        payload: {
          strategy_drift_index: Number(metric.strategy_drift_index)
        }
      });
    }

    await client.query("COMMIT");

    if (!previous || previous.grade !== current.grade) {
      try {
        await postDecree({
          agentName: agent.name,
          previousGrade: previous?.grade || null,
          currentGrade: current.grade,
          feeMultiplier: Number(current.fee_multiplier),
          reason: rating.reason
        });
      } catch (error) {
        console.error("[Broadcaster] Failed to post decree:", error.message);
      }
    }

    return {
      agentId: agent.id,
      grade: current.grade,
      outlook: current.outlook,
      feeMultiplier: Number(current.fee_multiplier)
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function runAuditCycle() {
  const result = await pool.query("SELECT * FROM agents ORDER BY name ASC");
  const outputs = [];
  for (const agent of result.rows) {
    const output = await auditAgent(agent);
    outputs.push(output);
  }
  return outputs;
}

module.exports = {
  auditAgent,
  runAuditCycle
};
