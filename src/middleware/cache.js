const cacheStore = new Map();

function buildKey(req) {
  const url = req.originalUrl || req.url || "";
  return `${req.method}:${url}`;
}

function withCache(ttlMs) {
  return (req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    const key = buildKey(req);
    const now = Date.now();
    const cached = cacheStore.get(key);

    if (cached && cached.expiresAt > now) {
      return res.json(cached.payload);
    }

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      cacheStore.set(key, {
        payload,
        expiresAt: now + ttlMs
      });
      return originalJson(payload);
    };

    return next();
  };
}

module.exports = {
  withCache
};
