// ---------------------------------------------------------------
// Lab Score 0–100 (spec §5). Never a black box: every part is
// stored with its weight, its 0–1 score, the points it earned and
// one line saying why.
//
//   computeLabScore(inputs, weights, now)  pure — unit tested
//   recompute(projectId)                   gathers inputs, saves
//
// Each part is scored 0..1, then × its weight (weights sum to 100).
// ---------------------------------------------------------------
const Project = require('../projects/Project');
const RepoSnapshot = require('../projects/RepoSnapshot');
const MetricDaily = require('../feed/MetricDaily');
const Backing = require('../community/Backing');
const Update = require('../updates/Update');
const Setting = require('../settings/Setting');

const DAY = 864e5;
const clamp = (x) => Math.max(0, Math.min(1, x));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---- the six parts ----

// Lotus Blossom + viva arrive in P2. Until then: 0, clearly labelled.
const understanding = () => ({ score: 0, pending: true, detail: 'Lotus Blossom check arrives in P2' });

// Commits in the last 30 days (20+ = full), how recent the last one is, and how much of the team commits
const build = ({ commits = [], teamSize = 1 }, now) => {
  if (!commits.length) return { score: 0, detail: 'No repo imported' };
  const last30 = commits.filter((c) => now - new Date(c.date) <= 30 * DAY);
  const lastAt = Math.max(...commits.map((c) => new Date(c.date).getTime()));
  const daysSince = (now - lastAt) / DAY;
  const recency = daysSince <= 7 ? 1 : clamp(1 - (daysSince - 7) / 53);   // 0 after 60 days
  const active = new Set(last30.map((c) => (c.authorLogin || '').toLowerCase()).filter(Boolean)).size;
  const score = 0.5 * clamp(last30.length / 20) + 0.3 * recency + 0.2 * clamp(active / Math.max(1, teamSize));
  return {
    score,
    detail: `${plural(last30.length, 'commit')} in 30 days by ${active} ${active === 1 ? 'person' : 'people'}, last ${daysSince < 1 ? 'today' : `${Math.floor(daysSince)}d ago`}`,
  };
};

// Share of daily checks in the last 30 days where the live URL answered
const works = ({ liveUrl, checks = [] }) => {
  if (!liveUrl) return { score: 0, detail: 'No live URL' };
  if (!checks.length) return { score: 0, detail: 'Not checked yet' };
  const up = checks.filter(Boolean).length;
  const pct = Math.round((up / checks.length) * 100);
  return { score: up / checks.length, uptime: pct, detail: `${pct}% up over ${plural(checks.length, 'daily check')}` };
};

// Backers ×3 + followers ×2 + views ÷20; 150 points = full marks
const community = ({ backers = 0, followers = 0, views = 0 }) => {
  const points = backers * 3 + followers * 2 + views / 20;
  return { score: clamp(points / 150), detail: `${plural(backers, 'backer')}, ${plural(followers, 'follower')}, ${plural(views, 'view')}` };
};

// Best single achievement counts (not the sum — one real win beats five registrations)
const COMP = { registered: 0.1, shortlisted: 0.3, finalist: 0.6, winner: 0.6 };   // unconfirmed winner = finalist
const STAGE = { pilot: 0.6, incubation: 0.8, startup: 1 };
const recognition = ({ competitions = [], stage, confirmedPilots = 0 }) => {
  const options = [[0, '']];
  for (const c of competitions) {
    const s = c.stage === 'winner' && c.confirmed ? 1 : COMP[c.stage] || 0;
    options.push([s, `${c.name}: ${c.stage === 'winner' && !c.confirmed ? 'winner (unconfirmed)' : c.stage}`]);
  }
  if (STAGE[stage]) options.push([STAGE[stage], `Stage: ${stage}`]);
  if (confirmedPilots) options.push([0.6, plural(confirmedPilots, 'confirmed pilot')]);
  const [score, why] = options.sort((a, b) => b[0] - a[0])[0];
  return { score, detail: why || 'No competitions, pilots or incubation yet' };
};

// Updates posted in the last 60 days: 1 = half, 2+ = full
const freshness = ({ updates60d = 0 }) => ({
  score: clamp(updates60d / 2),
  detail: `${plural(updates60d, 'update')} in the last 60 days`,
});

const PARTS = { understanding, build, works, community, recognition, freshness };

const computeLabScore = (inputs, weights = Setting.DEFAULT_WEIGHTS, now = Date.now()) => {
  const parts = {};
  let total = 0;
  for (const [key, fn] of Object.entries(PARTS)) {
    const { score, ...rest } = fn(inputs, now);
    const weight = weights[key] ?? 0;
    const points = Math.round(score * weight * 10) / 10;
    parts[key] = { weight, score: Math.round(score * 100) / 100, points, ...rest };
    total += points;
  }
  return { total: Math.round(total), parts };
};

// ---- gather inputs from the database and save on the project ----
const recompute = async (projectId, { weights } = {}) => {
  const project = await Project.findById(projectId);
  if (!project) return null;
  const now = Date.now();
  const w = weights || (await Setting.get()).scoreWeights;

  const [snap, checks, confirmedPilots, updates60d] = await Promise.all([
    RepoSnapshot.findOne({ project: project._id }).select('commits.date commits.authorLogin').lean(),
    MetricDaily.find({ project: project._id, date: { $gte: new Date(now - 30 * DAY) }, uptimeOk: { $ne: null } })
      .select('uptimeOk').lean(),
    Backing.countDocuments({ project: project._id, type: 'pilot', status: 'confirmed' }),
    Update.countDocuments({ project: project._id, createdAt: { $gte: new Date(now - 60 * DAY) } }),
  ]);

  const commits = snap?.commits || [];
  const result = computeLabScore({
    commits,
    teamSize: project.members.length,
    liveUrl: project.liveUrl,
    checks: checks.map((c) => c.uptimeOk),
    backers: project.counts.backers,
    followers: project.counts.followers,
    views: project.counts.views,
    competitions: project.competitions,
    stage: project.stage,
    confirmedPilots,
    updates60d,
  }, w, now);

  // Keep the commit counters fresh too (they decay without a new import)
  const since = (days) => commits.filter((c) => now - new Date(c.date) <= days * DAY).length;
  await Project.updateOne({ _id: project._id }, {
    $set: {
      labScore: { ...result, computedAt: new Date(now) },
      'repo.commitsLast7d': since(7),
      'repo.commitsLast30d': since(30),
      'live.uptime30d': result.parts.works.uptime ?? null,
    },
  });
  return result;
};

// Fire-and-forget version for request handlers: a failed recompute must not fail the request
const recomputeSoon = (projectId) => {
  recompute(projectId).catch((err) => console.error('Lab Score recompute failed:', err.message));
};

module.exports = { computeLabScore, recompute, recomputeSoon, PARTS };
