// ---------------------------------------------------------------
// IntroRequest — a recruiter asks the PLACEMENT CELL for an intro to a
// student or a team (spec §3, §6, §10). Never goes straight to the
// student and never reveals a student's email or phone.
//   new -> forwarded (placement cell passed it to the student) | declined
//   forwarded -> closed
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const PURPOSES = ['internship', 'job', 'interview', 'pilot', 'mentoring', 'other'];
const STATUSES = ['new', 'forwarded', 'declined', 'closed'];

const introRequestSchema = new mongoose.Schema(
  {
    from: { type: ObjectId, ref: 'User', required: true },          // recruiter
    student: { type: ObjectId, ref: 'User' },                        // a person…
    project: { type: ObjectId, ref: 'Project' },                     // …and/or a team
    purpose: { type: String, enum: PURPOSES, default: 'interview' },
    message: { type: String, required: [true, 'Tell the placement cell what you are looking for'], trim: true, maxlength: 1000 },
    status: { type: String, enum: STATUSES, default: 'new', index: true },
    placementNote: { type: String, trim: true, maxlength: 1000 },     // visible to the recruiter
    handledBy: { type: ObjectId, ref: 'User' },
    handledAt: Date,
  },
  { timestamps: true }
);

introRequestSchema.index({ from: 1, createdAt: -1 });
introRequestSchema.index({ student: 1, status: 1 });

introRequestSchema.pre('validate', function () {
  if (!this.student && !this.project) this.invalidate('student', 'Pick a student or a project');
});

Object.assign(introRequestSchema.statics, { PURPOSES, STATUSES });

module.exports = mongoose.model('IntroRequest', introRequestSchema, 'introRequests');
