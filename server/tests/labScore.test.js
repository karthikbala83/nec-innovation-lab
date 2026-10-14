// Lab Score maths, the live-check SSRF guard and the weights rule. No database needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeLabScore } = require('../score/labScore');
const { isPublicIp, checkUrl } = require('../services/liveCheck');
const Setting = require('../settings/Setting');

const NOW = Date.UTC(2026, 9, 14);
const daysAgo = (n) => new Date(NOW - n * 864e5);
const W = Setting.DEFAULT_WEIGHTS;

test('an empty project scores 0 and every part explains itself', () => {
  const { total, parts } = computeLabScore({}, W, NOW);
  assert.equal(total, 0);
  assert.deepEqual(Object.keys(parts), ['understanding', 'build', 'works', 'community', 'recognition', 'freshness']);
  for (const p of Object.values(parts)) assert.ok(p.detail, 'has a detail line');
  assert.equal(parts.understanding.detail, 'No Lotus checks taken yet');
  assert.equal(parts.works.detail, 'No live URL');
});

test('parts use the configured weights and the total is their sum', () => {
  const commits = Array.from({ length: 25 }, (_, i) => ({ date: daysAgo(i), authorLogin: i % 2 ? 'a' : 'b' }));
  const { total, parts } = computeLabScore({
    commits, teamSize: 2,                                   // build: full marks
    liveUrl: 'https://x.dev', checks: [true, true, true, false],   // works: 75%
    backers: 30, followers: 10, views: 400,                  // community: 90+20+20 = 130/150
    competitions: [{ name: 'SIH 2026', stage: 'winner', confirmed: true }],   // recognition: full
    updates60d: 1,                                           // freshness: half
  }, W, NOW);
  assert.equal(parts.build.points, 15);
  assert.equal(parts.works.points, 11.3);
  assert.equal(parts.works.uptime, 75);
  assert.equal(parts.community.points, 13);
  assert.equal(parts.recognition.points, 15);
  assert.equal(parts.freshness.points, 2.5);
  assert.equal(parts.understanding.points, 0);
  const sum = Object.values(parts).reduce((s, p) => s + p.points, 0);
  assert.equal(total, Math.round(sum));

  const heavy = computeLabScore({ updates60d: 2 }, { ...W, freshness: 40, understanding: 0 }, NOW);
  assert.equal(heavy.parts.freshness.points, 40, 'changing a weight changes the part');
});

test('build activity decays when commits stop', () => {
  const fresh = computeLabScore({ commits: [{ date: daysAgo(1), authorLogin: 'a' }] }, W, NOW).parts.build.score;
  const stale = computeLabScore({ commits: [{ date: daysAgo(90), authorLogin: 'a' }] }, W, NOW).parts.build.score;
  assert.ok(fresh > stale);
  assert.equal(stale, 0);
});

test('an unconfirmed "winner" counts as a finalist until the admin confirms', () => {
  const claimed = computeLabScore({ competitions: [{ name: 'SIH', stage: 'winner', confirmed: false }] }, W, NOW);
  assert.equal(claimed.parts.recognition.score, 0.6);
  assert.match(claimed.parts.recognition.detail, /unconfirmed/);
  const pilot = computeLabScore({ confirmedPilots: 1, stage: 'incubation' }, W, NOW);
  assert.equal(pilot.parts.recognition.score, 0.8, 'best single achievement wins');
});

test('live check refuses private and internal addresses (SSRF)', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.10', '172.20.0.5', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1']) {
    assert.equal(isPublicIp(ip), false, ip);
  }
  for (const ip of ['8.8.8.8', '142.250.183.14', '2606:4700::1111']) assert.equal(isPublicIp(ip), true, ip);
  assert.equal((await checkUrl('http://169.254.169.254/latest/meta-data')).error, 'private address');
  assert.equal((await checkUrl('http://localhost:27017/')).error, 'EBLOCKED');
  assert.equal((await checkUrl('file:///etc/passwd')).error, 'not http(s)');
});

test('score weights must add up to 100', async () => {
  await assert.doesNotReject(new Setting({}).validate());
  const bad = new Setting({ scoreWeights: { ...W, freshness: 50 } });
  await assert.rejects(bad.validate(), /add up to 100/);
});
