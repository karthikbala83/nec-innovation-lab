// ---------------------------------------------------------------
// Leaderboards (public). Every board shows the Lab Score AND its
// parts, so a project with few backers but strong code still shows
// up (spec §5). Per-season boards come with Seasons in P3.
// ---------------------------------------------------------------
const Project = require('../projects/Project');
const Setting = require('../settings/Setting');
const Season = require('../seasons/Season');
const SeasonEntry = require('../seasons/SeasonEntry');

const BOARDS = {
  lab: { label: 'Lab Score', sort: { 'labScore.total': -1 }, has: { 'labScore.total': { $gt: 0 } } },
  backed: { label: 'Most backed', sort: { 'counts.backers': -1, 'labScore.total': -1 }, has: { 'counts.backers': { $gt: 0 } } },
  active: { label: 'Most active repo', sort: { 'repo.commitsLast30d': -1, 'labScore.total': -1 }, has: { 'repo.commitsLast30d': { $gt: 0 } } },
  lotus: { label: 'Highest Lotus average', sort: { 'lotus.teamPercent': -1, 'lotus.vivas': -1 }, has: { 'lotus.taken': { $gt: 0 } } },
  uptime: { label: 'Best uptime', sort: { 'live.uptime30d': -1, 'labScore.total': -1 }, has: { 'live.uptime30d': { $ne: null, $exists: true } } },
};

// GET /api/leaderboards?board=lab&department=CSE&category=software
exports.board = async (req, res) => {
  const key = BOARDS[req.query.board] ? req.query.board : 'lab';
  const { sort, has } = BOARDS[key];
  const filter = { status: 'published', ...has };
  if (req.query.department) filter.department = req.query.department;
  if (Project.CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (req.query.season) {   // per-season boards: only that season's entries
    const season = await Season.findOne({ slug: String(req.query.season).toLowerCase() }).select('_id');
    filter._id = { $in: season ? await SeasonEntry.find({ season: season._id }).distinct('project') : [] };
  }

  const [rows, settings] = await Promise.all([
    Project.find(filter)
      .sort(sort)
      .limit(50)
      .select('title slug tagline thumbnail department category stage counts labScore repo.commitsLast30d repo.lastCommitAt live members lotus')
      .populate('members.user', 'name handle')
      .lean(),
    Setting.get(),
  ]);
  res.json({
    board: key,
    boards: Object.fromEntries(Object.entries(BOARDS).map(([k, b]) => [k, b.label])),
    weights: settings.scoreWeights,
    rows: rows.map((p, i) => ({ rank: i + 1, ...p })),
  });
};

// GET /api/leaderboards/weights — public, so anyone can see how the score is made
exports.weights = async (req, res) => {
  const { scoreWeights } = await Setting.get();
  res.json(scoreWeights);
};
