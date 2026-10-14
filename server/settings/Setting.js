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
    // Lotus API usage this month (free NEC quota at Saravonix; LOTUS_MONTHLY_QUOTA)
    lotusUsage: {
      month: String,         // "2026-10"
      generated: { type: Number, default: 0 },   // question sets requested
      scored: { type: Number, default: 0 },      // answer sets scored
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

// Count one Lotus call against this month's quota. Throws 429 when the quota is used up.
// Atomic: two students starting at once can't both slip past the limit.
settingSchema.statics.useLotusQuota = async function (kind) {
  const month = new Date().toISOString().slice(0, 7);
  const quota = Number(process.env.LOTUS_MONTHLY_QUOTA || 500);
  await this.get();
  await this.updateOne({ key: 'global', 'lotusUsage.month': { $ne: month } },
    { $set: { lotusUsage: { month, generated: 0, scored: 0 } } });
  const field = `lotusUsage.${kind}`;
  const ok = await this.findOneAndUpdate(
    { key: 'global', 'lotusUsage.month': month, [field]: { $lt: quota } },
    { $inc: { [field]: 1 } },
    { new: true }
  );
  if (!ok) throw Object.assign(new Error('This month\'s Lotus quota for the college is used up. Ask the admin.'), { status: 429 });
  return ok.lotusUsage;
};

settingSchema.statics.DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;

module.exports = mongoose.model('Setting', settingSchema, 'settings');
