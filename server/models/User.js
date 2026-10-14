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
    // student by default; an admin promotes faculty (never self-chosen at signup).
    // recruiter accounts are created by the placement cell (admin), never by signup.
    role: { type: String, enum: ['student', 'faculty', 'admin', 'recruiter'], default: 'student', index: true },

    // ---- NEC Innovation Lab identity ----
    // handle = public profile URL (/u/<handle>). Email is never shown publicly.
    handle: { type: String, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]{3,40}$/ },
    githubUsername: {
      type: String, trim: true,
      match: [/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, 'Invalid GitHub username'],
    },
    verified: { type: Boolean, default: false },   // admin checked the roll number
    // Google Workspace sign-in (users.googleSub = Google's stable account id)
    googleSub: { type: String, index: { unique: true, sparse: true } },
    // Seeded demo account: never linked to a real Google sign-in
    isDemo: { type: Boolean, default: false },
    // First-run app tour: the version the user finished or skipped (bump TOUR_VERSION in the client to show a new tour)
    tourVersion: { type: Number, default: 0 },

    // ---- NESTED JSON inside a column ----
    // In SQL this would be 3 extra tables. Here it's one sub-document.
    profile: {
      college: { type: String, default: 'Nandha Engineering College' },
      department: { type: String, default: 'CSE' },
      year: { type: Number, min: 1, max: 4, default: 2 },
      batch: { type: String, trim: true, match: [/^\d{4}-\d{4}$/, 'Batch looks like 2023-2027'] },
      rollNo: { type: String, trim: true, uppercase: true, maxlength: 20 },   // never public
      company: { type: String, trim: true, maxlength: 80 },                   // recruiters
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

// ---- College email only. ALLOWED_EMAIL_DOMAIN may list several: "a.ac.in,b.ac.in" ----
userSchema.statics.allowedDomains = () =>
  (process.env.ALLOWED_EMAIL_DOMAIN || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

userSchema.statics.isCollegeEmail = function (email) {
  const domains = this.allowedDomains();
  const at = String(email || '').toLowerCase().trim().split('@');
  return at.length === 2 && domains.includes(at[1]);
};

// ---- Give every user a public handle from the email local part: arun.k -> arun-k ----
userSchema.pre('validate', async function () {
  if (this.handle || !this.isSelected('handle')) return;   // partial docs (.select()) must not get a new handle
  const base = (this.email || 'user').split('@')[0].toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).padEnd(3, '0');
  let candidate = base;
  for (let n = 2; await this.constructor.exists({ handle: candidate }); n++) candidate = `${base}-${n}`;
  this.handle = candidate;
});

// What anyone (logged in or not) may see about a person
userSchema.statics.PUBLIC_FIELDS = 'name handle role verified githubUsername profile.department profile.batch profile.skills';

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

// Shape sent to the client after login/signup
userSchema.methods.toAuthJSON = function () {
  return {
    id: this._id, name: this.name, email: this.email, role: this.role, handle: this.handle, tourVersion: this.tourVersion || 0,
    // Students who joined with Google still need department / batch / roll number
    needsProfile: this.role === 'student' && !(this.profile?.batch && this.profile?.rollNo),
  };
};

userSchema.methods.createResetToken = function (ttlMinutes = 15) {
  const raw = crypto.randomBytes(32).toString('hex');
  // store only the HASH of the token — same principle as passwords
  this.resetPasswordToken = crypto.createHash('sha256').update(raw).digest('hex');
  this.resetPasswordExpires = Date.now() + ttlMinutes * 60 * 1000; // 15 minutes unless told otherwise
  return raw; // the raw token goes to the user, hash stays in DB
};

module.exports = mongoose.model('User', userSchema);
