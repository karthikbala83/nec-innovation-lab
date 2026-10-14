// ---------------------------------------------------------------
// Intro requests: recruiters ask, the placement cell (admin) decides.
// Students see a request only after the placement cell forwards it.
// ---------------------------------------------------------------
const IntroRequest = require('./IntroRequest');
const Project = require('../projects/Project');
const User = require('../models/User');

const fail = (status, message) => Object.assign(new Error(message), { status });
const PER_DAY = 20;

const POPULATE = [
  { path: 'student', select: 'name handle profile.department profile.batch' },
  { path: 'project', select: 'title slug' },
];

// POST /api/intros   { student?, project?, purpose, message }   — recruiters
exports.create = async (req, res) => {
  const { student, project, purpose, message } = req.body;
  const today = await IntroRequest.countDocuments({ from: req.user._id, createdAt: { $gte: new Date(Date.now() - 864e5) } });
  if (today >= PER_DAY) throw fail(429, `Up to ${PER_DAY} requests a day — the placement cell will get back to you`);

  if (student) {
    const s = await User.findById(student).select('role');
    if (!s || s.role !== 'student') throw fail(400, 'Student not found');
  }
  if (project) {
    const p = await Project.findById(project).select('status members');
    if (!p || p.status !== 'published') throw fail(400, 'Project not found');
    if (student && !p.isMember(student)) throw fail(400, 'That student is not on this project');
  }
  const dup = await IntroRequest.exists({
    from: req.user._id, student: student || null, project: project || null, status: { $in: ['new', 'forwarded'] },
  });
  if (dup) throw fail(409, 'You already have an open request for this');

  const intro = await IntroRequest.create({ from: req.user._id, student, project, purpose, message });
  await intro.populate(POPULATE);
  res.status(201).json(intro);
};

// GET /api/intros/mine — recruiter: what I sent; student: what was forwarded to me
exports.mine = async (req, res) => {
  if (req.user.role === 'recruiter') {
    const sent = await IntroRequest.find({ from: req.user._id }).sort({ createdAt: -1 }).limit(100)
      .select('-handledBy').populate(POPULATE).lean();
    return res.json(sent);
  }
  // Students: forwarded requests about me, or about a project I'm on
  const projects = await Project.find({ 'members.user': req.user._id }).distinct('_id');
  const received = await IntroRequest.find({
    status: { $in: ['forwarded', 'closed'] },
    $or: [{ student: req.user._id }, { project: { $in: projects }, student: null }],
  }).sort({ updatedAt: -1 }).limit(50)
    .populate([...POPULATE, { path: 'from', select: 'name profile.company' }])
    .select('-handledBy')
    .lean();
  res.json(received);
};

// ---------- placement cell (admin) ----------

// GET /api/admin/intros?status=new
exports.list = async (req, res) => {
  const filter = IntroRequest.STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
  const intros = await IntroRequest.find(filter).sort({ createdAt: -1 }).limit(200)
    .populate([...POPULATE, { path: 'from', select: 'name email profile.company' }, { path: 'handledBy', select: 'name' }])
    .lean();
  const counts = await IntroRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  res.json({ intros, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
};

// PATCH /api/admin/intros/:id   { status, placementNote }
exports.decide = async (req, res) => {
  const { status, placementNote } = req.body;
  if (!['forwarded', 'declined', 'closed'].includes(status)) throw fail(400, 'Status must be forwarded, declined or closed');
  const intro = await IntroRequest.findById(req.params.id);
  if (!intro) throw fail(404, 'Request not found');
  Object.assign(intro, {
    status,
    placementNote: placementNote !== undefined ? String(placementNote).slice(0, 1000) : intro.placementNote,
    handledBy: req.user._id,
    handledAt: new Date(),
  });
  await intro.save();
  res.json(intro);
};
