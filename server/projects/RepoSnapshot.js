// ---------------------------------------------------------------
// RepoSnapshot — what the college server pulled from GitHub, at one
// commit. One current snapshot per project (re-import overwrites).
// Lotus (P2) and the duplicate check (P2) read from here.
//
// Privacy: secretWarnings hold a MASKED preview only, never the
// secret itself, and are shown to the team / mentor / admin only.
// ---------------------------------------------------------------
const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const repoSnapshotSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true, unique: true },
    owner: String,                // GitHub owner
    name: String,                 // GitHub repo name
    sha: { type: String, index: true },   // commit the snapshot was taken at
    defaultBranch: String,

    meta: {
      description: String,
      stars: Number,
      forks: Number,
      license: String,
      topics: [String],
      createdAt: Date,
      pushedAt: Date,
      htmlUrl: String,
      private: Boolean,
    },
    languages: { type: Map, of: Number },          // { JavaScript: 41230, CSS: 2210 } bytes
    stack: [String],                                 // detected: React, Express, MongoDB…

    tree: [{ _id: false, path: String, size: Number }],              // kept files only
    skipped: {                                                       // what the skip rules removed
      count: { type: Number, default: 0 },
      reasons: { type: Map, of: Number },            // { node_modules: 812, binary: 14, … }
    },
    treeTruncated: Boolean,                          // GitHub cut the tree (huge repo)
    keyFiles: [{ _id: false, path: String, size: Number, content: String }],   // README, package.json… (trimmed)
    fileHashes: [{ _id: false, path: String, sha: String }],                   // git blob sha per kept file

    commits: [{
      _id: false,
      sha: String,
      authorLogin: String,
      authorName: String,
      date: Date,
      message: String,
      files: [String],   // only for the latest commits we fetched in detail
    }],
    weeklyCommits: [{ _id: false, week: Date, count: Number }],   // Monday-start weeks, last 12
    memberStats: [{
      _id: false,
      user: { type: ObjectId, ref: 'User' },
      githubUsername: String,
      commits: Number,
      lastCommitAt: Date,
      files: [{ _id: false, path: String, changes: Number }],      // files this member touched
    }],
    unmappedCommits: { type: Number, default: 0 },   // authors not on the team
    detailedCommits: Number,                          // how many commits have file lists
    scan: {
      filesScanned: Number,
      complete: Boolean,         // false if the repo was too big to scan fully
      note: String,
    },

    secretWarnings: [{
      _id: false,
      path: String,
      line: Number,
      type: { type: String },   // "AWS access key", "Committed .env file"… (field named "type" needs this form)
      preview: String,      // masked: "AKIA****"
    }],

    // Duplicate check (projects/duplicateCheck.js) — mentor/admin only, never public
    duplicate: {
      checkedAt: Date,
      considered: Number,          // distinctive files compared
      flagged: Boolean,            // any match >= 60%
      matches: [{
        _id: false,
        project: { type: ObjectId, ref: 'Project' },
        overlap: Number,           // % of this project's distinctive files found there
        sharedFiles: Number,
        samplePaths: [String],
        otherRepoCreatedAt: Date,  // helps the mentor see who was first
      }],
    },

    fetchedAt: { type: Date, default: Date.now },   // cache clock
    durationMs: Number,
    apiCalls: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('RepoSnapshot', repoSnapshotSchema, 'repoSnapshots');
