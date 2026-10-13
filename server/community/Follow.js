// Follow — "keep me posted". One per user per project.
const mongoose = require('mongoose');

const followSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

followSchema.index({ project: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Follow', followSchema, 'follows');
