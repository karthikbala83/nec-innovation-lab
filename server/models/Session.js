// ---------------------------------------------------------------
// Session — powers the LIVE admin dashboard.
// One doc per login. lastActiveAt is refreshed on every API call
// by trackActivity middleware. "Active user" = lastActiveAt
// within the last 5 minutes.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    loginAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now, index: true },
    logoutAt: { type: Date, default: null },
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
