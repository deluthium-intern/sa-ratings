CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  x402_latency_ms INTEGER NOT NULL CHECK (x402_latency_ms >= 0),
  strategy_drift_index NUMERIC(6, 4) NOT NULL CHECK (strategy_drift_index >= 0 AND strategy_drift_index <= 1),
  payment_defaulted BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES metrics(id) ON DELETE RESTRICT,
  grade TEXT NOT NULL,
  outlook TEXT NOT NULL,
  score NUMERIC(6, 2) NOT NULL,
  fee_multiplier NUMERIC(4, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, metric_id)
);

CREATE TABLE IF NOT EXISTS credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  rating_id UUID REFERENCES ratings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_grade TEXT,
  to_grade TEXT,
  reason TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_agent_captured_at ON metrics(agent_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_agent_created_at ON ratings(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_events_agent_created_at ON credit_events(agent_id, created_at DESC);
