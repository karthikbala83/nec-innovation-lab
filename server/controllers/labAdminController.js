// ---------------------------------------------------------------
// Admin: Lab Score weights, pilot confirmations, reported comments,
// and a button to run the daily checks now.
// ---------------------------------------------------------------
const Setting = require('../settings/Setting');
const Backing = require('../community/Backing');
const Comment = require('../community/Comment');
const { recomputeSoon } = require('../score/labScore');
const { runDailyChecks, rescoreAll } = require('../jobs/dailyChecks');

// GET /api/admin/lab — everything the Lab admin page needs in one call
exports.overview = async (req, res) => {
  const [settings, pilots, reported] = await Promise.all([
    Setting.get(),
    Backing.find({ type: 'pilot', status: 'pending' }).sort({ createdAt: 1 })
      .populate('user', 'name email handle role').populate('project', 'title slug').lean(),
    Comment.find({ 'reports.0': { $exists: true } }).sort({ updatedAt: -1 }).limit(50)
      .populate('user', 'name handle').populate('project', 'title slug').lean(),
  ]);
  res.json({
    weights: settings.scoreWeights,
    lastDailyChecks: settings.jobs?.dailyChecksAt || null,
    pilots,
    reported: reported.map((c) => ({ ...c, reports: c.reports.length })),
  });
};

// PUT /api/admin/lab/weights   { understanding, build, works, community, recognition, freshness }
exports.setWeights = async (req, res) => {
  const settings = await Setting.get();
  for (const k of Object.keys(Setting.DEFAULT_WEIGHTS)) {
    if (req.body[k] !== undefined) settings.scoreWeights[k] = Number(req.body[k]);
  }
  await settings.save();   // model rejects weights that don't add up to 100
  const rescored = await rescoreAll();
  res.json({ weights: settings.scoreWeights, rescored });
};

// POST /api/admin/backings/:id/decide   { status: confirmed|declined }
exports.decidePilot = async (req, res) => {
  const status = req.body.status === 'declined' ? 'declined' : 'confirmed';
  const backing = await Backing.findOneAndUpdate(
    { _id: req.params.id, type: 'pilot' },
    { $set: { status, reviewedBy: req.user._id } },
    { new: true }
  );
  if (!backing) return res.status(404).json({ message: 'Pilot offer not found' });
  recomputeSoon(backing.project);   // Recognition part
  res.json(backing);
};

// POST /api/admin/jobs/daily-checks — run now and wait for the report
exports.runChecks = async (req, res) => {
  res.json(await runDailyChecks());
};
