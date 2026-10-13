// ---------------------------------------------------------------
// Update — the project's launch log ("v2 shipped", "won SIH round 1").
// Posted by the team; public once the project is published.
// Updates in the last 60 days feed the Lab Score "Freshness" part.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const updateSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: [true, 'Give the update a title'], trim: true, maxlength: 100 },
    body: { type: String, trim: true, maxlength: [2000, 'Update: 2000 characters max'], default: '' },
    media: {
      type: String, trim: true,
      validate: { validator: (v) => !v || /^https?:\/\/[^\s]+$/i.test(v), message: 'Media must be an http(s) link' },
    },
  },
  { timestamps: true }
);

updateSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model('Update', updateSchema, 'updates');
