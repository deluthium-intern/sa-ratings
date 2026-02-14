const express = require("express");
const pool = require("../db/pool");
const env = require("../config/env");
const { generateSovereignReport } = require("../services/pdfReportService");
const { runAuditCycle } = require("../services/auditService");
const { getGradeRank } = require("../utils/grades");
const { searchLimiter, verifyLimiter } = require("../middleware/rateLimit");
const { withCache } = require("../middleware/cache");

const router = express.Router();

router.get("/health", async (_, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", database: "reachable" });
  } catch (error) {
    res.status(503).json({ status: "degraded", database: "unreachable", error: error.message });
  }
});

router.get("/api/v1/agents", searchLimiter, async (req, res, next) => {
  try {
    const query = String(req.query.query || "").trim();
    if (!query) {
      const result = await pool.query(
        `
        SELECT a.id, a.name, a.wallet_address, a.description, r.grade, r.outlook, r.fee_multiplier, r.score, r.created_at AS rated_at
        FROM agents a
        LEFT JOIN LATERAL (
          SELECT *
          FROM ratings r
          WHERE r.agent_id = a.id
          ORDER BY r.created_at DESC
          LIMIT 1
        ) r ON TRUE
        ORDER BY a.name ASC
        LIMIT 100
        `
      );
      return res.json({ data: result.rows });
    }

    const result = await pool.query(
      `
      SELECT a.id, a.name, a.wallet_address, a.description, r.grade, r.outlook, r.fee_multiplier, r.score, r.created_at AS rated_at
      FROM agents a
      LEFT JOIN LATERAL (
        SELECT *
        FROM ratings r
        WHERE r.agent_id = a.id
        ORDER BY r.created_at DESC
        LIMIT 1
      ) r ON TRUE
      WHERE a.name ILIKE $1 OR a.wallet_address ILIKE $1 OR a.id::text ILIKE $1
      ORDER BY a.name ASC
      LIMIT 50
      `,
      [`%${query}%`]
    );

    return res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/api/v1/agents/:id", async (req, res, next) => {
  try {
    const id = req.params.id;

    const agentResult = await pool.query(
      `
      SELECT id, name, wallet_address, description, created_at, updated_at
      FROM agents
      WHERE id::text = $1 OR wallet_address = $1 OR name = $1
      LIMIT 1
      `,
      [id]
    );
    const agent = agentResult.rows[0];
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const [latestRatingResult, latestMetricsResult, eventsResult] = await Promise.all([
      pool.query(
        `
        SELECT *
        FROM ratings
        WHERE agent_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [agent.id]
      ),
      pool.query(
        `
        SELECT *
        FROM metrics
        WHERE agent_id = $1
        ORDER BY captured_at DESC
        LIMIT 1
        `,
        [agent.id]
      ),
      pool.query(
        `
        SELECT *
        FROM credit_events
        WHERE agent_id = $1
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [agent.id]
      )
    ]);

    return res.json({
      data: {
        agent,
        rating: latestRatingResult.rows[0] || null,
        metrics: latestMetricsResult.rows[0] || null,
        credit_events: eventsResult.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/v1/feed", withCache(10_000), async (_, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT
        ce.id,
        ce.event_type,
        ce.reason,
        ce.from_grade,
        ce.to_grade,
        ce.created_at,
        a.name AS agent_name
      FROM credit_events ce
      JOIN agents a ON a.id = ce.agent_id
      ORDER BY ce.created_at DESC
      LIMIT $1
      `,
      [env.feedLimit]
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/api/v1/leaderboard", withCache(10_000), async (_, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT
        a.id,
        a.name,
        a.wallet_address,
        r.grade,
        r.outlook,
        r.score,
        r.fee_multiplier,
        r.created_at
      FROM agents a
      JOIN LATERAL (
        SELECT *
        FROM ratings r
        WHERE r.agent_id = a.id
        ORDER BY r.created_at DESC
        LIMIT 1
      ) r ON TRUE
      `
    );

    const data = result.rows
      .sort((left, right) => {
        const rankDelta = getGradeRank(left.grade) - getGradeRank(right.grade);
        if (rankDelta !== 0) {
          return rankDelta;
        }
        return Number(right.score) - Number(left.score);
      })
      .slice(0, 100);

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get("/api/v1/verify/:id", verifyLimiter, async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      `
      SELECT a.id, a.name, r.grade, r.fee_multiplier, r.outlook, r.created_at
      FROM agents a
      LEFT JOIN LATERAL (
        SELECT *
        FROM ratings r
        WHERE r.agent_id = a.id
        ORDER BY r.created_at DESC
        LIMIT 1
      ) r ON TRUE
      WHERE a.id::text = $1 OR a.wallet_address = $1 OR a.name = $1
      LIMIT 1
      `,
      [id]
    );

    const record = result.rows[0];
    if (!record) {
      return res.status(404).json({ error: "Agent not found" });
    }
    if (!record.grade) {
      return res.status(409).json({ error: "Agent has not been rated yet." });
    }

    const allowed = getGradeRank(record.grade) <= getGradeRank("BBB-");

    return res.json({
      data: {
        allowed,
        grade: record.grade,
        outlook: record.outlook,
        fee_multiplier: Number(record.fee_multiplier),
        rated_at: record.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/v1/report/:id.pdf", async (req, res, next) => {
  try {
    const id = req.params.id;
    const agentResult = await pool.query(
      `
      SELECT *
      FROM agents
      WHERE id::text = $1 OR wallet_address = $1 OR name = $1
      LIMIT 1
      `,
      [id]
    );
    const agent = agentResult.rows[0];
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const [ratingResult, metricsResult, eventsResult] = await Promise.all([
      pool.query(
        "SELECT * FROM ratings WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 1",
        [agent.id]
      ),
      pool.query(
        "SELECT * FROM metrics WHERE agent_id = $1 ORDER BY captured_at DESC LIMIT 1",
        [agent.id]
      ),
      pool.query(
        "SELECT * FROM credit_events WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 20",
        [agent.id]
      )
    ]);

    const rating = ratingResult.rows[0];
    const metrics = metricsResult.rows[0];
    if (!rating || !metrics) {
      return res.status(409).json({ error: "No reportable rating data for this agent." });
    }

    const buffer = await generateSovereignReport({
      agent,
      rating,
      metrics,
      events: eventsResult.rows
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${agent.name}-sovereign-report.pdf"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.post("/api/v1/audit/run", async (_, res, next) => {
  try {
    const output = await runAuditCycle();
    res.json({ data: output });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
