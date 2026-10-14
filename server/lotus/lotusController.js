// ---------------------------------------------------------------
// Lotus Blossom endpoints. Who sees what:
//   student   own questions, answers, scores, feedback, viva note
//   mentor    every member of their mentee projects (+ admins)
//   public    petals filled per member + "Viva by Dr. X on <date>"
// ---------------------------------------------------------------
const Project = require('../projects/Project');
const LotusSet = require('./LotusSet');
const LotusAttempt = require('./LotusAttempt');
const service = require('./lotusService');
const { useMock } = require('../services/lotusClient');

const fail = (status, message) => Object.assign(new Error(message), { status });

const isFacultyFor = (project, user) =>
  user.role === 'admin' || String(project.mentor) === String(user._id);

// The student's own view (questions + their answers + scores)
const ownView = (set, attempt) => ({
  set: set && {
    _id: set._id, status: set.status, error: set.error, mock: set.mock, generatedAt: set.generatedAt,
    questions: set.questions, dropped: set.dropped, petals: LotusSet.PETALS,
  },
  attempt: attempt && {
    _id: attempt._id, status: attempt.status, error: attempt.error, answers: attempt.answers,
    submittedAt: attempt.submittedAt, scoredAt: attempt.scoredAt, summary: attempt.summary,
    viva: attempt.viva?.done ? { done: true, at: attempt.viva.at, by: attempt.viva.by, note: attempt.viva.note } : { done: false },
  },
});

// GET /api/lotus/projects/:projectId — my Lotus check for this project
exports.mine = async (req, res) => {
  const project = await Project.findById(req.params.projectId).select('members title slug status');
  if (!project) throw fail(404, 'Project not found');
  if (!project.isMember(req.user._id)) throw fail(403, 'Not your project');
  const set = await LotusSet.findOne({ project: project._id, user: req.user._id, active: true });
  const attempt = set && await LotusAttempt.findOne({ set: set._id }).populate('viva.by', 'name');
  res.json({ project: { _id: project._id, title: project.title, slug: project.slug }, mockMode: useMock(), ...ownView(set, attempt) });
};

// POST /api/lotus/projects/:projectId/start
exports.start = async (req, res) => {
  const set = await service.start(req.params.projectId, req.user);
  res.status(202).json(ownView(set, null));
};

const ownAttempt = async (req) => {
  const attempt = await LotusAttempt.findById(req.params.id);
  if (!attempt) throw fail(404, 'Attempt not found');
  if (String(attempt.user) !== String(req.user._id)) throw fail(403, 'Not your attempt');
  return attempt;
};

// PUT /api/lotus/attempts/:id/answers   { answers: [{ qid, answer }] }
exports.saveAnswers = async (req, res) => {
  const attempt = await service.saveAnswers(await ownAttempt(req), req.body.answers);
  res.json({ saved: true, updatedAt: attempt.updatedAt });
};

// POST /api/lotus/attempts/:id/submit
exports.submit = async (req, res) => {
  const attempt = await service.submit(await ownAttempt(req));
  res.status(202).json({ status: attempt.status });
};

// ---------- faculty (viva mode) ----------

// GET /api/lotus/projects/:projectId/review — every member's questions, answers and scores
exports.review = async (req, res) => {
  const project = await Project.findById(req.params.projectId)
    .select('title slug mentor members status repo.importedAt')
    .populate('members.user', 'name handle githubUsername');
  if (!project) throw fail(404, 'Project not found');
  if (!isFacultyFor(project, req.user)) throw fail(403, 'Only this project\'s mentor can review Lotus answers');

  const sets = await LotusSet.find({ project: project._id, active: true });
  const attempts = await LotusAttempt.find({ set: { $in: sets.map((s) => s._id) } }).populate('viva.by', 'name');
  res.json({
    project: { _id: project._id, title: project.title, slug: project.slug },
    petals: LotusSet.PETALS,
    members: project.members.filter((m) => m.user).map((m) => {
      const set = sets.find((s) => String(s.user) === String(m.user._id));
      const attempt = set && attempts.find((a) => String(a.set) === String(set._id));
      return { user: m.user, role: m.role, ...ownView(set, attempt) };
    }),
  });
};

const facultyAttempt = async (req) => {
  const attempt = await LotusAttempt.findById(req.params.id);
  if (!attempt) throw fail(404, 'Attempt not found');
  const project = await Project.findById(attempt.project).select('mentor');
  if (!isFacultyFor(project, req.user)) throw fail(403, 'Only this project\'s mentor can do this');
  return attempt;
};

// POST /api/lotus/attempts/:id/override   { qid, score: 0-3 | null, note }
exports.override = async (req, res) => {
  const attempt = await service.override(await facultyAttempt(req), req.body);
  res.json({ summary: attempt.summary, answers: attempt.answers });
};

// POST /api/lotus/attempts/:id/viva   { done, note }
exports.viva = async (req, res) => {
  const attempt = await service.setViva(await facultyAttempt(req), req.body, req.user);
  await attempt.populate('viva.by', 'name');
  res.json({ viva: attempt.viva });
};

// POST /api/lotus/projects/:projectId/reset   { user }
exports.reset = async (req, res) => {
  const project = await Project.findById(req.params.projectId).select('mentor members');
  if (!project) throw fail(404, 'Project not found');
  if (!isFacultyFor(project, req.user)) throw fail(403, 'Only this project\'s mentor can reset a Lotus check');
  if (!project.isMember(req.body.user)) throw fail(400, 'That student is not on this team');
  await service.reset(project._id, req.body.user);
  res.json({ message: 'Reset. The student can start a new Lotus check.' });
};
