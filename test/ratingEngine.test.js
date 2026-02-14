const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateRating } = require("../src/services/ratingEngine");

test("assigns AAA with low latency and low drift", () => {
  const result = evaluateRating({
    x402_latency_ms: 30,
    strategy_drift_index: 0.005,
    payment_defaulted: false
  });

  assert.equal(result.grade, "AAA");
  assert.equal(result.feeMultiplier, 1.0);
  assert.equal(result.outlook, "Positive");
});

test("penalizes severe drift into low grades", () => {
  const result = evaluateRating({
    x402_latency_ms: 80,
    strategy_drift_index: 0.23,
    payment_defaulted: false
  });

  assert.equal(result.grade, "C");
  assert.equal(result.outlook, "Negative");
});

test("forces D grade when payment default is true", () => {
  const result = evaluateRating({
    x402_latency_ms: 20,
    strategy_drift_index: 0.01,
    payment_defaulted: true
  });

  assert.equal(result.grade, "D");
  assert.equal(result.feeMultiplier, 2.5);
  assert.equal(result.outlook, "Negative");
});

test("keeps BBB band for moderate deterioration profile", () => {
  const result = evaluateRating({
    x402_latency_ms: 520,
    strategy_drift_index: 0.08,
    payment_defaulted: false
  });

  assert.ok(["BBB-", "BB+", "BB"].includes(result.grade));
  assert.ok(result.feeMultiplier >= 1.4);
});
