// ---------------------------------------------------------------
// LotusSet — the questions one student got for one project (spec §7).
// Questions come from the Saravonix Lotus API (services/lotusClient.js);
// this repo only stores them. 8 petals × 3 levels, each citing a real
// file path from the repo snapshot.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const PETALS = [
  'Problem & users', 'Architecture', 'Data model', 'API & logic',
  'Frontend', 'Deployment', 'Security', 'Scale & next steps',
];
const LEVEL_WEIGHT = { 1: 1, 2: 2, 3: 3 };   // L1 Explain, L2 Modify, L3 Extend

const questionSchema = new mongoose.Schema(
  {
    qid: { type: String, required: true },        // id from the Lotus API
    petal: { type: Number, min: 1, max: 8, required: true },
    level: { type: Number, min: 1, max: 3, required: true },
    text: { type: String, required: true, maxlength: 2000 },
    filePath: { type: String, required: true },   // must exist in the snapshot tree
  },
  { _id: false }
);

const lotusSetSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    snapshotSha: String,                          // repo commit the questions are about
    externalId: String,                           // set id on the Lotus API
    status: { type: String, enum: ['generating', 'ready', 'failed'], default: 'generating' },
    error: String,
    questions: [questionSchema],
    dropped: { type: Number, default: 0 },        // questions rejected (cited a file not in the repo)
    mock: { type: Boolean, default: false },      // produced by the dev mock, not the real API
    generatedAt: Date,
    active: { type: Boolean, default: true },     // a mentor reset makes the old set inactive
  },
  { timestamps: true }
);

// One active set per student per project
lotusSetSchema.index({ project: 1, user: 1, active: 1 });

Object.assign(lotusSetSchema.statics, { PETALS, LEVEL_WEIGHT });

module.exports = mongoose.model('LotusSet', lotusSetSchema, 'lotusSets');
