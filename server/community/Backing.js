// ---------------------------------------------------------------
// Backing — "Back this project", with no money (spec §6).
//   back   anyone signed in              +1 backer
//   mentor faculty                       listed on the page as a mentor offer
//   pilot  anyone signed in, with note   badge only after an admin confirms
// intro (P2, recruiters) and incubation (P3, IIC) come later.
// One of each type per user per project.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const TYPES = ['back', 'mentor', 'pilot'];

const backingSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, default: 'back' },
    note: { type: String, trim: true, maxlength: 300 },   // "Agri dept will pilot on 2 acres"
    fromCollege: { type: Boolean, default: true },          // college vs public counted separately
    status: { type: String, enum: ['active', 'pending', 'confirmed', 'declined'], default: 'active' },
    reviewedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

backingSchema.index({ project: 1, user: 1, type: 1 }, { unique: true });
backingSchema.index({ type: 1, status: 1 });

backingSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Backing', backingSchema, 'backings');
