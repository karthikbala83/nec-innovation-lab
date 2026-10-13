// Run: npm test   (Node's built-in test runner, no extra packages)
// Fake secrets are built from pieces so GitHub's own push protection
// doesn't mistake this test file for a real leak.
const test = require('node:test');
const assert = require('node:assert/strict');
const { skipReason, scanSecrets, detectStack, isKeyFile } = require('../projects/repoRules');
const { mapMembers, weeklyCounts } = require('../projects/repoImport');
const User = require('../models/User');

test('skip rules drop dependencies, builds, lockfiles, binaries and big files', () => {
  assert.equal(skipReason('client/node_modules/react/index.js'), 'node_modules');
  assert.equal(skipReason('dist/app.js'), 'dist');
  assert.equal(skipReason('server/package-lock.json'), 'lockfile');
  assert.equal(skipReason('assets/logo.png'), 'binary');
  assert.equal(skipReason('model/weights.h5'), 'binary');
  assert.equal(skipReason('public/app.min.js'), 'minified');
  assert.equal(skipReason('data/big.csv', 10 * 1024 * 1024), 'large');
  assert.equal(skipReason('server/controllers/auth.js', 2000), null);
  assert.equal(skipReason('.env', 100), null);   // kept on purpose: it gets scanned
});

test('secret scan finds real-looking keys and masks them', () => {
  const aws = 'AKIA' + 'QWERTYUIOPASDFGH';
  const mongo = 'mongodb+srv://' + 'arun:s3cretPass@cluster0.abcd.mongodb.net/app';
  const text = [
    'const ok = process.env.JWT_SECRET;',
    `const key = "${aws}";`,
    `MONGO_URI=${mongo}`,
    'password = "hunter2hunter2"',
  ].join('\n');
  const found = scanSecrets('server/config.js', text);
  assert.deepEqual(found.map((f) => [f.line, f.type]), [
    [2, 'AWS access key'],
    [3, 'Database URL with password'],
    [4, 'Hard-coded secret'],
  ]);
  for (const f of found) {
    assert.ok(f.preview.endsWith('****'), 'preview is masked');
    assert.ok(!text.includes(f.preview.replace('****', '') + 'X'));
    assert.ok(f.preview.length <= 8, 'never stores the whole secret');
  }
});

test('secret scan ignores placeholders and flags committed .env files', () => {
  assert.deepEqual(scanSecrets('README.md', 'JWT_SECRET="change_this_to_a_long_random_string"'), []);
  assert.deepEqual(scanSecrets('.env.example', 'MONGO_URI=mongodb+srv://<user>:<password>@cluster0'), []);
  const env = scanSecrets('server/.env', 'PORT=5000');
  assert.equal(env[0].type, 'Committed .env file');
});

test('stack detection reads manifests and file names', () => {
  const pkg = JSON.stringify({ dependencies: { react: '^18', express: '^4', mongoose: '^8' } });
  const stack = detectStack(
    ['client/package.json', 'firmware/sensor.ino', 'Dockerfile', 'ml/requirements.txt'],
    [
      { path: 'client/package.json', content: pkg },
      { path: 'ml/requirements.txt', content: 'flask==3.0\ntensorflow>=2.15\nnumpy' },
    ]
  );
  for (const s of ['React', 'Express', 'MongoDB', 'Node.js', 'Arduino', 'Docker', 'Flask', 'TensorFlow', 'NumPy', 'Python']) {
    assert.ok(stack.includes(s), `missing ${s}`);
  }
  assert.ok(isKeyFile('README.md') && isKeyFile('server/package.json') && !isKeyFile('src/a/b/README.md'));
});

test('commits map to team members by GitHub username, case-insensitive', () => {
  const a = { user: 'u1', githubUsername: 'Arun-K' };
  const b = { user: 'u2', githubUsername: 'priya' };
  const day = (n) => new Date(Date.UTC(2026, 9, n));
  const commits = [
    { authorLogin: 'arun-k', date: day(10), files: ['server/a.js', 'server/b.js'] },
    { authorLogin: 'ARUN-K', date: day(12), files: ['server/a.js'] },
    { authorLogin: 'priya', date: day(11), files: ['client/App.jsx'] },
    { authorLogin: 'stranger', date: day(11), files: [] },
  ];
  const { memberStats, unmappedCommits } = mapMembers(commits, [a, b]);
  assert.equal(unmappedCommits, 1);
  const arun = memberStats.find((s) => s.user === 'u1');
  assert.equal(arun.commits, 2);
  assert.deepEqual(arun.lastCommitAt, day(12));
  assert.deepEqual(arun.files[0], { path: 'server/a.js', changes: 2 });
  assert.equal(memberStats.find((s) => s.user === 'u2').commits, 1);
});

test('weekly commit counts cover the last 12 weeks, oldest first', () => {
  const now = new Date(Date.UTC(2026, 9, 14));   // Wed 14 Oct 2026
  const weeks = weeklyCounts([
    { date: new Date(Date.UTC(2026, 9, 13)) },      // this week
    { date: new Date(Date.UTC(2026, 9, 12)) },      // this week (Monday)
    { date: new Date(Date.UTC(2026, 9, 11)) },      // last week (Sunday)
    { date: new Date(Date.UTC(2025, 0, 1)) },       // too old
  ], now);
  assert.equal(weeks.length, 12);
  assert.equal(weeks[11].count, 2);
  assert.equal(weeks[10].count, 1);
  assert.equal(weeks.reduce((s, w) => s + w.count, 0), 3);
});

test('only college emails may sign up', () => {
  process.env.ALLOWED_EMAIL_DOMAIN = 'nandhaengg.org, nandha.ac.in';
  assert.ok(User.isCollegeEmail('arun.k@nandhaengg.org'));
  assert.ok(User.isCollegeEmail('Faculty@NANDHA.AC.IN'));
  assert.ok(!User.isCollegeEmail('arun@gmail.com'));
  assert.ok(!User.isCollegeEmail('arun@nandhaengg.org.evil.com'));
  assert.ok(!User.isCollegeEmail('arun@sub.nandhaengg.org'));
});
