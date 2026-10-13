// ---------------------------------------------------------------
// Comment — one level of replies (parent = a top-level comment).
// Moderation (spec §10): anyone signed in can report; 3 reports hide
// it until an admin looks; the mentor or an admin can hide/unhide.
// Deleting your own comment blanks it so replies keep their context.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const AUTO_HIDE_REPORTS = 3;

const commentSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    body: { type: String, trim: true, maxlength: [1000, 'Comment: 1000 characters max'] },
    parent: { type: ObjectId, ref: 'Comment', default: null },
    hidden: { type: Boolean, default: false },
    hiddenBy: { type: ObjectId, ref: 'User' },
    deleted: { type: Boolean, default: false },
    reports: [{ type: ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

commentSchema.index({ project: 1, createdAt: -1 });
commentSchema.index({ user: 1, createdAt: -1 });   // rate limit lookups
commentSchema.index({ 'reports.0': 1 });             // "has any report" for the admin list

// A live comment needs text (path validators skip empty values, so check here)
commentSchema.pre('validate', function () {
  if (!this.deleted && !this.body?.trim()) this.invalidate('body', 'Write something first');
});

commentSchema.statics.AUTO_HIDE_REPORTS = AUTO_HIDE_REPORTS;

module.exports = mongoose.model('Comment', commentSchema, 'comments');
