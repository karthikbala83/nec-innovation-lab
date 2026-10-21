// ---------------------------------------------------------------
// Seasons & Demo Day.
//   public   list, season page, entries gallery, winners wall
//   team     enter a published project while submissions are open
//   judges   score entries on the rubric while judging is open
//            (never a project they mentor — conflict of interest)
//   admin    create/edit seasons, see the ranking, publish winners
// Entering adds "<season> · registered" to the project's competitions;
// publishing results upgrades winners (confirmed) — this feeds the
// Lab Score "Recognition" part automatically.
// ---------------------------------------------------------------
const Season = require('./Season');
const SeasonEntry = require('./SeasonEntry');
const Project = require('../projects/Project');
const User = require('../models/User');
const { recomputeSoon } = require('../score/labScore');
const { sendSoon } = require('../services/mailer');
const { clientUrl } = require('../controllers/authController');

const fail = (status, message) => Object.assign(new Error(message), { status });
const CARD = 'title slug tagline thumbnail screenshots videoUrl stage category department members counts labScore.total repo.stack lotus';

const bySlug = async (slug) => {
  const season = await Season.findOne({ slug: String(slug).toLowerCase() });
  if (!season) throw fail(404, 'Season not found');
  return season;
};
const isJudge = (season, user) => !!user && season.judges.some((j) => String(j) === String(user._id));

const summary = (s, counts = {}) => ({
  _id: s._id, name: s.name, slug: s.slug, kind: s.kind, description: s.description, tracks: s.tracks,
  submissionOpens: s.submissionOpens, submissionCloses: s.submissionCloses, judgingCloses: s.judgingCloses,
  demoDayAt: s.demoDayAt, venue: s.venue, phase: s.phase(), entries: counts[String(s._id)] || 0,
  resultsPublishedAt: s.resultsPublishedAt,
});

// GET /api/seasons — current first, then upcoming, then past
exports.list = async (req, res) => {
  const seasons = await Season.find().sort({ submissionOpens: -1 }).limit(100);
  const counts = Object.fromEntries((await SeasonEntry.aggregate([{ $group: { _id: '$season', n: { $sum: 1 } } }])).map((c) => [String(c._id), c.n]));
  const order = { open: 0, judging: 1, closed: 2, upcoming: 3, results: 4 };
  res.json(seasons.map((s) => summary(s, counts)).sort((a, b) => order[a.phase] - order[b.phase]));
};

// GET /api/seasons/:slug — season page (scores only for judges/admins; results for everyone once published)
exports.detail = async (req, res) => {
  const season = await bySlug(req.params.slug);
  await season.populate('judges', 'name handle profile.department');
  const admin = req.user?.role === 'admin';
  const judge = isJudge(season, req.user);
  const phase = season.phase();

  const entries = await SeasonEntry.find({ season: season._id })
    .populate({ path: 'project', select: CARD, populate: { path: 'members.user', select: 'name handle' } })
    .sort({ createdAt: 1 })
    .lean();
  const live = entries.filter((e) => e.project);

  const out = summary(season, { [String(season._id)]: live.length });
  out.criteria = season.criteria;
  out.judges = season.judges.map((j) => ({ _id: j._id, name: j.name, handle: j.handle, department: j.profile?.department }));
  out.entries = live.map((e) => ({
    _id: e._id, track: e.track, pitch: e.pitch, project: e.project, createdAt: e.createdAt,
    ...(admin || phase === 'results' ? { average: e.average, judged: e.scores.length } : {}),
  }));
  if (phase === 'results') {
    const winners = await Project.find({ _id: { $in: season.winners.map((w) => w.project) } }).select(CARD).populate('members.user', 'name handle').lean();
    out.winners = season.winners.map((w) => ({ ...w.toObject(), project: winners.find((p) => String(p._id) === String(w.project)) }))
      .filter((w) => w.project).sort((a, b) => (a.track || '').localeCompare(b.track || '') || a.rank - b.rank);
  }

  // What the signed-in viewer can do here
  const viewer = { isAdmin: admin, isJudge: judge, canEnter: false, myProjects: [] };
  if (req.user && phase === 'open') {
    const mine = await Project.find({ 'members.user': req.user._id, status: 'published' }).select('title slug').lean();
    viewer.myProjects = mine.map((p) => ({ ...p, entry: live.find((e) => String(e.project._id) === String(p._id))?._id || null }));
    viewer.canEnter = mine.length > 0;
  }
  out.viewer = viewer;
  res.json(out);
};

// ---------------- team: enter / withdraw ----------------

// POST /api/seasons/:slug/entries   { project, track, pitch }
exports.enter = async (req, res) => {
  const season = await bySlug(req.params.slug);
  if (season.phase() !== 'open') throw fail(400, 'Submissions are not open for this season');
  const project = await Project.findById(req.body.project);
  if (!project || project.status !== 'published') throw fail(400, 'Only published projects can be entered');
  if (!project.isMember(req.user._id)) throw fail(403, 'Only the team can enter its project');
  if (!season.tracks.includes(req.body.track)) throw fail(400, `Pick a track: ${season.tracks.join(', ')}`);
  if (await SeasonEntry.exists({ season: season._id, project: project._id })) throw fail(409, 'Already entered');

  const entry = await SeasonEntry.create({
    season: season._id, project: project._id, track: req.body.track, enteredBy: req.user._id,
    pitch: String(req.body.pitch || '').trim().slice(0, 280) || undefined,
  });
  if (!project.competitions.some((c) => c.name === season.name)) {
    project.competitions.push({ name: season.name, stage: 'registered', date: season.demoDayAt || season.judgingCloses });
    await project.save();
    recomputeSoon(project._id);
  }
  res.status(201).json(entry);
};

// DELETE /api/seasons/:slug/entries/:entryId
exports.withdraw = async (req, res) => {
  const season = await bySlug(req.params.slug);
  if (season.phase() !== 'open') throw fail(400, 'Entries can only be withdrawn while submissions are open');
  const entry = await SeasonEntry.findOne({ _id: req.params.entryId, season: season._id });
  if (!entry) throw fail(404, 'Entry not found');
  const project = await Project.findById(entry.project);
  if (!project?.isMember(req.user._id) && req.user.role !== 'admin') throw fail(403, 'Only the team can withdraw');
  await entry.deleteOne();
  project.competitions = project.competitions.filter((c) => !(c.name === season.name && c.stage === 'registered'));
  await project.save();
  recomputeSoon(project._id);
  res.json({ message: 'Withdrawn' });
};

// ---------------- judges ----------------

// GET /api/seasons/:slug/judging — entries with MY scores; projects I mentor are flagged
exports.judging = async (req, res) => {
  const season = await bySlug(req.params.slug);
  if (!isJudge(season, req.user) && req.user.role !== 'admin') throw fail(403, 'You are not a judge for this season');
  const entries = await SeasonEntry.find({ season: season._id })
    .populate({ path: 'project', select: `${CARD} mentor liveUrl videoUrl repoUrl` })
    .sort({ track: 1, createdAt: 1 })
    .lean();
  res.json({
    season: { name: season.name, slug: season.slug, phase: season.phase(), criteria: season.criteria, judgingCloses: season.judgingCloses },
    entries: entries.filter((e) => e.project).map((e) => {
      const mine = e.scores.find((s) => String(s.judge) === String(req.user._id));
      return {
        _id: e._id, track: e.track, pitch: e.pitch, project: e.project,
        conflict: String(e.project.mentor) === String(req.user._id),
        myScore: mine ? { marks: mine.marks, total: mine.total, comment: mine.comment } : null,
        judged: e.scores.length,
      };
    }),
  });
};

// PUT /api/seasons/:slug/entries/:entryId/score   { marks: { key: 0..10 }, comment }
exports.score = async (req, res) => {
  const season = await bySlug(req.params.slug);
  if (!isJudge(season, req.user)) throw fail(403, 'You are not a judge for this season');
  if (season.phase() !== 'judging') throw fail(400, 'Judging is not open right now');
  const entry = await SeasonEntry.findOne({ _id: req.params.entryId, season: season._id });
  if (!entry) throw fail(404, 'Entry not found');
  const project = await Project.findById(entry.project).select('mentor members');
  if (String(project.mentor) === String(req.user._id)) throw fail(403, 'You mentor this project, so another judge must score it');

  const marks = {};
  for (const c of season.criteria) {
    const m = Number(req.body.marks?.[c.key]);
    if (!Number.isFinite(m) || m < 0 || m > 10) throw fail(400, `Give "${c.label}" a mark from 0 to 10`);
    marks[c.key] = Math.round(m * 2) / 2;   // half marks allowed
  }
  const scoreDoc = { judge: req.user._id, marks, total: SeasonEntry.weightedTotal(marks, season.criteria), comment: String(req.body.comment || '').slice(0, 1000), at: new Date() };
  entry.scores = [...entry.scores.filter((s) => String(s.judge) !== String(req.user._id)), scoreDoc];
  entry.average = Math.round((entry.scores.reduce((s, x) => s + x.total, 0) / entry.scores.length) * 10) / 10;
  await entry.save();
  res.json({ total: scoreDoc.total, average: entry.average, judged: entry.scores.length });
};

// ---------------- admin ----------------

const EDITABLE = ['name', 'kind', 'description', 'tracks', 'submissionOpens', 'submissionCloses', 'judgingCloses', 'demoDayAt', 'venue', 'judges', 'criteria'];

const checkJudges = async (ids = []) => {
  const users = await User.find({ _id: { $in: ids } }).select('role');
  if (users.length !== ids.length || users.some((u) => !['faculty', 'admin'].includes(u.role))) {
    throw fail(400, 'Judges must be faculty (or admins) with portal accounts');
  }
};

// POST /api/admin/seasons
exports.create = async (req, res) => {
  const body = Object.fromEntries(EDITABLE.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
  if (body.judges) await checkJudges(body.judges);
  const season = await Season.create({ ...body, createdBy: req.user._id });
  res.status(201).json(summary(season));
};

// PUT /api/admin/seasons/:id
exports.update = async (req, res) => {
  const season = await Season.findById(req.params.id);
  if (!season) throw fail(404, 'Season not found');
  if (req.body.judges) await checkJudges(req.body.judges);
  for (const k of EDITABLE) if (req.body[k] !== undefined) season[k] = req.body[k];
  await season.save();
  res.json(summary(season));
};

// GET /api/admin/seasons/:id/ranking — every entry with each judge's total
exports.ranking = async (req, res) => {
  const season = await Season.findById(req.params.id);
  if (!season) throw fail(404, 'Season not found');
  const entries = await SeasonEntry.find({ season: season._id })
    .populate('project', 'title slug department').populate('scores.judge', 'name').lean();
  const tracks = {};
  for (const e of entries.filter((x) => x.project)) {
    (tracks[e.track] ||= []).push({
      entry: e._id, project: e.project, average: e.average, judged: e.scores.length,
      scores: e.scores.map((s) => ({ judge: s.judge?.name, total: s.total, comment: s.comment })),
    });
  }
  Object.values(tracks).forEach((list) => list.sort((a, b) => (b.average ?? -1) - (a.average ?? -1)));
  res.json({ season: summary(season), judges: season.judges.length, tracks, winners: season.winners });
};

// POST /api/admin/seasons/:id/results   { winners: [{ project, track, award, rank }] }
exports.publishResults = async (req, res) => {
  const season = await Season.findById(req.params.id);
  if (!season) throw fail(404, 'Season not found');
  if (['upcoming', 'open'].includes(season.phase())) throw fail(400, 'Publish results after submissions close');
  const winners = (req.body.winners || []).map((w) => ({
    project: w.project, track: w.track, award: String(w.award || '').trim().slice(0, 60) || (w.rank === 1 ? 'Winner' : 'Runner-up'), rank: Number(w.rank) || 1,
  }));
  if (!winners.length) throw fail(400, 'Pick at least one winner');
  const entered = new Set((await SeasonEntry.find({ season: season._id }).distinct('project')).map(String));
  if (winners.some((w) => !entered.has(String(w.project)))) throw fail(400, 'Winners must be entries of this season');

  // Project badges: rank 1 = confirmed winner, others = finalist; everyone else stays "registered"
  const projects = await Project.find({ _id: { $in: [...entered] } }).populate('owner', 'email name');
  for (const p of projects) {
    const w = winners.find((x) => String(x.project) === String(p._id));
    p.competitions = p.competitions.filter((c) => c.name !== season.name);
    p.competitions.push({
      name: season.name, stage: w ? (w.rank === 1 ? 'winner' : 'finalist') : 'registered',
      confirmed: !!w && w.rank === 1, date: season.demoDayAt || season.judgingCloses,
    });
    await p.save();
    recomputeSoon(p._id);
    if (w && p.owner?.email && !season.resultsPublishedAt) {
      sendSoon({
        to: p.owner.email,
        subject: `${p.title}: ${w.award} at ${season.name}!`,
        heading: `Congratulations — ${w.award}!`,
        paragraphs: [`${p.title} is on the ${season.name} winners wall (${w.track}). The badge now shows on your launch page.`],
        cta: { label: 'See the winners wall', url: `${clientUrl()}/seasons/${season.slug}` },
      });
    }
  }
  season.winners = winners;
  season.resultsPublishedAt = season.resultsPublishedAt || new Date();
  await season.save();
  res.json({ published: true, winners: season.winners.length });
};
