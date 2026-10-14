// ---------------------------------------------------------------
// Like — the lightest reaction, open to ANYONE with the link (no
// account). One per signed-in user, or per visitor (a salted hash of
// IP + browser; we never store the IP itself). "Back" stays the
// signed-in endorsement that counts more in the Lab Score.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    visitor: String,   // sha256(ip | user-agent | secret), anonymous visitors only
  },
  { timestamps: true }
);

likeSchema.index({ project: 1, user: 1 }, { unique: true, partialFilterExpression: { user: { $exists: true } } });
likeSchema.index({ project: 1, visitor: 1 }, { unique: true, partialFilterExpression: { visitor: { $exists: true } } });

module.exports = mongoose.model('Like', likeSchema, 'likes');
