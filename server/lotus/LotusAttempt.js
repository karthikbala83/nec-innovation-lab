// ---------------------------------------------------------------
// LotusAttempt — a student's answers to a LotusSet, the scores, and
// the faculty viva. ANSWERS ARE NEVER PUBLIC (spec §7): only the
// student, the project mentor and admins can read them. The public
// page sees petals filled + "Viva by Dr. X on <date>".
// ---------------------------------------------------------------
const mongoose = require('mongoose');
const LotusSet = require('./LotusSet');

const { ObjectId } = mongoose.Schema.Types;
const FILLED_AT = 0.5;   // a petal is "filled" at 50% of its possible points

const answerSchema = new mongoose.Schema(
  {
    qid: { type: String, required: true },
    answer: { type: String, maxlength: [3000, 'Answers: 3000 characters max'], default: '' },
    aiScore: { type: Number, min: 0, max: 3 },
    aiFeedback: { type: String, maxlength: 500 },
    mentorScore: { type: Number, min: 0, max: 3 },   // override wins over the AI score
    mentorNote: { type: String, maxlength: 500 },
  },
  { _id: false }
);

const lotusAttemptSchema = new mongoose.Schema(
  {
    set: { type: ObjectId, ref: 'LotusSet', required: true, unique: true },
    project: { type: ObjectId, ref: 'Project', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    answers: [answerSchema],
    status: { type: String, enum: ['in_progress', 'scoring', 'scored', 'failed'], default: 'in_progress' },
    error: String,
    submittedAt: Date,
    scoredAt: Date,
    viva: {
      done: { type: Boolean, default: false },
      by: { type: ObjectId, ref: 'User' },
      at: Date,
      note: { type: String, maxlength: 1000 },   // private to student + faculty
    },
    // Cached summary (recomputed on every score change) — safe to show publicly
    summary: {
      percent: { type: Number, default: 0 },     // weighted score 0–100
      petalsFilled: { type: Number, default: 0 },
      petals: [{ _id: false, petal: Number, percent: Number, filled: Boolean }],
    },
  },
  { timestamps: true }
);

lotusAttemptSchema.index({ project: 1, user: 1 });

// Final score for a question: mentor override, else AI
const finalScore = (a) => (a?.mentorScore ?? a?.aiScore ?? 0);

// Weighted score per petal: Σ level weight × score / Σ level weight × 3
lotusAttemptSchema.statics.summarise = (questions, answers) => {
  const byQ = new Map(answers.map((a) => [a.qid, a]));
  const petals = [];
  let got = 0;
  let max = 0;
  for (let petal = 1; petal <= 8; petal++) {
    const qs = questions.filter((q) => q.petal === petal);
    if (!qs.length) continue;
    const pMax = qs.reduce((s, q) => s + LotusSet.LEVEL_WEIGHT[q.level] * 3, 0);
    const pGot = qs.reduce((s, q) => s + LotusSet.LEVEL_WEIGHT[q.level] * finalScore(byQ.get(q.qid)), 0);
    got += pGot;
    max += pMax;
    petals.push({ petal, percent: Math.round((pGot / pMax) * 100), filled: pGot / pMax >= FILLED_AT });
  }
  return {
    percent: max ? Math.round((got / max) * 100) : 0,
    petalsFilled: petals.filter((p) => p.filled).length,
    petals,
  };
};

lotusAttemptSchema.statics.finalScore = finalScore;

module.exports = mongoose.model('LotusAttempt', lotusAttemptSchema, 'lotusAttempts');
