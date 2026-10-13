// ---------------------------------------------------------------
// Projects: create/edit (wizard), submit for review, repo import,
// public launch page. Who-may-do-what lives here; data rules live
// in the Project model.
// ---------------------------------------------------------------
const Project = require('./Project');
const RepoSnapshot = require('./RepoSnapshot');
const MetricDaily = require('../feed/MetricDaily');
const User = require('../models/User');
const { importRepo } = require('./repoImport');

const PUBLIC_USER = User.PUBLIC_FIELDS;
const NEW_DAYS = 14;

// Fields a team may set from the wizard. Everything else (status, counts,
// repo summary, owner, review) is set by the server only.
const EDITABLE = [
  'title', 'tagline', 'thumbnail', 'department', 'year', 'theme', 'category', 'stage',
  'problem', 'solution', 'impact', 'architectureImage', 'liveUrl', 'repoUrl', 'videoUrl',
  'screenshots', 'lookingFor', 'competitions', 'mentor',
];   // members: handled separately below

const notFound = (res) => res.status(404).json({ message: 'Project not found' });

const canEdit = (project, user) => user.role === 'admin' || project.isMember(user._id);

// Apply whitelisted fields, enforcing role rules on stage, competitions, team and mentor
const applyChanges = async (project, body, user) => {
  const isAdmin = user.role === 'admin';
  const before = {
    stage: project.stage,
    confirmed: new Set(project.competitions.filter((c) => c.confirmed).map((c) => `${c.name}|${c.stage}`)),
  };
  for (const key of EDITABLE) {
    if (body[key] === undefined) continue;
    project[key] = body[key] === '' ? undefined : body[key];
  }

  if (body.stage && body.stage !== before.stage && !isAdmin && !Project.TEAM_STAGES.includes(body.stage)) {
    const err = new Error('Pilot, incubation and startup stages are confirmed by an admin');
    err.status = 403;
    throw err;
  }

  if (body.competitions) {
    // Only an admin can confirm. A team re-saving keeps confirmations on unchanged
    // entries; a newly claimed "winner" stays unconfirmed.
    project.competitions.forEach((c, i) => {
      c.confirmed = isAdmin ? !!body.competitions[i]?.confirmed : before.confirmed.has(`${c.name}|${c.stage}`);
    });
  }

  if (body.mentor) {
    const mentor = await User.findById(body.mentor).select('role');
    if (!mentor || mentor.role !== 'faculty') {
      const err = new Error('Mentor must be a faculty member');
      err.status = 400;
      throw err;
    }
  }

  if (body.members) {
    // Team = registered students (college email). Owner always stays on the team.
    const ids = body.members.map((m) => m.user);
    const users = await User.find({ _id: { $in: ids } }).select('role githubUsername');
    if (users.length !== new Set(ids.map(String)).size) {
      const err = new Error('Every team member must have signed up on the portal');
      err.status = 400;
      throw err;
    }
    if (users.some((u) => u.role !== 'student')) {
      const err = new Error('Team members must be students; add faculty as the mentor');
      err.status = 400;
      throw err;
    }
    const byId = new Map(users.map((u) => [String(u._id), u]));
    const seen = new Set();
    project.members = body.members
      .filter((m) => !seen.has(String(m.user)) && seen.add(String(m.user)))
      .map((m) => ({
        user: m.user,
        role: m.role || 'Developer',
        githubUsername: m.githubUsername || byId.get(String(m.user))?.githubUsername,
      }));
  }
};

// POST /api/projects  — students start a draft
exports.create = async (req, res) => {
  const project = new Project({ owner: req.user._id, department: req.user.profile?.department, year: req.user.profile?.year });
  await applyChanges(project, req.body, req.user);
  if (!project.members.length) {
    project.members = [{ user: req.user._id, role: 'Lead', githubUsername: req.user.githubUsername }];
  }
  await project.save();
  res.status(201).json(project);
};

// GET /api/projects/mine — every project I'm on, any status
exports.mine = async (req, res) => {
  const projects = await Project.find({ 'members.user': req.user._id })
    .sort({ updatedAt: -1 })
    .select('title slug tagline status stage review publishedAt updatedAt repo.importedAt thumbnail')
    .lean();
  res.json(projects);
};

// GET /api/projects/:idOrSlug — launch page (public once published)
exports.getOne = async (req, res) => {
  const { idOrSlug } = req.params;
  const query = /^[a-f0-9]{24}$/.test(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug.toLowerCase() };
  const project = await Project.findOne(query)
    .populate('members.user', PUBLIC_USER)
    .populate('mentor', 'name handle profile.department')
    .populate('review.reviewedBy', 'name');
  if (!project || !project.canView(req.user)) return notFound(res);

  const isTeam = !!req.user && project.isMember(req.user._id);
  const isMentor = !!req.user && String(project.mentor?._id) === String(req.user._id);
  const isAdmin = req.user?.role === 'admin';

  // Count a view on public pages, not when the team admires its own page
  if (project.status === 'published' && !isTeam) {
    Project.updateOne({ _id: project._id }, { $inc: { 'counts.views': 1 } }).catch(() => {});
    MetricDaily.addView(project._id).catch(() => {});
  }

  // Code panel: public summary; secret warnings only for team / mentor / admin
  const snap = await RepoSnapshot.findOne({ project: project._id })
    .select('owner name sha defaultBranch meta languages stack weeklyCommits memberStats.user memberStats.githubUsername memberStats.commits memberStats.lastCommitAt unmappedCommits skipped scan fetchedAt secretWarnings commits')
    .slice('commits', 5)
    .lean();
  let code = null;
  if (snap) {
    const { secretWarnings, ...rest } = snap;
    code = rest;
    if (isTeam || isMentor || isAdmin) code.secretWarnings = secretWarnings;
  }

  const out = project.toObject();
  delete out.review;   // reviewer notes are for the team
  if (isTeam || isMentor || isAdmin) out.review = project.review;
  out.isNewLaunch = !!project.publishedAt && Date.now() - project.publishedAt.getTime() < NEW_DAYS * 864e5;
  out.viewer = { isTeam, isMentor, isAdmin, canEdit: !!req.user && canEdit(project, req.user) };
  out.code = code;
  res.json(out);
};

// PUT /api/projects/:id — wizard saves each step here
exports.update = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return notFound(res);
  if (!canEdit(project, req.user)) return res.status(403).json({ message: 'Only the team can edit this project' });
  if (project.status === 'archived') return res.status(400).json({ message: 'Archived projects are read-only' });

  // Only the owner (or admin) changes who is on the team
  if (req.body.members && String(project.owner) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only the project owner can change the team' });
  }
  if (req.body.members && !req.body.members.some((m) => String(m.user) === String(project.owner))) {
    return res.status(400).json({ message: 'The project owner must stay on the team' });
  }

  await applyChanges(project, req.body, req.user);
  await project.save();
  res.json(project);
};

// POST /api/projects/:id/submit — draft -> in_review (mentor sees it in their queue)
exports.submit = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return notFound(res);
  if (!project.isMember(req.user._id)) return res.status(403).json({ message: 'Only the team can submit' });
  if (project.status !== 'draft') return res.status(400).json({ message: `Project is already ${project.status.replace('_', ' ')}` });

  const missing = project.missingForReview();
  if (missing.length) return res.status(400).json({ message: `Add ${missing.join(', ')} before submitting`, missing });

  project.status = 'in_review';
  project.review = { submittedAt: new Date() };
  await project.save();
  res.json(project);
};

// POST /api/projects/:id/archive — owner or admin hides it from the feed
exports.archive = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return notFound(res);
  if (String(project.owner) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only the owner or an admin can archive' });
  }
  project.status = 'archived';
  await project.save();
  res.json(project);
};

// POST /api/projects/:id/import — pull the public GitHub repo (cached)
exports.importRepo = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return notFound(res);
  if (!canEdit(project, req.user)) return res.status(403).json({ message: 'Only the team can import the repo' });

  try {
    const { snapshot, cached } = await importRepo(project, { force: req.query.force === '1' });
    res.json({ cached, snapshot: snapshotForTeam(snapshot) });
  } catch (err) {
    if (err.name !== 'TimeoutError') throw err;
    res.status(504).json({ message: 'GitHub took too long. Try again in a minute.' });
  }
};

// GET /api/projects/:id/snapshot — full import result for the team / mentor / admin
exports.snapshot = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return notFound(res);
  const allowed = canEdit(project, req.user) || String(project.mentor) === String(req.user._id);
  if (!allowed) return res.status(403).json({ message: 'Not your project' });
  const snapshot = await RepoSnapshot.findOne({ project: project._id });
  res.json({ snapshot: snapshot ? snapshotForTeam(snapshot) : null });
};

// Wizard view of a snapshot: no file contents, trimmed lists
const snapshotForTeam = (s) => {
  const o = s.toObject ? s.toObject() : s;
  return {
    owner: o.owner, name: o.name, sha: o.sha, defaultBranch: o.defaultBranch, meta: o.meta,
    languages: o.languages, stack: o.stack, skipped: o.skipped, scan: o.scan,
    files: o.tree?.length || 0, treeTruncated: o.treeTruncated,
    keyFiles: (o.keyFiles || []).map((f) => f.path),
    totalCommits: o.commits?.length || 0, detailedCommits: o.detailedCommits,
    recentCommits: (o.commits || []).slice(0, 5).map(({ files, ...c }) => c),
    weeklyCommits: o.weeklyCommits, memberStats: o.memberStats, unmappedCommits: o.unmappedCommits,
    secretWarnings: o.secretWarnings, fetchedAt: o.fetchedAt, durationMs: o.durationMs, apiCalls: o.apiCalls,
  };
};
