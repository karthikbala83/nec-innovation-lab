// ---------------------------------------------------------------
// EmailCode — 6-digit code a visitor types to prove the email is theirs
// before sending feedback or a request. Only a hash of the code is
// stored; codes expire in 10 minutes and allow 5 wrong tries.
// ---------------------------------------------------------------
const crypto = require('crypto');
const mongoose = require('mongoose');

const TTL_MIN = 10;
const MAX_TRIES = 5;

const emailCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    tries: { type: Number, default: 0 },
    usedAt: Date,
  },
  { timestamps: true }
);

// Mongo deletes expired codes on its own
emailCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

const hashCode = (email, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev').update(`${email}:${code}`).digest('hex');

emailCodeSchema.statics.issue = async function (email) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await this.create({ email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + TTL_MIN * 60000) });
  return code;
};

// true if the latest unused code matches; counts wrong tries
emailCodeSchema.statics.verify = async function (email, code) {
  const doc = await this.findOne({ email, usedAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!doc || doc.tries >= MAX_TRIES) return false;
  const a = Buffer.from(doc.codeHash);
  const b = Buffer.from(hashCode(email, String(code || '').trim()));
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    doc.usedAt = new Date();
    await doc.save();
    return true;
  }
  doc.tries += 1;
  await doc.save();
  return false;
};

Object.assign(emailCodeSchema.statics, { TTL_MIN });

module.exports = mongoose.model('EmailCode', emailCodeSchema, 'emailCodes');
