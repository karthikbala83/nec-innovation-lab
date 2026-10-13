// ---------------------------------------------------------------
// MetricDaily — one row per project per day: views (for Trending)
// and the daily live-URL check (for uptime in the Lab Score).
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const metricDailySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    date: { type: Date, required: true },   // midnight UTC
    views: { type: Number, default: 0 },
    // daily live URL check (null = not checked that day)
    uptimeOk: { type: Boolean, default: null },
    status: Number,
  },
  { timestamps: false }
);

metricDailySchema.index({ project: 1, date: -1 }, { unique: true });
metricDailySchema.index({ date: -1 });

const today = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

// Record today's live check
metricDailySchema.statics.recordCheck = function (projectId, ok, status) {
  return this.updateOne({ project: projectId, date: today() }, { $set: { uptimeOk: ok, status } }, { upsert: true });
};

// Fire-and-forget view counter
metricDailySchema.statics.addView = function (projectId) {
  return this.updateOne({ project: projectId, date: today() }, { $inc: { views: 1 } }, { upsert: true });
};

module.exports = mongoose.model('MetricDaily', metricDailySchema, 'metricsDaily');
