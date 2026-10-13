// ---------------------------------------------------------------
// Home feed (public). Two tabs in P0:
//   new       newest launches first; "New" badge for the first 14 days
//   trending  last-7-day score = views + 3 × commits this week
//             (+ backers once P1 lands). Ties -> newest first.
// Filters: department, year, stage, category, theme, stack, q.
// ---------------------------------------------------------------
const Project = require('../projects/Project');

const NEW_DAYS = 14;
const DAY = 864e5;

const CARD = {
  title: 1, slug: 1, tagline: 1, thumbnail: 1, stage: 1, category: 1, department: 1, year: 1, theme: 1,
  publishedAt: 1, counts: 1, liveUrl: 1, 'repo.stack': 1, 'repo.languages': 1, 'repo.lastCommitAt': 1,
  'members.user': 1, 'members.role': 1,
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildFilter = (q) => {
  const filter = { status: 'published' };
  if (q.department) filter.department = q.department;
  if (q.year) filter.year = Number(q.year);
  if (Project.STAGES.includes(q.stage)) filter.stage = q.stage;
  if (Project.CATEGORIES.includes(q.category)) filter.category = q.category;
  if (q.theme) filter.theme = q.theme;
  if (q.stack) filter['repo.stack'] = q.stack;
  if (q.q) {
    const re = new RegExp(escapeRegex(String(q.q).slice(0, 60)), 'i');
    filter.$or = [{ title: re }, { tagline: re }, { theme: re }, { 'repo.stack': re }];
  }
  return filter;
};

// GET /api/feed?tab=new|trending&page=1&limit=20&department=CSE…
exports.feed = async (req, res) => {
  const tab = req.query.tab === 'trending' ? 'trending' : 'new';
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const filter = buildFilter(req.query);
  const weekAgo = new Date(Date.now() - 7 * DAY);

  const pipeline = [{ $match: filter }];
  if (tab === 'trending') {
    pipeline.push(
      {
        $lookup: {                     // views in the last 7 days from metricsDaily
          from: 'metricsDaily',
          let: { pid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$project', '$$pid'] }, date: { $gte: weekAgo } } },
            { $group: { _id: null, views: { $sum: '$views' } } },
          ],
          as: 'week',
        },
      },
      {
        $addFields: {
          weekViews: { $ifNull: [{ $arrayElemAt: ['$week.views', 0] }, 0] },
        },
      },
      {
        $addFields: {
          trendScore: {
            $add: [
              '$weekViews',
              { $multiply: [3, { $ifNull: ['$repo.commitsLast7d', 0] }] },
              { $multiply: [5, { $ifNull: ['$counts.backers', 0] }] },
            ],
          },
        },
      },
      { $sort: { trendScore: -1, publishedAt: -1 } }
    );
  } else {
    pipeline.push({ $sort: { publishedAt: -1 } });
  }
  pipeline.push({
    $facet: {
      items: [
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { ...CARD, ...(tab === 'trending' ? { trendScore: 1, weekViews: 1 } : {}) } },
      ],
      total: [{ $count: 'n' }],
    },
  });

  const [result] = await Project.aggregate(pipeline);
  const items = await Project.populate(result.items, { path: 'members.user', select: 'name handle' });
  const newSince = Date.now() - NEW_DAYS * DAY;
  items.forEach((p) => { p.isNewLaunch = new Date(p.publishedAt).getTime() >= newSince; });

  const total = result.total[0]?.n || 0;
  res.json({ tab, items, total, page, pages: Math.ceil(total / limit) });
};

// GET /api/feed/filters — values that actually occur, for the filter dropdowns
exports.filters = async (req, res) => {
  const base = { status: 'published' };
  const [departments, themes, stacks] = await Promise.all([
    Project.distinct('department', base),
    Project.distinct('theme', base),
    Project.distinct('repo.stack', base),
  ]);
  const clean = (a) => a.filter(Boolean).sort();
  res.json({
    departments: clean(departments), themes: clean(themes), stacks: clean(stacks),
    stages: Project.STAGES, categories: Project.CATEGORIES,
  });
};
