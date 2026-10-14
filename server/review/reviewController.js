// ---------------------------------------------------------------
// Mentor approval queue. Nothing is public until a mentor (or an
// admin) approves it: in_review -> published, or back to draft
// with a note saying what to fix.
// ---------------------------------------------------------------
const Project = require('../projects/Project');
const RepoSnapshot = require('../projects/RepoSnapshot');
const { recomputeSoon } = require('../score/labScore');

const isReviewer = (project, user) =>
  user.role === 'admin' || String(project.mentor) === String(user._id);

// GET /api/review?status=in_review  — faculty see their mentees, admin sees all
exports.queue = async (req, res) => {
  const status = Project.STATUSES.includes(req.query.status) ? req.query.status : 'in_review';
  const filter = { status };
  if (req.user.role !== 'admin') filter.mentor = req.user._id;
  const projects = await Project.find(filter)
    .sort({ 'review.submittedAt': 1, updatedAt: -1 })   // oldest request first
    .select('title slug tagline department year stage category status review repo members mentor updatedAt lotus')
    .populate('members.user', 'name handle')
    .populate('mentor', 'name')
    .lean();
  // Attach the duplicate-check flag (mentor/admin only)
  const snaps = await RepoSnapshot.find({ project: { $in: projects.map((p) => p._id) } })
    .select('project duplicate').populate('duplicate.matches.project', 'title slug').lean();
  projects.forEach((p) => {
    const d = snaps.find((s) => String(s.project) === String(p._id))?.duplicate;
    if (d?.matches?.length) p.duplicate = d;
  });
  res.json(projects);
};

const decide = (approve) => async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (!isReviewer(project, req.user)) return res.status(403).json({ message: 'Only this project\'s mentor can review it' });
  if (project.status !== 'in_review') return res.status(400).json({ message: `Project is ${project.status.replace('_', ' ')}, not in review` });

  const note = String(req.body.note || '').trim();
  if (!approve && !note) return res.status(400).json({ message: 'Tell the team what to fix' });

  project.status = approve ? 'published' : 'draft';
  if (approve && !project.publishedAt) project.publishedAt = new Date();   // first launch date sticks
  project.review = {
    submittedAt: project.review?.submittedAt,
    reviewedAt: new Date(),
    reviewedBy: req.user._id,
    note: note || undefined,
  };
  await project.save();
  if (approve) recomputeSoon(project._id);   // first Lab Score on launch
  res.json(project);
};

// POST /api/review/:id/approve
exports.approve = decide(true);
// POST /api/review/:id/return   { note }
exports.sendBack = decide(false);
