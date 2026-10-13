// ---------------------------------------------------------------
// POST /api/uploads/presign  { projectId, kind, contentType, size }
// Only the project's team (or an admin) may upload into its folder.
// ---------------------------------------------------------------
const Project = require('../projects/Project');
const { presignImageUpload, isConfigured, TYPES, KINDS, config } = require('../services/s3');

exports.status = (req, res) => {
  res.json({ enabled: isConfigured(), maxMb: config().maxBytes / 1048576, types: Object.keys(TYPES) });
};

exports.presign = async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ message: 'Uploads are not set up yet; paste an image link instead' });
  const { projectId, kind, contentType, size } = req.body;
  if (!KINDS.includes(kind)) return res.status(400).json({ message: 'Unknown upload kind' });
  if (!TYPES[contentType]) return res.status(400).json({ message: 'Upload a PNG, JPG, WebP or GIF image' });
  const { maxBytes } = config();
  if (!(Number(size) > 0) || Number(size) > maxBytes) {
    return res.status(400).json({ message: `Images must be under ${maxBytes / 1048576} MB` });
  }

  const project = await Project.findById(projectId).select('members status');
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (!project.isMember(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only the team can upload to this project' });
  }
  if (project.status === 'archived') return res.status(400).json({ message: 'Archived projects are read-only' });

  res.json(await presignImageUpload({ projectId: String(project._id), kind, contentType }));
};
