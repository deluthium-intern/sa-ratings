const rateLimit = require("express-rate-limit");

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for agent search." }
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for verify endpoint." }
});

module.exports = {
  searchLimiter,
  verifyLimiter
};
