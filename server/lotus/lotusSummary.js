// ---------------------------------------------------------------
// Public-safe Lotus summary per student: petals filled, viva by whom
// and when. Never answers, scores per question or viva notes.
// ---------------------------------------------------------------
const LotusSet = require('./LotusSet');
const LotusAttempt = require('./LotusAttempt');

// { projectIds?, userIds? } -> Map("<projectId>:<userId>" -> summary)
const summaries = async ({ projectIds, userIds } = {}) => {
  const filter = { active: true };
  if (projectIds) filter.project = { $in: projectIds };
  if (userIds) filter.user = { $in: userIds };
  const sets = await LotusSet.find(filter).select('project user status').lean();
  const attempts = await LotusAttempt.find({ set: { $in: sets.map((s) => s._id) } })
    .select('set status summary viva.done viva.at viva.by')
    .populate('viva.by', 'name')
    .lean();
  const bySet = new Map(attempts.map((a) => [String(a.set), a]));

  const out = new Map();
  for (const s of sets) {
    const a = bySet.get(String(s._id));
    const scored = a?.status === 'scored';
    out.set(`${s.project}:${s.user}`, {
      status: scored ? 'scored' : a ? 'in_progress' : s.status === 'failed' ? 'not_started' : 'started',
      petalsFilled: scored ? a.summary.petalsFilled : 0,
      petals: scored ? a.summary.petals.map((p) => ({ petal: p.petal, filled: p.filled })) : [],
      percent: scored ? a.summary.percent : 0,   // used for Lab Score / sorting; UI shows petals
      viva: a?.viva?.done ? { done: true, by: a.viva.by?.name, at: a.viva.at } : { done: false },
    });
  }
  return out;
};

const EMPTY = { status: 'not_started', petalsFilled: 0, petals: [], percent: 0, viva: { done: false } };

// Members of one project, in team order
const forProject = async (project) => {
  const map = await summaries({ projectIds: [project._id] });
  return project.members.filter((m) => m.user).map((m) => {
    const id = String(m.user._id || m.user);
    return { user: id, ...(map.get(`${project._id}:${id}`) || EMPTY) };
  });
};

module.exports = { summaries, forProject, EMPTY };
