// ---------------------------------------------------------------
// Recruiter view (spec §4): find students through their published
// projects. Filter by stack, stage, department, Lotus petal strength
// and viva. Returns public profile fields only — contact goes through
// an intro request to the placement cell.
// ---------------------------------------------------------------
const Project = require('../projects/Project');
const User = require('../models/User');
const lotusSummary = require('../lotus/lotusSummary');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/talent?stack=React&stage=live&department=CSE&minPetals=4&viva=1&q=…&page=1
exports.search = async (req, res) => {
  const { stack, stage, department, q } = req.query;
  const minPetals = Math.min(8, Math.max(0, Number(req.query.minPetals) || 0));
  const vivaOnly = req.query.viva === '1';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 24;

  const pFilter = { status: 'published' };
  if (stack) pFilter['repo.stack'] = stack;
  if (Project.STAGES.includes(stage)) pFilter.stage = stage;
  if (department) pFilter.department = department;
  const projects = await Project.find(pFilter)
    .select('title slug tagline stage department repo.stack labScore.total members')
    .lean();

  const userIds = [...new Set(projects.flatMap((p) => p.members.map((m) => String(m.user))))];
  const uFilter = { _id: { $in: userIds }, role: 'student' };
  if (q) {
    const re = new RegExp(escapeRegex(String(q).slice(0, 60)), 'i');
    uFilter.$or = [{ name: re }, { 'profile.skills': re }, { githubUsername: re }];
  }
  const [users, lotus] = await Promise.all([
    User.find(uFilter).select(User.PUBLIC_FIELDS).lean(),
    lotusSummary.summaries({ projectIds: projects.map((p) => p._id), userIds }),
  ]);

  const rows = users.map((u) => {
    const mine = projects.filter((p) => p.members.some((m) => String(m.user) === String(u._id)));
    const perProject = mine.map((p) => ({
      _id: p._id, title: p.title, slug: p.slug, stage: p.stage, stack: p.repo?.stack || [], labScore: p.labScore?.total || 0,
      role: p.members.find((m) => String(m.user) === String(u._id))?.role,
      lotus: lotus.get(`${p._id}:${u._id}`) || lotusSummary.EMPTY,
    }));
    const best = perProject.reduce((b, p) => (p.lotus.petalsFilled > b.petalsFilled ? p.lotus : b), lotusSummary.EMPTY);
    const viva = perProject.find((p) => p.lotus.viva.done)?.lotus.viva || { done: false };
    return {
      user: u,
      projects: perProject,
      stack: [...new Set(perProject.flatMap((p) => p.stack))].slice(0, 10),
      lotus: { petalsFilled: best.petalsFilled, viva },
    };
  }).filter((r) => r.lotus.petalsFilled >= minPetals && (!vivaOnly || r.lotus.viva.done));

  // Strongest proof first: viva, then petals, then best Lab Score
  rows.sort((a, b) => (b.lotus.viva.done - a.lotus.viva.done)
    || (b.lotus.petalsFilled - a.lotus.petalsFilled)
    || (Math.max(0, ...b.projects.map((p) => p.labScore)) - Math.max(0, ...a.projects.map((p) => p.labScore))));

  res.json({ total: rows.length, page, pages: Math.ceil(rows.length / limit), rows: rows.slice((page - 1) * limit, page * limit) });
};
