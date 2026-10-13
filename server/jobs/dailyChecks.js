// ---------------------------------------------------------------
// Daily checks, once every ~24 h:
//   1. ping every published project's live URL   -> uptime
//   2. refresh imported repos (only with GITHUB_TOKEN; unchanged
//      repos cost 2 API calls thanks to the sha cache)
//   3. recompute every Lab Score (activity and freshness decay)
//
// Runs inside the API (startScheduler, checks hourly whether it is due)
// or on its own:  npm run daily   (for Render cron / GitHub Actions)
// Free hosting that sleeps when idle may skip days — uptime is then
// "x% of the checks that ran", which the Lab Score detail says.
// ---------------------------------------------------------------
const Project = require('../projects/Project');
const MetricDaily = require('../feed/MetricDaily');
const Setting = require('../settings/Setting');
const { checkUrl } = require('../services/liveCheck');
const { importRepo } = require('../projects/repoImport');
const { recompute } = require('../score/labScore');

const DUE_AFTER_MS = 23 * 60 * 60 * 1000;
let running = null;

const inBatches = async (items, size, fn) => {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
};

const runDailyChecks = () => {
  if (running) return running;   // never two runs at once
  running = (async () => {
    const started = Date.now();
    const report = { checked: 0, up: 0, reposRefreshed: 0, repoErrors: 0, scored: 0 };
    const projects = await Project.find({ status: 'published' }).select('liveUrl repoUrl members');

    // 1. live URLs, 5 at a time
    await inBatches(projects.filter((p) => p.liveUrl), 5, async (p) => {
      const r = await checkUrl(p.liveUrl);
      report.checked += 1;
      if (r.ok) report.up += 1;
      await MetricDaily.recordCheck(p._id, r.ok, r.status);
      await Project.updateOne({ _id: p._id }, { $set: { 'live.checkedAt': new Date(), 'live.ok': r.ok, 'live.status': r.status } });
    });

    // 2. repos (one at a time: kind to the GitHub rate limit)
    if (process.env.GITHUB_TOKEN) {
      for (const p of projects.filter((x) => x.repoUrl)) {
        try {
          await importRepo(await Project.findById(p._id));   // full doc: import saves it
          report.reposRefreshed += 1;
        } catch {
          report.repoErrors += 1;   // repo deleted / made private: keep the last snapshot
        }
      }
    }

    // 3. scores
    const { scoreWeights } = await Setting.get();
    for (const p of projects) {
      await recompute(p._id, { weights: scoreWeights });
      report.scored += 1;
    }

    await Setting.updateOne({ key: 'global' }, { $set: { 'jobs.dailyChecksAt': new Date() } }, { upsert: true });
    report.seconds = Math.round((Date.now() - started) / 1000);
    console.log('Daily checks done:', JSON.stringify(report));
    return report;
  })().finally(() => { running = null; });
  return running;
};

// Recompute every published project (e.g. after the admin changes the weights)
const rescoreAll = async () => {
  const { scoreWeights } = await Setting.get();
  const ids = await Project.find({ status: 'published' }).distinct('_id');
  for (const id of ids) await recompute(id, { weights: scoreWeights });
  return ids.length;
};

const startScheduler = () => {
  if (process.env.JOBS_ENABLED === 'false') return;
  const tick = async () => {
    try {
      const s = await Setting.get();
      const last = s.jobs?.dailyChecksAt?.getTime() || 0;
      if (Date.now() - last > DUE_AFTER_MS) await runDailyChecks();
    } catch (err) {
      console.error('Daily checks failed:', err.message);
    }
  };
  setTimeout(tick, 60 * 1000).unref();                 // a minute after boot
  setInterval(tick, 60 * 60 * 1000).unref();           // then check hourly whether it's due
};

module.exports = { runDailyChecks, rescoreAll, startScheduler };

// npm run daily
if (require.main === module) {
  require('dotenv').config();
  require('../config/db').connect()
    .then(runDailyChecks)
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
