// ---------------------------------------------------------------
// Season — "SIH 2026 Season", "Odd Sem 2026 Demo Day" (spec §4, §11).
// A season has a submission window, a judging window, faculty judges,
// a weighted rubric and, once the admin publishes them, winners.
// The phase is derived from the dates — nobody has to flip a switch.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const DEFAULT_CRITERIA = [
  { key: 'innovation', label: 'Innovation', weight: 25 },
  { key: 'impact', label: 'Impact', weight: 25 },
  { key: 'execution', label: 'Technical execution', weight: 30 },
  { key: 'presentation', label: 'Demo & presentation', weight: 20 },
];

const seasonSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name the season'], trim: true, maxlength: 80 },
    slug: { type: String, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]{3,80}$/ },
    kind: { type: String, enum: ['season', 'demo_day'], default: 'season' },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    tracks: { type: [{ type: String, trim: true, maxlength: 40 }], default: ['Software', 'Hardware', 'Research'] },
    submissionOpens: { type: Date, required: true },
    submissionCloses: { type: Date, required: true },
    judgingCloses: { type: Date, required: true },
    demoDayAt: Date,                         // the live event, if any
    venue: { type: String, trim: true, maxlength: 120 },
    judges: [{ type: ObjectId, ref: 'User' }],   // faculty (or admins)
    criteria: {
      type: [{ _id: false, key: String, label: String, weight: { type: Number, min: 0, max: 100 } }],
      default: () => DEFAULT_CRITERIA,
    },
    winners: [{
      _id: false,
      project: { type: ObjectId, ref: 'Project' },
      track: String,
      award: { type: String, trim: true, maxlength: 60 },   // "Winner", "Runner-up", "Best social impact"
      rank: Number,
    }],
    resultsPublishedAt: Date,
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

seasonSchema.pre('validate', async function () {
  if (this.submissionOpens && this.submissionCloses && this.submissionOpens >= this.submissionCloses) {
    this.invalidate('submissionCloses', 'Submissions must close after they open');
  }
  if (this.submissionCloses && this.judgingCloses && this.submissionCloses > this.judgingCloses) {
    this.invalidate('judgingCloses', 'Judging must end after submissions close');
  }
  const sum = (this.criteria || []).reduce((s, c) => s + (c.weight || 0), 0);
  if (sum !== 100) this.invalidate('criteria', `Rubric weights must add up to 100 (now ${sum})`);
  if (!this.slug && this.isSelected('slug')) {
    const base = (this.name || 'season').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).padEnd(3, '0');
    let candidate = base;
    for (let n = 2; await this.constructor.exists({ slug: candidate }); n++) candidate = `${base}-${n}`;
    this.slug = candidate;
  }
});

// upcoming -> open (submissions) -> judging -> closed (awaiting results) -> results
seasonSchema.methods.phase = function (now = new Date()) {
  if (this.resultsPublishedAt) return 'results';
  if (now < this.submissionOpens) return 'upcoming';
  if (now <= this.submissionCloses) return 'open';
  if (now <= this.judgingCloses) return 'judging';
  return 'closed';
};

seasonSchema.statics.DEFAULT_CRITERIA = DEFAULT_CRITERIA;

module.exports = mongoose.model('Season', seasonSchema, 'seasons');
