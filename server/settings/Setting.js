// ---------------------------------------------------------------
// Settings — one document (key "global") the college can tune
// without a code change. P1: Lab Score weights + job bookkeeping.
// Spec §5: "Weights live in tenant config so the college can tune them."
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const DEFAULT_WEIGHTS = {
  understanding: 35,   // Lotus Blossom + viva (P2)
  build: 15,           // GitHub activity
  works: 15,           // live URL uptime
  community: 15,       // backers, followers, views
  recognition: 15,     // competitions, stage, confirmed pilots
  freshness: 5,        // updates in the last 60 days
};

const weight = { type: Number, min: 0, max: 100 };

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'global' },
    scoreWeights: Object.fromEntries(Object.entries(DEFAULT_WEIGHTS).map(([k, v]) => [k, { ...weight, default: v }])),
    jobs: {
      dailyChecksAt: Date,   // last time the daily checks finished
    },
  },
  { timestamps: true }
);

// Weights must add up to 100 so the Lab Score stays 0–100
settingSchema.pre('validate', function () {
  const sum = Object.keys(DEFAULT_WEIGHTS).reduce((s, k) => s + (Number(this.scoreWeights?.[k]) || 0), 0);
  if (sum !== 100) this.invalidate('scoreWeights', `Score weights must add up to 100 (now ${sum})`);
});

// Always returns the single settings doc, creating it with defaults the first time
settingSchema.statics.get = async function () {
  return (await this.findOne({ key: 'global' })) || this.create({ key: 'global' });
};

settingSchema.statics.DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;

module.exports = mongoose.model('Setting', settingSchema, 'settings');
