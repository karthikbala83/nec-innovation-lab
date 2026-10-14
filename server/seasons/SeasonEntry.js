// ---------------------------------------------------------------
// SeasonEntry — a published project entered into a season, and the
// judges' rubric scores. Scores and comments are private to judges,
// admins and (after results) the team; the public sees entries and
// the winners wall.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const scoreSchema = new mongoose.Schema(
  {
    judge: { type: ObjectId, ref: 'User', required: true },
    marks: { type: Map, of: { type: Number, min: 0, max: 10 } },   // criterion key -> 0..10
    total: Number,                                                 // weighted, 0..100
    comment: { type: String, trim: true, maxlength: 1000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const seasonEntrySchema = new mongoose.Schema(
  {
    season: { type: ObjectId, ref: 'Season', required: true },
    project: { type: ObjectId, ref: 'Project', required: true },
    track: { type: String, required: true, trim: true },
    enteredBy: { type: ObjectId, ref: 'User' },
    pitch: { type: String, trim: true, maxlength: 280 },   // one line for the judges
    scores: [scoreSchema],
    average: { type: Number, default: null },               // mean of judges' totals
  },
  { timestamps: true }
);

seasonEntrySchema.index({ season: 1, project: 1 }, { unique: true });
seasonEntrySchema.index({ season: 1, track: 1, average: -1 });

// Weighted total for one judge: Σ (mark/10 × weight)
seasonEntrySchema.statics.weightedTotal = (marks, criteria) =>
  Math.round(criteria.reduce((s, c) => s + ((Number(marks[c.key]) || 0) / 10) * c.weight, 0) * 10) / 10;

module.exports = mongoose.model('SeasonEntry', seasonEntrySchema, 'seasonEntries');
