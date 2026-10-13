// Heartbeat: every authenticated API call refreshes the session's
// lastActiveAt. This is what makes the admin dashboard "live".
const Session = require('../models/Session');
const { protect } = require('./auth');

const touch = async (req, res, next) => {
  if (req.sessionId) {
    // fire and forget — don't slow the request down
    Session.findByIdAndUpdate(req.sessionId, { lastActiveAt: new Date() }).catch(() => {});
  }
  next();
};

// protect first (decodes token), then touch the session
module.exports = [protect, touch];
