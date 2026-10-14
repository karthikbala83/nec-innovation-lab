// ---------------------------------------------------------------
// Feedback — one message to a project's team, plus its reply thread.
//   kind 'feedback'  anyone with the link, or classmates (signed in)
//   kind 'request'   "build us something like this" — a requirement
//                    from a company, department, farmer, school…
// Contact details are kept for safety (and the admin), never shown to
// students; replies are relayed by email through the portal.
//   status 'held'      waiting for an admin (content check said so)
//          'delivered' visible to the team, owner emailed
//          'rejected'  an admin turned it down
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const RELATIONS = ['classmate', 'friend', 'faculty', 'alumni', 'industry', 'visitor'];

const postSchema = new mongoose.Schema(
  {
    by: { type: String, enum: ['team', 'sender'], required: true },
    user: { type: ObjectId, ref: 'User' },   // team member who replied
    body: { type: String, required: true, maxlength: 2000 },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const feedbackSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true, index: true },
    kind: { type: String, enum: ['feedback', 'request'], required: true },
    from: {
      user: { type: ObjectId, ref: 'User' },          // set when signed in (classmates, faculty)
      name: { type: String, required: true, trim: true, maxlength: 60 },
      email: { type: String, required: true, lowercase: true, trim: true },   // verified
      phone: { type: String, trim: true, maxlength: 20 },                      // required for visitors
      relation: { type: String, enum: RELATIONS, default: 'visitor' },
      organisation: { type: String, trim: true, maxlength: 100 },
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    rating: { type: Number, min: 1, max: 5 },        // feedback only, optional
    request: {                                       // requests only
      timeline: { type: String, trim: true, maxlength: 60 },
      budget: { type: String, trim: true, maxlength: 60 },
    },
    status: { type: String, enum: ['held', 'delivered', 'rejected'], index: true },
    check: { verdict: String, reasons: [String], relevance: Number },
    moderatedBy: { type: ObjectId, ref: 'User' },
    moderatedAt: Date,
    thread: [postSchema],
    readBy: [{ type: ObjectId, ref: 'User' }],       // team members who opened it
    ipHash: String,                                  // abuse follow-up, never the raw IP
  },
  { timestamps: true }
);

feedbackSchema.index({ project: 1, status: 1, createdAt: -1 });
feedbackSchema.index({ 'from.email': 1, createdAt: -1 });

feedbackSchema.statics.RELATIONS = RELATIONS;

module.exports = mongoose.model('Feedback', feedbackSchema, 'feedback');
