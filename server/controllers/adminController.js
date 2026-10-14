// ---------------------------------------------------------------
// Admin analytics — this is where students move beyond find().
// Every endpoint here is an aggregation pipeline:
//   $match -> $lookup (JOIN) -> $unwind -> $group -> $project
// ---------------------------------------------------------------
const crypto = require('crypto');
const User = require('../models/User');
const { clientUrl } = require('./authController');
const Note = require('../models/Note');
const Session = require('../models/Session');

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // active = seen in last 5 minutes

// GET /api/admin/dashboard
exports.dashboard = async (req, res) => {
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS);

  // ---- Query 1: live active users (JOIN sessions -> users) ----
  const activeUsers = await Session.aggregate([
    { $match: { lastActiveAt: { $gte: since }, logoutAt: null } },
    {
      $lookup: {                      // SQL: JOIN users ON sessions.user = users._id
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDoc',
      },
    },
    { $unwind: '$userDoc' },
    {
      $group: {                       // a user with 2 tabs = 1 active user
        _id: '$userDoc._id',
        name: { $first: '$userDoc.name' },
        email: { $first: '$userDoc.email' },
        department: { $first: '$userDoc.profile.department' }, // nested JSON field
        lastActiveAt: { $max: '$lastActiveAt' },
        sessions: { $sum: 1 },
      },
    },
    { $sort: { lastActiveAt: -1 } },
  ]);

  // ---- Query 2: logins per day, last 7 days ($group on a date expression) ----
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const loginsPerDay = await Session.aggregate([
    { $match: { loginAt: { $gte: weekAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$loginAt' } },
        logins: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user' },
      },
    },
    { $project: { logins: 1, uniqueUsers: { $size: '$uniqueUsers' } } },
    { $sort: { _id: 1 } },
  ]);

  // ---- Query 3: top note-writers (JOIN notes -> users + computed fields) ----
  const topWriters = await Note.aggregate([
    {
      $group: {
        _id: '$user',
        noteCount: { $sum: 1 },
        highPriority: {
          $sum: { $cond: [{ $eq: ['$meta.priority', 'high'] }, 1, 0] }, // conditional count
        },
        lastNoteAt: { $max: '$updatedAt' },
      },
    },
    { $sort: { noteCount: -1 } },
    { $limit: 5 },
    {
      $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' },
    },
    { $unwind: '$u' },
    {
      $project: {
        name: '$u.name',
        year: '$u.profile.year',          // reaching into nested JSON
        noteCount: 1,
        highPriority: 1,
        lastNoteAt: 1,
      },
    },
  ]);

  // ---- Simple counts for the stat cards ----
  const [totalUsers, totalNotes, totalSessions] = await Promise.all([
    User.countDocuments(),
    Note.countDocuments(),
    Session.countDocuments(),
  ]);

  res.json({
    counts: { totalUsers, totalNotes, totalSessions, activeNow: activeUsers.length },
    activeUsers,
    loginsPerDay,
    topWriters,
  });
};

// POST /api/admin/recruiters  { name, email, company }
// Placement cell invites a recruiter. Returns a one-time set-password link
// (valid 7 days) for the admin to send — recruiters never sign up themselves.
exports.createRecruiter = async (req, res) => {
  const { name, email, company } = req.body;
  if (!name || !email || !company) return res.status(400).json({ message: 'Name, email and company are required' });
  if (User.isCollegeEmail(email)) return res.status(400).json({ message: 'Use the recruiter\'s company email, not a college one' });
  if (await User.exists({ email: String(email).toLowerCase().trim() })) return res.status(409).json({ message: 'That email already has an account' });

  const user = new User({
    name, email, role: 'recruiter', verified: true,
    password: crypto.randomBytes(24).toString('base64url'),   // unknown to anyone; replaced via the link
    profile: { company, department: undefined, year: undefined },
  });
  const raw = user.createResetToken(7 * 24 * 60);
  await user.save();
  require('../services/mailer').sendSoon({
    to: user.email,
    subject: 'Your NEC Innovation Lab recruiter account',
    heading: `Welcome, ${name}`,
    paragraphs: ['The Nandha Engineering College placement cell created a recruiter account for you on NEC Innovation Lab: find students through their verified projects and request intros through the placement cell.',
      'Set your password within 7 days:'],
    cta: { label: 'Set my password', url: `${clientUrl()}/reset-password/${raw}` },
  });
  res.status(201).json({
    id: user._id,
    setPasswordLink: `${clientUrl()}/reset-password/${raw}`,
    expiresAt: user.resetPasswordExpires,
  });
};

// PATCH /api/admin/users/:id  { role?, verified? }
// Admin promotes faculty and marks students verified (roll number checked).
exports.updateUser = async (req, res) => {
  const { role, verified } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (role !== undefined) {
    if (!['student', 'faculty', 'admin'].includes(role)) return res.status(400).json({ message: 'Unknown role (recruiters are invited separately)' });
    if (user.role === 'recruiter') return res.status(400).json({ message: 'Recruiter accounts keep the recruiter role' });
    if (String(user._id) === String(req.user._id) && role !== 'admin')
      return res.status(400).json({ message: 'You cannot remove your own admin role' });
    user.role = role;
  }
  if (verified !== undefined) user.verified = !!verified;
  await user.save();
  res.json({ id: user._id, role: user.role, verified: user.verified });
};

// GET /api/admin/users  — paginated user list with note counts (JOIN + facet)
exports.listUsers = async (req, res) => {
  const { page = 1, limit = 10, q, role } = req.query;
  const match = {};
  if (['student', 'faculty', 'admin', 'recruiter'].includes(role)) match.role = role;
  if (q) {
    const re = new RegExp(String(q).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [{ name: re }, { email: re }, { 'profile.rollNo': re }];
  }
  const result = await User.aggregate([
    { $match: match },
    {
      $lookup: { from: 'notes', localField: '_id', foreignField: 'user', as: 'notes' },
    },
    {
      $project: {
        name: 1,
        email: 1,
        role: 1,
        handle: 1,
        verified: 1,
        githubUsername: 1,
        'profile.rollNo': 1,
        'profile.batch': 1,
        'profile.department': 1,
        'profile.company': 1,
        'profile.year': 1,
        'profile.skills': 1,
        noteCount: { $size: '$notes' },
        lastLoginAt: 1,
        createdAt: 1,
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $facet: {                          // pagination + total in ONE round trip
        data: [{ $skip: (Number(page) - 1) * Number(limit) }, { $limit: Number(limit) }],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  res.json({
    users: result[0].data,
    total: result[0].total[0]?.count || 0,
  });
};
