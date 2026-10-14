// ---------------------------------------------------------------
// Project — one launch page. Fields follow docs/PORTAL_SPEC.md §8.
// The model owns the data rules (limits, enums, slug); controllers
// decide WHO may change WHAT.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const STAGES = ['idea', 'prototype', 'live', 'pilot', 'incubation', 'startup'];
const TEAM_STAGES = ['idea', 'prototype', 'live'];          // pilot+ need admin confirm
const STATUSES = ['draft', 'in_review', 'published', 'archived'];
const CATEGORIES = ['software', 'hardware', 'research'];
const COMPETITION_STAGES = ['registered', 'shortlisted', 'finalist', 'winner'];

const httpUrl = {
  validator: (v) => !v || /^https?:\/\/[^\s]+$/i.test(v),
  message: (p) => `${p.path} must be an http(s) link`,
};
// Public GitHub repos only: https://github.com/<owner>/<repo>
const GITHUB_REPO = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/;

const maxItems = (n) => ({ validator: (a) => a.length <= n, message: (p) => `At most ${n} ${p.path}` });

const memberSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    githubUsername: { type: String, trim: true },
    role: { type: String, trim: true, maxlength: 40, default: 'Developer' },   // "Frontend", "Hardware"…
  },
  { _id: false }
);

const competitionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },   // "SIH 2026"
    psId: { type: String, trim: true, maxlength: 30 },
    stage: { type: String, enum: COMPETITION_STAGES, default: 'registered' },
    date: Date,
    confirmed: { type: Boolean, default: false },   // admin confirms "winner"
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    // ---- Identity ----
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 80 },
    slug: { type: String, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]{3,80}$/ },
    tagline: { type: String, trim: true, maxlength: [140, 'Tagline: 140 characters max'], default: '' },
    thumbnail: { type: String, trim: true, validate: httpUrl },

    // ---- Category ----
    department: { type: String, trim: true, maxlength: 40, index: true },
    year: { type: Number, min: 1, max: 4 },
    theme: { type: String, trim: true, maxlength: 60 },   // "Agri-tech", "Health"…
    category: { type: String, enum: CATEGORIES, default: 'software' },

    // ---- Stage & competitions ----
    stage: { type: String, enum: STAGES, default: 'idea', index: true },
    competitions: { type: [competitionSchema], validate: maxItems(10) },

    // ---- Story ----
    problem: { type: String, trim: true, maxlength: [1500, 'Problem: 1500 characters max'], default: '' },
    solution: { type: String, trim: true, maxlength: [2500, 'Solution: 2500 characters max'], default: '' },
    impact: { type: String, trim: true, maxlength: [800, 'Impact: 800 characters max'], default: '' },
    architectureImage: { type: String, trim: true, validate: httpUrl },

    // ---- Proof ----
    liveUrl: { type: String, trim: true, validate: httpUrl },
    repoUrl: {
      type: String, trim: true,
      validate: { validator: (v) => !v || GITHUB_REPO.test(v), message: 'Repo must be https://github.com/<owner>/<repo>' },
    },
    videoUrl: { type: String, trim: true, validate: httpUrl },   // YouTube unlisted in v1
    screenshots: { type: [{ type: String, trim: true, validate: httpUrl }], validate: maxItems(8) },

    // ---- Team ----
    owner: { type: ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], validate: maxItems(6) },
    mentor: { type: ObjectId, ref: 'User', index: true },

    // ---- Asks (P1 UI) ----
    lookingFor: { type: [{ type: String, trim: true, maxlength: 120 }], validate: maxItems(3) },

    // ---- State: draft -> in_review -> published -> archived ----
    status: { type: String, enum: STATUSES, default: 'draft', index: true },
    review: {
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: { type: ObjectId, ref: 'User' },
      note: { type: String, trim: true, maxlength: 1000 },   // why it was sent back
    },
    publishedAt: { type: Date, index: true },

    // ---- Repo summary (full data lives in repoSnapshots) ----
    repo: {
      snapshot: { type: ObjectId, ref: 'RepoSnapshot' },
      importedAt: Date,
      stack: [String],
      languages: [String],          // top languages, biggest first
      lastCommitAt: Date,
      commitsLast7d: { type: Number, default: 0 },
      commitsLast30d: { type: Number, default: 0 },
      totalCommits: { type: Number, default: 0 },
    },

    // ---- Live URL daily check (jobs/dailyChecks.js) ----
    live: {
      checkedAt: Date,
      ok: Boolean,            // last check: up or down
      status: Number,         // HTTP status of the last check (0 = no answer)
      uptime30d: Number,      // 0–100, null until checked
    },

    // ---- Counters (kept in sync by community/ and the view counter) ----
    counts: {
      backers: { type: Number, default: 0 },          // college + public "back"s
      backersCollege: { type: Number, default: 0 },
      backersPublic: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },          // anyone, incl. visitors without an account
      views: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      updates: { type: Number, default: 0 },
    },

    // ---- Lotus Blossom team summary (kept by score/labScore.js; public-safe) ----
    lotus: {
      teamPercent: { type: Number, default: 0 },
      petalsAvg: { type: Number, default: 0 },
      vivas: { type: Number, default: 0 },   // members with a faculty viva
      taken: { type: Number, default: 0 },   // members with scored answers
    },

    // ---- Lab Score 0–100 with every part visible (score/labScore.js) ----
    labScore: {
      total: { type: Number, default: 0, index: true },
      parts: { type: mongoose.Schema.Types.Mixed, default: {} },
      computedAt: Date,
    },
  },
  { timestamps: true }
);

// Feed queries: published projects, newest first / filtered
projectSchema.index({ status: 1, publishedAt: -1 });
projectSchema.index({ 'members.user': 1 });

// ---- Slug from title, unique: "Smart Irrigation" -> smart-irrigation, smart-irrigation-2 ----
projectSchema.pre('validate', async function () {
  if (this.slug || !this.isSelected('slug')) return;   // partial docs (.select()) must not get a new slug
  const base = (this.title || 'project').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).padEnd(3, '0');
  let candidate = base;
  for (let n = 2; await this.constructor.exists({ slug: candidate }); n++) candidate = `${base}-${n}`;
  this.slug = candidate;
});

// Owner is always a member
projectSchema.pre('validate', function () {
  // m.user may be populated (a User doc) or a plain id
  if (this.owner && !this.members.some((m) => String(m.user?._id || m.user) === String(this.owner))) {
    this.members.unshift({ user: this.owner, role: 'Lead' });
  }
});

projectSchema.methods.isMember = function (userId) {
  return !!userId && this.members.some((m) => String(m.user?._id || m.user) === String(userId));
};

// Who may see a project that is not yet published
projectSchema.methods.canView = function (user) {
  if (this.status === 'published') return true;
  if (!user) return false;
  return user.role === 'admin'
    || this.isMember(user._id)
    || String(this.mentor?._id || this.mentor) === String(user._id);
};

// What still blocks "Submit for review"
projectSchema.methods.missingForReview = function () {
  const missing = [];
  if (!this.tagline) missing.push('tagline');
  if (!this.problem) missing.push('problem');
  if (!this.solution) missing.push('solution');
  if (!this.repoUrl && !this.liveUrl && !this.videoUrl) missing.push('repo, live or video link');
  if (!this.mentor) missing.push('mentor');
  return missing;
};

projectSchema.statics.parseRepoUrl = (url) => {
  const m = GITHUB_REPO.exec(url || '');
  return m ? { owner: m[1], name: m[2] } : null;
};

Object.assign(projectSchema.statics, { STAGES, TEAM_STAGES, STATUSES, CATEGORIES, COMPETITION_STAGES });

module.exports = mongoose.model('Project', projectSchema);
