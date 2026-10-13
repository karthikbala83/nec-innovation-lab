// ---------------------------------------------------------------
// MetricDaily — one row per project per day. P0 counts views (for
// Trending); P1 adds backers, uptime and commits for the Lab Score.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const metricDailySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    date: { type: Date, required: true },   // midnight UTC
    views: { type: Number, default: 0 },
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

// Fire-and-forget view counter
metricDailySchema.statics.addView = function (projectId) {
  return this.updateOne({ project: projectId, date: today() }, { $inc: { views: 1 } }, { upsert: true });
};

module.exports = mongoose.model('MetricDaily', metricDailySchema, 'metricsDaily');
