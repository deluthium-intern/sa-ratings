function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function gradeFromScore(score) {
  if (score >= 96) return "AAA";
  if (score >= 92) return "AA+";
  if (score >= 88) return "AA";
  if (score >= 84) return "AA-";
  if (score >= 80) return "A+";
  if (score >= 76) return "A";
  if (score >= 72) return "A-";
  if (score >= 68) return "BBB+";
  if (score >= 64) return "BBB";
  if (score >= 60) return "BBB-";
  if (score >= 56) return "BB+";
  if (score >= 52) return "BB";
  if (score >= 48) return "BB-";
  if (score >= 44) return "B+";
  if (score >= 40) return "B";
  if (score >= 36) return "B-";
  if (score >= 30) return "CCC";
  if (score >= 24) return "CC";
  if (score >= 16) return "C";
  return "D";
}

function feeMultiplierFromGrade(grade) {
  const map = {
    AAA: 1.0,
    "AA+": 1.02,
    AA: 1.04,
    "AA-": 1.06,
    "A+": 1.08,
    A: 1.1,
    "A-": 1.12,
    "BBB+": 1.2,
    BBB: 1.3,
    "BBB-": 1.4,
    "BB+": 1.5,
    BB: 1.55,
    "BB-": 1.6,
    "B+": 1.7,
    B: 1.8,
    "B-": 1.9,
    CCC: 2.0,
    CC: 2.1,
    C: 2.2,
    D: 2.5
  };
  return map[grade] || 2.5;
}

function getOutlook(score, driftIndex, latencyMs, paymentDefaulted) {
  if (paymentDefaulted || score < 35 || driftIndex > 0.2 || latencyMs > 1000) {
    return "Negative";
  }
  if (score >= 88 && driftIndex < 0.03 && latencyMs < 100) {
    return "Positive";
  }
  return "Stable";
}

function evaluateRating(metrics) {
  const latencyMs = Number(metrics.x402_latency_ms || 0);
  const driftIndex = Number(metrics.strategy_drift_index || 1);
  const paymentDefaulted = Boolean(metrics.payment_defaulted);

  const latencyScore = clamp(100 - latencyMs / 10, 0, 100);
  const driftScore = clamp(100 - driftIndex * 260, 0, 100);
  const baseScore = latencyScore * 0.45 + driftScore * 0.55;

  let score = baseScore;
  let reason = "Balanced strategy audit profile.";

  if (paymentDefaulted) {
    score = Math.min(score, 8);
    reason = "X402 default detected.";
  } else if (driftIndex > 0.2) {
    score = Math.min(score, 18);
    reason = "Severe strategy drift detected.";
  } else if (driftIndex > 0.1) {
    score = Math.min(score, 42);
    reason = "Elevated strategy drift risk.";
  } else if (latencyMs > 500) {
    score = Math.min(score, 58);
    reason = "Payment latency deterioration.";
  }

  score = Number(clamp(score, 0, 100).toFixed(2));
  const grade = gradeFromScore(score);
  const feeMultiplier = feeMultiplierFromGrade(grade);
  const outlook = getOutlook(score, driftIndex, latencyMs, paymentDefaulted);

  return {
    score,
    grade,
    outlook,
    feeMultiplier,
    reason
  };
}

module.exports = {
  evaluateRating,
  gradeFromScore,
  feeMultiplierFromGrade
};
