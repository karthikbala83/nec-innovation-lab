// ---------------------------------------------------------------
// Tiny in-memory rate limiter for the public endpoints (likes, email
// codes, feedback). Fine for one API instance on Railway; if the API is
// ever scaled to several instances, move the counters to Mongo/Redis.
//   rateLimit({ key: (req) => req.ip, max: 10, windowMs: 3600e3, message })
// ---------------------------------------------------------------
const buckets = new Map();   // name -> Map(key -> { count, resetAt })

const hit = (name, key, max, windowMs) => {
  if (!buckets.has(name)) buckets.set(name, new Map());
  const b = buckets.get(name);
  const now = Date.now();
  const entry = b.get(key);
  if (!entry || entry.resetAt <= now) {
    b.set(key, { count: 1, resetAt: now + windowMs });
    if (b.size > 50000) for (const [k, v] of b) if (v.resetAt <= now) b.delete(k);   // tidy up
    return { ok: true };
  }
  entry.count += 1;
  return { ok: entry.count <= max, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
};

const rateLimit = ({ name, key = (req) => req.ip, max, windowMs, message = 'Too many attempts. Try again later.' }) =>
  (req, res, next) => {
    const r = hit(name, key(req), max, windowMs);
    if (r.ok) return next();
    res.set('Retry-After', String(r.retryAfter));
    return res.status(429).json({ message });
  };

module.exports = { rateLimit, hit };
