// ---------------------------------------------------------------
// Note schema — the sample resource students will CRUD.
// Lesson: "ref" is the FOREIGN KEY of MongoDB. We JOIN it later
// with populate() and $lookup in aggregations.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',           // foreign key -> users collection
      required: true,
      index: true,           // we filter by user constantly, so index it
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: '' },
    tags: [{ type: String, lowercase: true }],   // array column

    // nested JSON column
    meta: {
      priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
      pinned: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Note', noteSchema);
