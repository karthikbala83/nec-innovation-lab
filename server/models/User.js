// ---------------------------------------------------------------
// User schema — the "table creation" of MongoDB.
// Lesson: schemas give NoSQL structure — validation, types,
// defaults, indexes, and NESTED JSON (profile) in one document.
// ---------------------------------------------------------------
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,          // creates a unique index — like UNIQUE constraint in SQL
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: true,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,         // never returned in queries unless explicitly asked
    },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },

    // ---- NESTED JSON inside a column ----
    // In SQL this would be 3 extra tables. Here it's one sub-document.
    profile: {
      college: { type: String, default: 'Nandha Engineering College' },
      department: { type: String, default: 'CSE' },
      year: { type: Number, min: 1, max: 4, default: 2 },
      skills: [{ type: String }],              // array inside the document
      social: {
        github: String,
        linkedin: String,
      },
    },

    lastLoginAt: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }        // adds createdAt / updatedAt automatically
);

// ---- Hash password BEFORE saving. Never store plain text. ----
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ---- Instance methods keep logic on the model, not the controller ----
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.createResetToken = function () {
  const raw = crypto.randomBytes(32).toString('hex');
  // store only the HASH of the token — same principle as passwords
  this.resetPasswordToken = crypto.createHash('sha256').update(raw).digest('hex');
  this.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  return raw; // the raw token goes to the user, hash stays in DB
};

module.exports = mongoose.model('User', userSchema);
