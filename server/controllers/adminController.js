// ---------------------------------------------------------------
// Admin analytics — this is where students move beyond find().
// Every endpoint here is an aggregation pipeline:
//   $match -> $lookup (JOIN) -> $unwind -> $group -> $project
// ---------------------------------------------------------------
const User = require('../models/User');
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

// GET /api/admin/users  — paginated user list with note counts (JOIN + facet)
exports.listUsers = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await User.aggregate([
    {
      $lookup: { from: 'notes', localField: '_id', foreignField: 'user', as: 'notes' },
    },
    {
      $project: {
        name: 1,
        email: 1,
        role: 1,
        'profile.department': 1,
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
        data: [{ $skip: (page - 1) * limit }, { $limit: Number(limit) }],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  res.json({
    users: result[0].data,
    total: result[0].total[0]?.count || 0,
  });
};
