// Express 4 does not catch errors thrown in async handlers.
// wrap(controller) returns the same handlers, each forwarding errors to next().
const wrap = (controller) =>
  Object.fromEntries(
    Object.entries(controller).map(([name, fn]) => [
      name,
      typeof fn === 'function' ? (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next) : fn,
    ])
  );

module.exports = wrap;
