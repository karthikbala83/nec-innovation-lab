// ---------------------------------------------------------------
// Duplicate check (spec §9): compare this repo's file hashes (git blob
// shas, already in the snapshot) with every other project in the college.
// > 60% of this project's files identical to another project -> flag to
// the MENTOR (never public; it may be innocent, e.g. a shared starter).
//
// Noise filters, so two projects from the same template aren't flagged:
//   - empty / tiny files (< 200 bytes), licences, .gitignore etc.
//   - "boilerplate": a file that appears in many projects (>= 3 others
//     or >= 20% of all projects) is common scaffolding, not copying
// ---------------------------------------------------------------
const RepoSnapshot = require('./RepoSnapshot');

const FLAG_AT = 0.6;
const LIST_AT = 0.3;
const MIN_SHARED = 5;
const MIN_BYTES = 200;
const IGNORE = /(^|\/)(license(\.\w+)?|licence|\.gitignore|\.gitattributes|\.editorconfig|\.prettierrc.*|\.eslintrc.*|code_of_conduct\.md)$/i;

// Files of a snapshot worth comparing: path -> sha
const comparable = (snap) => {
  const size = new Map((snap.tree || []).map((f) => [f.path, f.size]));
  return (snap.fileHashes || []).filter((f) => !IGNORE.test(f.path) && (size.get(f.path) ?? 0) >= MIN_BYTES);
};

// Pure: given my files and other projects' sha sets, compute matches
const compare = (mine, others, totalProjects) => {
  const mySha = new Set(mine.map((f) => f.sha));
  // How many OTHER projects contain each of my hashes (document frequency)
  const df = new Map();
  for (const o of others) for (const sha of o.shas) if (mySha.has(sha)) df.set(sha, (df.get(sha) || 0) + 1);
  const commonAt = Math.max(3, Math.ceil(totalProjects * 0.2));
  const distinctive = new Set([...mySha].filter((sha) => (df.get(sha) || 0) < commonAt));
  if (distinctive.size < MIN_SHARED) return { considered: distinctive.size, matches: [], flagged: false };

  const matches = [];
  for (const o of others) {
    const shared = [...distinctive].filter((sha) => o.shas.has(sha));
    const overlap = shared.length / distinctive.size;
    if (shared.length >= MIN_SHARED && overlap >= LIST_AT) {
      const sharedSet = new Set(shared);
      matches.push({
        project: o.project,
        overlap: Math.round(overlap * 100),
        sharedFiles: shared.length,
        samplePaths: mine.filter((f) => sharedSet.has(f.sha)).slice(0, 5).map((f) => f.path),
        otherRepoCreatedAt: o.createdAt,
      });
    }
  }
  matches.sort((a, b) => b.overlap - a.overlap);
  return { considered: distinctive.size, matches: matches.slice(0, 5), flagged: matches.some((m) => m.overlap >= FLAG_AT * 100) };
};

// Runs against the database and stores the result on the snapshot
const checkDuplicates = async (snapshot) => {
  const mine = comparable(snapshot);
  const shas = [...new Set(mine.map((f) => f.sha))];
  const [rows, totalProjects] = await Promise.all([
    RepoSnapshot.aggregate([
      { $match: { project: { $ne: snapshot.project }, 'fileHashes.sha': { $in: shas } } },
      { $project: { project: 1, 'meta.createdAt': 1, shas: { $filter: { input: '$fileHashes.sha', cond: { $in: ['$$this', shas] } } } } },
    ]),
    RepoSnapshot.countDocuments(),
  ]);
  const others = rows.map((r) => ({ project: r.project, createdAt: r.meta?.createdAt, shas: new Set(r.shas) }));
  const result = compare(mine, others, totalProjects);
  snapshot.duplicate = { checkedAt: new Date(), ...result };
  await RepoSnapshot.updateOne({ _id: snapshot._id }, { $set: { duplicate: snapshot.duplicate } });
  return snapshot.duplicate;
};

module.exports = { checkDuplicates, compare, comparable, FLAG_AT };
