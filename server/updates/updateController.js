// ---------------------------------------------------------------
// Update timeline: the team posts, everyone reads once published.
// ---------------------------------------------------------------
const Project = require('../projects/Project');
const Update = require('./Update');
const { recomputeSoon } = require('../score/labScore');

const fail = (status, message) => Object.assign(new Error(message), { status });

const syncCount = async (projectId) => {
  const n = await Update.countDocuments({ project: projectId });
  await Project.updateOne({ _id: projectId }, { $set: { 'counts.updates': n } });
  recomputeSoon(projectId);   // Freshness part
};

// GET /api/projects/:id/updates — public once published; team/mentor/admin always
exports.list = async (req, res) => {
  const project = await Project.findById(req.params.id).select('status members mentor');
  if (!project || !project.canView(req.user)) throw fail(404, 'Project not found');
  const updates = await Update.find({ project: project._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('author', 'name handle')
    .lean();
  res.json(updates);
};

// POST /api/projects/:id/updates   { title, body, media }
exports.create = async (req, res) => {
  const project = await Project.findById(req.params.id).select('members status');
  if (!project) throw fail(404, 'Project not found');
  if (!project.isMember(req.user._id)) throw fail(403, 'Only the team can post updates');
  if (project.status === 'archived') throw fail(400, 'Archived projects are read-only');

  const { title, body, media } = req.body;
  const update = await Update.create({ project: project._id, author: req.user._id, title, body, media: media || undefined });
  await update.populate('author', 'name handle');
  await syncCount(project._id);
  res.status(201).json(update);
};

// DELETE /api/updates/:uid — the author, the project owner or an admin
exports.remove = async (req, res) => {
  const update = await Update.findById(req.params.uid);
  if (!update) throw fail(404, 'Update not found');
  const project = await Project.findById(update.project).select('owner');
  const allowed = req.user.role === 'admin'
    || String(update.author) === String(req.user._id)
    || String(project?.owner) === String(req.user._id);
  if (!allowed) throw fail(403, 'Not your update');
  await update.deleteOne();
  await syncCount(update.project);
  res.json({ message: 'Deleted' });
};
