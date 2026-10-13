// ---------------------------------------------------------------
// GitHub import: public repo -> RepoSnapshot (+ summary on Project).
//
//   1. cache      fresh snapshot? return it, zero GitHub calls.
//                 same head commit? keep it, 1 call.
//   2. metadata   repo, tree (with blob hashes), languages, commits
//   3. detail     file lists for the latest N commits (who touched what)
//   4. tarball    whole repo in one download: skip rules, key files,
//                 secret scan (masked, private to the team)
//   5. mapping    commits -> team members by GitHub username
// ---------------------------------------------------------------
const zlib = require('zlib');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const tar = require('tar-stream');
const RepoSnapshot = require('./RepoSnapshot');
const Project = require('./Project');
const { createClient, GitHubError } = require('../services/github');
const { skipReason, scanSecrets, detectStack, isKeyFile } = require('./repoRules');

const env = (name, fallback) => Number(process.env[name] || fallback);
const CACHE_MS = () => env('GITHUB_CACHE_MINUTES', 30) * 60 * 1000;
const MAX_COMMITS = () => env('GITHUB_MAX_COMMITS', 300);
// Without a token we only get 60 calls/hour, so fetch far fewer commit details
const DETAIL_COMMITS = () => (process.env.GITHUB_TOKEN ? env('GITHUB_COMMIT_DETAILS', 40) : 8);
const MAX_TARBALL_BYTES = () => env('GITHUB_MAX_TARBALL_MB', 50) * 1024 * 1024;
const KEY_FILE_CHARS = 20000;
const WEEKS = 12;

// ---- small helpers ----
const inBatches = async (items, size, fn) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
};

const mondayOf = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
};

// Commits per week, last 12 weeks, oldest first (feeds the sparkline)
const weeklyCounts = (commits, now = new Date()) => {
  const thisWeek = mondayOf(now).getTime();
  const weeks = Array.from({ length: WEEKS }, (_, i) => ({
    week: new Date(thisWeek - (WEEKS - 1 - i) * 7 * 864e5), count: 0,
  }));
  for (const c of commits) {
    const idx = WEEKS - 1 - Math.round((thisWeek - mondayOf(c.date).getTime()) / (7 * 864e5));
    if (idx >= 0 && idx < WEEKS) weeks[idx].count += 1;
  }
  return weeks;
};

// ---- Step 5: who did what. Pure: re-run on cached data when the team changes. ----
const mapMembers = (commits, members) => {
  const byLogin = new Map();
  for (const m of members) {
    const login = (m.githubUsername || m.user?.githubUsername || '').toLowerCase();
    if (login) byLogin.set(login, m);
  }
  const stats = new Map();
  let unmapped = 0;
  for (const c of commits) {
    const m = byLogin.get((c.authorLogin || '').toLowerCase());
    if (!m) { unmapped += 1; continue; }
    const key = String(m.user?._id || m.user);
    if (!stats.has(key)) {
      stats.set(key, {
        user: m.user?._id || m.user, githubUsername: c.authorLogin, commits: 0, lastCommitAt: null, files: new Map(),
      });
    }
    const s = stats.get(key);
    s.commits += 1;
    if (!s.lastCommitAt || c.date > s.lastCommitAt) s.lastCommitAt = c.date;
    for (const f of c.files || []) s.files.set(f, (s.files.get(f) || 0) + 1);
  }
  const memberStats = [...stats.values()].map((s) => ({
    ...s,
    files: [...s.files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100).map(([path, changes]) => ({ path, changes })),
  }));
  return { memberStats, unmappedCommits: unmapped };
};

// ---- Step 4: stream the tarball once ----
const scanTarball = async (res) => {
  const keyFiles = [];
  const secretWarnings = [];
  let filesScanned = 0;
  let downloaded = 0;
  let complete = true;
  const limit = MAX_TARBALL_BYTES();

  const extract = tar.extract();
  const counted = Readable.fromWeb(res.body);
  counted.on('data', (chunk) => {
    downloaded += chunk.length;
    if (downloaded > limit) {
      complete = false;
      counted.destroy(new Error('TARBALL_TOO_BIG'));
    }
  });

  const consume = (async () => {
    for await (const entry of extract) {
      const { type, size } = entry.header;
      // GitHub prefixes every path with "<owner>-<repo>-<sha>/"
      const path = entry.header.name.split('/').slice(1).join('/');
      if (type !== 'file' || !path || skipReason(path, size)) {
        entry.resume();
        continue;
      }
      const chunks = [];
      for await (const chunk of entry) chunks.push(chunk);
      const buf = Buffer.concat(chunks);
      if (buf.includes(0)) continue;   // binary we did not catch by extension
      const text = buf.toString('utf8');
      filesScanned += 1;
      if (isKeyFile(path)) keyFiles.push({ path, size, content: text.slice(0, KEY_FILE_CHARS) });
      if (secretWarnings.length < 50) secretWarnings.push(...scanSecrets(path, text).slice(0, 50 - secretWarnings.length));
    }
  })();

  try {
    await Promise.all([pipeline(counted, zlib.createGunzip(), extract), consume]);
  } catch (err) {
    if (err.message !== 'TARBALL_TOO_BIG' && complete) throw err;
  }
  return {
    keyFiles,
    secretWarnings,
    scan: {
      filesScanned,
      complete,
      note: complete ? undefined : `Repo is larger than ${limit / 1048576} MB; scanned the first part only`,
    },
  };
};

// ---- Steps 2-4: talk to GitHub ----
const fetchFromGitHub = async (client, owner, name, repoMeta, sha) => {
  const [tree, languages] = await Promise.all([client.tree(owner, name, sha), client.languages(owner, name)]);

  // Commits, newest first, up to MAX_COMMITS
  const raw = [];
  for (let page = 1; raw.length < MAX_COMMITS(); page++) {
    const batch = await client.commits(owner, name, sha, page);
    raw.push(...batch);
    if (batch.length < 100) break;
  }
  const commits = raw.slice(0, MAX_COMMITS()).map((c) => ({
    sha: c.sha,
    authorLogin: c.author?.login || '',
    authorName: c.commit?.author?.name || '',
    date: new Date(c.commit?.author?.date || c.commit?.committer?.date),
    message: (c.commit?.message || '').split('\n')[0].slice(0, 200),
  }));

  // File lists for the latest commits (1 call each, 8 at a time)
  const detailed = commits.slice(0, DETAIL_COMMITS());
  await inBatches(detailed, 8, async (c) => {
    const d = await client.commit(owner, name, c.sha);
    c.files = (d.files || []).map((f) => f.filename).filter((f) => !skipReason(f)).slice(0, 100);
  });

  // Tree: kept files + why the rest were skipped
  const reasons = {};
  const kept = [];
  for (const node of tree.tree || []) {
    if (node.type !== 'blob') continue;
    const why = skipReason(node.path, node.size);
    if (why) reasons[why] = (reasons[why] || 0) + 1;
    else kept.push(node);
  }

  const scanned = await scanTarball(await client.tarball(owner, name, sha));

  return {
    meta: {
      description: repoMeta.description || '',
      stars: repoMeta.stargazers_count,
      forks: repoMeta.forks_count,
      license: repoMeta.license?.spdx_id || '',
      topics: repoMeta.topics || [],
      createdAt: repoMeta.created_at,
      pushedAt: repoMeta.pushed_at,
      htmlUrl: repoMeta.html_url,
    },
    languages,
    tree: kept.slice(0, 5000).map((n) => ({ path: n.path, size: n.size })),
    fileHashes: kept.slice(0, 5000).map((n) => ({ path: n.path, sha: n.sha })),
    treeTruncated: !!tree.truncated,
    skipped: { count: Object.values(reasons).reduce((a, b) => a + b, 0), reasons },
    commits,
    detailedCommits: detailed.length,
    weeklyCommits: weeklyCounts(commits),
    stack: detectStack(kept.map((n) => n.path), scanned.keyFiles),
    ...scanned,
  };
};

// Copy the headline numbers onto the project (feed + launch page read these)
const summarise = async (project, snapshot) => {
  const langs = Object.entries(Object.fromEntries(snapshot.languages || []))
    .sort((a, b) => b[1] - a[1]).map(([l]) => l).slice(0, 6);
  const weekAgo = Date.now() - 7 * 864e5;
  project.repo = {
    snapshot: snapshot._id,
    importedAt: snapshot.fetchedAt,
    stack: snapshot.stack,
    languages: langs,
    lastCommitAt: snapshot.commits[0]?.date,
    commitsLast7d: snapshot.commits.filter((c) => new Date(c.date).getTime() >= weekAgo).length,
    totalCommits: snapshot.commits.length,
  };
  await project.save();
};

const running = new Map();   // projectId -> promise, so double-clicks don't import twice

// Public entry point. Returns the saved snapshot.
const importRepo = (project, { force = false } = {}) => {
  const key = String(project._id);
  if (running.has(key)) return running.get(key);
  const job = doImport(project, { force }).finally(() => running.delete(key));
  running.set(key, job);
  return job;
};

const doImport = async (project, { force }) => {
  const parsed = Project.parseRepoUrl(project.repoUrl);
  if (!parsed) throw new GitHubError('Add a public GitHub repo link first (https://github.com/owner/repo)', 400);
  const { owner, name } = parsed;

  // Members with their GitHub usernames (project override, else profile)
  await project.populate('members.user', 'githubUsername');
  const members = project.members;

  const started = Date.now();
  let snapshot = await RepoSnapshot.findOne({ project: project._id });
  const sameRepo = snapshot && snapshot.owner?.toLowerCase() === owner.toLowerCase()
    && snapshot.name?.toLowerCase() === name.toLowerCase();

  // 1a. Fresh enough: no GitHub calls at all (force still waits 2 minutes)
  const age = sameRepo ? Date.now() - snapshot.fetchedAt.getTime() : Infinity;
  if (age < (force ? 2 * 60 * 1000 : CACHE_MS())) {
    Object.assign(snapshot, mapMembers(snapshot.commits, members));
    await snapshot.save();
    await summarise(project, snapshot);
    return { snapshot, cached: true };
  }

  const client = createClient();
  const repoMeta = await client.repo(owner, name);
  if (repoMeta.private) throw new GitHubError('Repository is private. Make it public to import it.', 400);
  if (repoMeta.size === 0) throw new GitHubError('Repository is empty', 409);
  const sha = (await client.headSha(owner, name, repoMeta.default_branch)).trim();

  // 1b. Nothing new pushed: keep the snapshot, refresh the clock
  if (sameRepo && snapshot.sha === sha) {
    snapshot.fetchedAt = new Date();
    Object.assign(snapshot, mapMembers(snapshot.commits, members));
    await snapshot.save();
    await summarise(project, snapshot);
    return { snapshot, cached: true };
  }

  const data = await fetchFromGitHub(client, owner, name, repoMeta, sha);
  const fields = {
    project: project._id, owner, name, sha, defaultBranch: repoMeta.default_branch,
    ...data,
    ...mapMembers(data.commits, members),
    fetchedAt: new Date(),
    durationMs: Date.now() - started,
    apiCalls: client.calls,
  };
  snapshot = await RepoSnapshot.findOneAndUpdate({ project: project._id }, fields, {
    upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true,
  });
  await summarise(project, snapshot);
  return { snapshot, cached: false };
};

module.exports = { importRepo, mapMembers, weeklyCounts, summarise, GitHubError };
