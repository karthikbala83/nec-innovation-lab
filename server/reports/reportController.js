// ---------------------------------------------------------------
// Admin reports & exports (spec §4 admin console, §12 P3): what the
// placement cell / IIC / HoDs ask for — how many projects, which
// departments, Lotus & viva coverage, engagement, intros — plus CSV
// downloads for the college's own records.
// ---------------------------------------------------------------
const User = require('../models/User');
const Project = require('../projects/Project');
const LotusAttempt = require('../lotus/LotusAttempt');
const LotusSet = require('../lotus/LotusSet');
const Feedback = require('../feedback/Feedback');
const IntroRequest = require('../intros/IntroRequest');
const Like = require('../feedback/Like');
const Backing = require('../community/Backing');
const Season = require('../seasons/Season');
const SeasonEntry = require('../seasons/SeasonEntry');
const { sendCsv } = require('../utils/csv');

const countBy = async (Model, field, match = {}) =>
  Object.fromEntries((await Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]))
    .map((r) => [r._id ?? 'unknown', r.n]));

const monthKey = (d) => d.toISOString().slice(0, 7);

// GET /api/admin/reports
exports.overview = async (req, res) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5, 1);
  sixMonthsAgo.setUTCHours(0, 0, 0, 0);

  const [roles, verified, students, projStatus, deptPublished, stagePublished, categoryPublished, launches,
    lotusRows, likes, backers, fbStatus, fbKind, intros, live, top, seasons, entries] = await Promise.all([
    countBy(User, 'role'),
    User.countDocuments({ role: 'student', verified: true }),
    User.countDocuments({ role: 'student' }),
    countBy(Project, 'status'),
    countBy(Project, 'department', { status: 'published' }),
    countBy(Project, 'stage', { status: 'published' }),
    countBy(Project, 'category', { status: 'published' }),
    Project.aggregate([{ $match: { status: 'published', publishedAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$publishedAt' } }, n: { $sum: 1 } } }]),
    // Lotus coverage per department: students on published projects vs scored vs viva
    Project.aggregate([
      { $match: { status: 'published' } },
      { $unwind: '$members' },
      { $lookup: { from: 'users', localField: 'members.user', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $lookup: { from: 'lotusSets', let: { p: '$_id', uid: '$u._id' }, as: 'set',
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$project', '$$p'] }, { $eq: ['$user', '$$uid'] }, { $eq: ['$active', true] }] } } }, { $project: { _id: 1 } }] } },
      { $lookup: { from: 'lotusAttempts', localField: 'set._id', foreignField: 'set', as: 'att' } },
      { $group: {
        _id: { $ifNull: ['$u.profile.department', 'Other'] },
        students: { $addToSet: '$u._id' },
        scored: { $addToSet: { $cond: [{ $in: ['scored', '$att.status'] }, '$u._id', '$$REMOVE'] } },
        viva: { $addToSet: { $cond: [{ $in: [true, '$att.viva.done'] }, '$u._id', '$$REMOVE'] } },
      } },
      { $project: { students: { $size: '$students' }, scored: { $size: '$scored' }, viva: { $size: '$viva' } } },
      { $sort: { students: -1 } },
    ]),
    Like.countDocuments(),
    Backing.countDocuments({ type: 'back' }),
    countBy(Feedback, 'status'),
    countBy(Feedback, 'kind', { status: 'delivered' }),
    countBy(IntroRequest, 'status'),
    Project.aggregate([{ $match: { status: 'published', liveUrl: { $nin: [null, ''] } } },
      { $group: { _id: null, n: { $sum: 1 }, avgUptime: { $avg: '$live.uptime30d' }, up: { $sum: { $cond: ['$live.ok', 1, 0] } } } }]),
    Project.find({ status: 'published' }).sort({ 'labScore.total': -1 }).limit(5).select('title slug department labScore.total').lean(),
    Season.find().select('name slug submissionOpens submissionCloses judgingCloses resultsPublishedAt').lean(),
    countBy(SeasonEntry, 'season'),
  ]);

  // Fill the last 6 months, oldest first, including empty months
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(sixMonthsAgo);
    d.setUTCMonth(d.getUTCMonth() + i);
    months.push({ month: monthKey(d), launches: launches.find((l) => l._id === monthKey(d))?.n || 0 });
  }

  res.json({
    generatedAt: new Date(),
    people: { roles, students, verifiedStudents: verified },
    projects: { byStatus: projStatus, byDepartment: deptPublished, byStage: stagePublished, byCategory: categoryPublished, launchesByMonth: months, top },
    lotus: lotusRows.map((r) => ({ department: r._id, students: r.students, scored: r.scored, viva: r.viva })),
    engagement: { likes, backers, feedback: fbStatus, delivered: fbKind, intros },
    live: live[0] ? { withLiveUrl: live[0].n, upNow: live[0].up, avgUptime: live[0].avgUptime == null ? null : Math.round(live[0].avgUptime) } : { withLiveUrl: 0, upNow: 0, avgUptime: null },
    seasons: seasons.map((s) => ({ name: s.name, slug: s.slug, entries: entries[String(s._id)] || 0, resultsPublished: !!s.resultsPublishedAt })),
  });
};

// ---------------- CSV exports ----------------

const stamp = () => new Date().toISOString().slice(0, 10);
const names = (members) => (members || []).map((m) => m.user?.name).filter(Boolean);

// GET /api/admin/export/projects.csv
exports.exportProjects = async (req, res) => {
  const rows = await Project.find().sort({ publishedAt: -1, createdAt: -1 })
    .populate('members.user', 'name').populate('mentor', 'name').lean();
  sendCsv(res, `nec-projects-${stamp()}.csv`, rows, [
    { label: 'Title', key: 'title' }, { label: 'Status', key: 'status' }, { label: 'Stage', key: 'stage' },
    { label: 'Category', key: 'category' }, { label: 'Department', key: 'department' }, { label: 'Year', key: 'year' },
    { label: 'Theme', key: 'theme' }, { label: 'Team', get: (r) => names(r.members) }, { label: 'Mentor', get: (r) => r.mentor?.name },
    { label: 'Published', key: 'publishedAt' }, { label: 'Lab Score', get: (r) => r.labScore?.total },
    { label: 'Lotus team %', get: (r) => r.lotus?.teamPercent }, { label: 'Vivas', get: (r) => r.lotus?.vivas },
    { label: 'Backers', get: (r) => r.counts?.backers }, { label: 'Likes', get: (r) => r.counts?.likes },
    { label: 'Views', get: (r) => r.counts?.views }, { label: 'Stack', get: (r) => r.repo?.stack },
    { label: 'Competitions', get: (r) => (r.competitions || []).map((c) => `${c.name}: ${c.stage}${c.confirmed ? ' ✓' : ''}`) },
    { label: 'Live URL', key: 'liveUrl' }, { label: 'Repo', key: 'repoUrl' },
    { label: 'Page', get: (r) => (r.status === 'published' ? `/p/${r.slug}` : '') },
  ]);
};

// GET /api/admin/export/students.csv — internal: includes email and roll number
exports.exportStudents = async (req, res) => {
  const [students, projects, attempts] = await Promise.all([
    User.find({ role: 'student' }).sort({ 'profile.department': 1, name: 1 }).lean(),
    Project.find({ status: 'published' }).select('title members').lean(),
    LotusAttempt.find({ status: 'scored', set: { $in: await LotusSet.find({ active: true }).distinct('_id') } }).select('user summary viva.done').lean(),
  ]);
  const rows = students.map((u) => {
    const mine = projects.filter((p) => p.members.some((m) => String(m.user) === String(u._id)));
    const att = attempts.filter((a) => String(a.user) === String(u._id));
    return {
      ...u,
      projects: mine.map((p) => p.title),
      bestPetals: Math.max(0, ...att.map((a) => a.summary?.petalsFilled || 0)),
      viva: att.some((a) => a.viva?.done) ? 'yes' : 'no',
    };
  });
  sendCsv(res, `nec-students-${stamp()}.csv`, rows, [
    { label: 'Name', key: 'name' }, { label: 'College email', key: 'email' }, { label: 'Roll no', get: (r) => r.profile?.rollNo },
    { label: 'Department', get: (r) => r.profile?.department }, { label: 'Batch', get: (r) => r.profile?.batch },
    { label: 'Verified', get: (r) => (r.verified ? 'yes' : 'no') }, { label: 'GitHub', key: 'githubUsername' },
    { label: 'Published projects', get: (r) => r.projects }, { label: 'Lotus petals (best)', key: 'bestPetals' },
    { label: 'Viva done', key: 'viva' }, { label: 'Profile', get: (r) => `/u/${r.handle}` }, { label: 'Joined', key: 'createdAt' },
  ]);
};

// GET /api/admin/export/intros.csv — the placement cell's log
exports.exportIntros = async (req, res) => {
  const rows = await IntroRequest.find().sort({ createdAt: -1 })
    .populate('from', 'name email profile.company').populate('student', 'name').populate('project', 'title').populate('handledBy', 'name').lean();
  sendCsv(res, `nec-intro-requests-${stamp()}.csv`, rows, [
    { label: 'Date', key: 'createdAt' }, { label: 'Company', get: (r) => r.from?.profile?.company },
    { label: 'Recruiter', get: (r) => r.from?.name }, { label: 'Recruiter email', get: (r) => r.from?.email },
    { label: 'Student', get: (r) => r.student?.name }, { label: 'Project', get: (r) => r.project?.title },
    { label: 'Purpose', key: 'purpose' }, { label: 'Message', key: 'message' }, { label: 'Status', key: 'status' },
    { label: 'Placement note', key: 'placementNote' }, { label: 'Handled by', get: (r) => r.handledBy?.name }, { label: 'Handled', key: 'handledAt' },
  ]);
};

// GET /api/admin/export/feedback.csv — no visitor email/phone (kept in the portal only)
exports.exportFeedback = async (req, res) => {
  const rows = await Feedback.find().sort({ createdAt: -1 }).populate('project', 'title').lean();
  sendCsv(res, `nec-feedback-${stamp()}.csv`, rows, [
    { label: 'Date', key: 'createdAt' }, { label: 'Project', get: (r) => r.project?.title }, { label: 'Kind', key: 'kind' },
    { label: 'Status', key: 'status' }, { label: 'From', get: (r) => r.from?.name }, { label: 'Relation', get: (r) => r.from?.relation },
    { label: 'Organisation', get: (r) => r.from?.organisation }, { label: 'Rating', key: 'rating' }, { label: 'Message', key: 'message' },
    { label: 'Replies', get: (r) => (r.thread || []).length }, { label: 'Held because', get: (r) => (r.status !== 'delivered' ? r.check?.reasons : '') },
  ]);
};

// GET /api/admin/export/season/:id.csv — entries, averages and every judge's total
exports.exportSeason = async (req, res) => {
  const season = await Season.findById(req.params.id).lean();
  if (!season) return res.status(404).json({ message: 'Season not found' });
  const entries = await SeasonEntry.find({ season: season._id })
    .populate({ path: 'project', select: 'title department members', populate: { path: 'members.user', select: 'name' } })
    .populate('scores.judge', 'name').sort({ track: 1, average: -1 }).lean();
  const winners = new Map((season.winners || []).map((w) => [String(w.project), w.award]));
  sendCsv(res, `${season.slug}-results-${stamp()}.csv`, entries.filter((e) => e.project), [
    { label: 'Track', key: 'track' }, { label: 'Project', get: (r) => r.project.title }, { label: 'Department', get: (r) => r.project.department },
    { label: 'Team', get: (r) => names(r.project.members) }, { label: 'Average /100', key: 'average' }, { label: 'Judges scored', get: (r) => r.scores.length },
    { label: 'Per judge', get: (r) => r.scores.map((s) => `${s.judge?.name}: ${s.total}`) }, { label: 'Award', get: (r) => winners.get(String(r.project._id)) || '' },
  ]);
};
