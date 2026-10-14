// ---------------------------------------------------------------
// Back / follow / comment on a published project.
// Counts on the project are re-counted from the source collection
// after every change (never ++/-- blindly), so they cannot drift.
// ---------------------------------------------------------------
const Project = require('../projects/Project');
const Backing = require('./Backing');
const Follow = require('./Follow');
const Comment = require('./Comment');
const User = require('../models/User');
const { recomputeSoon } = require('../score/labScore');
const { checkMessage } = require('../moderation/contentCheck');

const COMMENTS_PER_10_MIN = 10;

const fail = (status, message) => Object.assign(new Error(message), { status });

// Published project (or 404). Community actions only happen on public pages.
const publishedProject = async (id) => {
  const project = await Project.findById(id);
  if (!project || project.status !== 'published') throw fail(404, 'Project not found');
  return project;
};

const isModerator = (project, user) =>
  !!user && (user.role === 'admin' || String(project.mentor) === String(user._id));

const syncBackerCounts = async (projectId) => {
  const [college, pub] = await Promise.all([
    Backing.countDocuments({ project: projectId, type: 'back', fromCollege: true }),
    Backing.countDocuments({ project: projectId, type: 'back', fromCollege: false }),
  ]);
  await Project.updateOne({ _id: projectId }, {
    $set: { 'counts.backers': college + pub, 'counts.backersCollege': college, 'counts.backersPublic': pub },
  });
  recomputeSoon(projectId);
};

// ===================== Backing =====================

// POST /api/projects/:id/back   { type: back|mentor|pilot, note }
exports.back = async (req, res) => {
  const project = await publishedProject(req.params.id);
  const type = req.body.type || 'back';
  const note = String(req.body.note || '').trim();
  if (!Backing.TYPES.includes(type)) throw fail(400, 'Unknown backing type');
  if (project.isMember(req.user._id)) throw fail(400, 'You can\'t back your own project');
  if (type === 'mentor' && req.user.role !== 'faculty') throw fail(403, 'Mentor offers are for faculty');
  if (type !== 'back' && !note) throw fail(400, type === 'pilot' ? 'Say who will run the pilot and where' : 'Add a short note for the team');

  const backing = await Backing.findOneAndUpdate(
    { project: project._id, user: req.user._id, type },
    {
      $set: { note: note || undefined },
      $setOnInsert: {
        fromCollege: User.isCollegeEmail(req.user.email),
        status: type === 'pilot' ? 'pending' : 'active',   // admin confirms pilots
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
  if (type === 'back') await syncBackerCounts(project._id);
  res.status(201).json(backing);
};

// DELETE /api/projects/:id/back?type=back
exports.unback = async (req, res) => {
  const type = req.query.type || 'back';
  const gone = await Backing.findOneAndDelete({ project: req.params.id, user: req.user._id, type });
  if (!gone) throw fail(404, 'Nothing to undo');
  if (type === 'back') await syncBackerCounts(gone.project);
  if (type === 'pilot' && gone.status === 'confirmed') recomputeSoon(gone.project);
  res.json({ message: 'Removed' });
};

// GET /api/projects/:id/backers — public: names of college backers, mentor and pilot offers
exports.backers = async (req, res) => {
  await publishedProject(req.params.id);
  const rows = await Backing.find({ project: req.params.id, status: { $in: ['active', 'confirmed', 'pending'] } })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('user', 'name handle role verified')
    .lean();
  // Pending pilots are visible to everyone as "offered", but only confirmed ones earn the badge
  res.json({
    backers: rows.filter((b) => b.type === 'back').map(({ user, fromCollege, createdAt }) => ({ user, fromCollege, createdAt })),
    mentors: rows.filter((b) => b.type === 'mentor').map(({ user, note, createdAt }) => ({ user, note, createdAt })),
    pilots: rows.filter((b) => b.type === 'pilot' && b.status !== 'declined')
      .map(({ _id, user, note, status, createdAt }) => ({ _id, user, note, status, createdAt })),
  });
};

// GET /api/projects/:id/viewer — what the signed-in user has done on this project
exports.viewerState = async (req, res) => {
  const [backings, follow] = await Promise.all([
    Backing.find({ project: req.params.id, user: req.user._id }).select('type status note').lean(),
    Follow.exists({ project: req.params.id, user: req.user._id }),
  ]);
  res.json({ backings, following: !!follow });
};

// ===================== Follow =====================

const syncFollowers = async (projectId) => {
  const n = await Follow.countDocuments({ project: projectId });
  await Project.updateOne({ _id: projectId }, { $set: { 'counts.followers': n } });
  recomputeSoon(projectId);
  return n;
};

// POST /api/projects/:id/follow
exports.follow = async (req, res) => {
  const project = await publishedProject(req.params.id);
  await Follow.updateOne(
    { project: project._id, user: req.user._id },
    { $setOnInsert: { project: project._id, user: req.user._id } },
    { upsert: true }
  );
  res.status(201).json({ following: true, followers: await syncFollowers(project._id) });
};

// DELETE /api/projects/:id/follow
exports.unfollow = async (req, res) => {
  await Follow.deleteOne({ project: req.params.id, user: req.user._id });
  res.json({ following: false, followers: await syncFollowers(req.params.id) });
};

// GET /api/me/following — projects I follow
exports.myFollows = async (req, res) => {
  const follows = await Follow.find({ user: req.user._id }).sort({ createdAt: -1 }).select('project').lean();
  const projects = await Project.find({ _id: { $in: follows.map((f) => f.project) }, status: 'published' })
    .select('title slug tagline thumbnail stage department counts labScore.total repo.stack members live')
    .populate('members.user', 'name handle')
    .lean();
  res.json(projects);
};

// ===================== Comments =====================

const syncCommentCount = async (projectId) => {
  const n = await Comment.countDocuments({ project: projectId, hidden: false, deleted: false });
  await Project.updateOne({ _id: projectId }, { $set: { 'counts.comments': n } });
};

const shape = (c, viewer, mod) => ({
  _id: c._id,
  parent: c.parent,
  user: c.user,
  body: c.deleted ? '' : c.body,
  deleted: c.deleted,
  hidden: c.hidden,
  createdAt: c.createdAt,
  mine: !!viewer && String(c.user?._id) === String(viewer._id),
  reported: !!viewer && (c.reports || []).some((r) => String(r) === String(viewer._id)),
  ...(mod ? { reports: (c.reports || []).length } : {}),
});

// GET /api/projects/:id/comments — public; moderators also see hidden ones
exports.listComments = async (req, res) => {
  const project = await publishedProject(req.params.id);
  const mod = isModerator(project, req.user);
  const filter = { project: project._id };
  if (!mod) filter.hidden = false;
  const all = await Comment.find(filter).sort({ createdAt: 1 }).limit(500)
    .populate('user', 'name handle role verified').lean();

  const top = all.filter((c) => !c.parent).reverse();   // newest thread first
  const replies = all.filter((c) => c.parent);
  res.json({
    canModerate: mod,
    comments: top.map((c) => ({
      ...shape(c, req.user, mod),
      replies: replies.filter((r) => String(r.parent) === String(c._id)).map((r) => shape(r, req.user, mod)),
    })),
  });
};

// POST /api/projects/:id/comments   { body, parent? }
exports.addComment = async (req, res) => {
  const project = await publishedProject(req.params.id);
  const recent = await Comment.countDocuments({ user: req.user._id, createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } });
  if (recent >= COMMENTS_PER_10_MIN) throw fail(429, 'Slow down — try again in a few minutes');

  const check = checkMessage(req.body.body, { kind: 'comment', skipRelevance: true, minLength: 2 });
  if (check.verdict !== 'pass') throw Object.assign(new Error(check.reasons[0]), { status: 400, reasons: check.reasons });

  let parent = null;
  if (req.body.parent) {
    const p = await Comment.findOne({ _id: req.body.parent, project: project._id });
    if (!p) throw fail(400, 'That comment is gone');
    parent = p.parent || p._id;   // replies to a reply join the same thread
  }
  const comment = await Comment.create({ project: project._id, user: req.user._id, body: req.body.body, parent });
  await comment.populate('user', 'name handle role verified');
  await syncCommentCount(project._id);
  res.status(201).json({ ...shape(comment.toObject(), req.user, false), replies: [] });
};

// DELETE /api/comments/:cid — author blanks their own comment
exports.deleteComment = async (req, res) => {
  const c = await Comment.findById(req.params.cid);
  if (!c || c.deleted) throw fail(404, 'Comment not found');
  if (String(c.user) !== String(req.user._id) && req.user.role !== 'admin') throw fail(403, 'Not your comment');
  c.deleted = true;
  c.body = undefined;
  await c.save();
  await syncCommentCount(c.project);
  res.json({ message: 'Deleted' });
};

// POST /api/comments/:cid/report — once per user; enough reports hide it for review
exports.reportComment = async (req, res) => {
  const c = await Comment.findByIdAndUpdate(req.params.cid, { $addToSet: { reports: req.user._id } }, { new: true });
  if (!c) throw fail(404, 'Comment not found');
  if (!c.hidden && c.reports.length >= Comment.AUTO_HIDE_REPORTS) {
    c.hidden = true;
    await c.save();
    await syncCommentCount(c.project);
  }
  res.json({ message: 'Thanks — a moderator will look at it' });
};

// POST /api/comments/:cid/hide   { hidden: true|false } — project mentor or admin
exports.hideComment = async (req, res) => {
  const c = await Comment.findById(req.params.cid);
  if (!c) throw fail(404, 'Comment not found');
  const project = await Project.findById(c.project).select('mentor');
  if (!isModerator(project, req.user)) throw fail(403, 'Only the mentor or an admin can hide comments');
  c.hidden = req.body.hidden !== false;
  c.hiddenBy = req.user._id;
  if (!c.hidden) c.reports = [];   // un-hiding clears the reports
  await c.save();
  await syncCommentCount(c.project);
  res.json({ hidden: c.hidden });
};
