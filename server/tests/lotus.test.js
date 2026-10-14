// Lotus scoring maths, question validation, the dev mock, the payload we send
// to Saravonix, the Understanding part, and the duplicate check. No database.
const test = require('node:test');
const assert = require('node:assert/strict');
const LotusAttempt = require('../lotus/LotusAttempt');
const { validateQuestions, buildPayload } = require('../lotus/lotusService');
const { generateQuestions, scoreAnswers } = require('../services/lotusClient');
const { computeLabScore } = require('../score/labScore');
const { compare } = require('../projects/duplicateCheck');

const qs = (petals) => petals.flatMap((petal) => [1, 2, 3].map((level) => ({ qid: `${petal}-${level}`, petal, level })));

test('petal score is level-weighted and filled at 50%', () => {
  const questions = qs([1, 2]);
  const answers = [
    { qid: '1-1', aiScore: 3 }, { qid: '1-2', aiScore: 3 }, { qid: '1-3', aiScore: 0 },   // (3+6+0)/18 = 50% -> filled
    { qid: '2-1', aiScore: 3 }, { qid: '2-2', aiScore: 0 }, { qid: '2-3', aiScore: 1, mentorScore: 2 },   // (3+0+6)/18 = 50%: mentor override counts
  ];
  const s = LotusAttempt.summarise(questions, answers);
  assert.deepEqual(s.petals.map((p) => [p.petal, p.percent, p.filled]), [[1, 50, true], [2, 50, true]]);
  assert.equal(s.petalsFilled, 2);
  assert.equal(s.percent, 50);
  const low = LotusAttempt.summarise(questions, [{ qid: '1-3', aiScore: 2 }]);   // 6/18 = 33%
  assert.equal(low.petals[0].filled, false);
});

test('questions must be well-formed and cite a real file from the snapshot', () => {
  const tree = ['server/server.js', 'client/src/App.jsx'];
  const { kept, dropped } = validateQuestions([
    { id: 'a', petal: 2, level: 1, text: 'Explain the entry point', filePath: 'server/server.js' },
    { id: 'b', petal: 5, level: 2, text: 'Change the router', filePath: 'client/src/Missing.jsx' },   // not in repo
    { id: 'a', petal: 2, level: 1, text: 'duplicate id', filePath: 'server/server.js' },
    { id: 'c', petal: 9, level: 1, text: 'bad petal', filePath: 'server/server.js' },
    { id: 'd', petal: 4, level: 3, text: '   ', filePath: 'server/server.js' },
  ], tree);
  assert.deepEqual(kept.map((q) => q.qid), ['a']);
  assert.equal(dropped, 4);
});

test('dev mock: 24 questions labelled [MOCK], each citing a real path, member files first', async () => {
  process.env.LOTUS_MOCK = 'true';
  const tree = ['README.md', 'server/models/User.js', 'server/routes/auth.js', 'client/src/pages/Home.jsx', 'Dockerfile', 'server/middleware/auth.js'];
  const r = await generateQuestions({ repo: { tree, memberFiles: [{ path: 'client/src/pages/Home.jsx', changes: 4 }] } });
  assert.equal(r.mock, true);
  assert.equal(r.questions.length, 24);
  assert.ok(r.questions.every((q) => q.text.startsWith('[MOCK') && tree.includes(q.filePath)));
  assert.equal(r.questions.find((q) => q.petal === 5).filePath, 'client/src/pages/Home.jsx');
  const { scores } = await scoreAnswers({ setId: r.setId, answers: [{ questionId: 'x', answer: '' }, { questionId: 'y', answer: 'x'.repeat(400) }] });
  assert.deepEqual(scores.map((s) => s.score), [0, 3]);
});

test('payload to the Lotus API carries no names, emails or roll numbers, and no .env files', () => {
  const user = { _id: 'u1', name: 'Arun Kumar', email: 'arun.k@nandhaengg.org', githubUsername: 'arun-k', profile: { rollNo: '23CSE101' } };
  const snapshot = {
    owner: 'o', name: 'r', sha: 'abc', stack: ['React'], tree: [{ path: 'a.js' }],
    keyFiles: [{ path: 'README.md', content: 'hi' }, { path: 'server/.env', content: 'SECRET=1' }],
    memberStats: [{ user: 'u1', githubUsername: 'arun-k', files: [{ path: 'a.js', changes: 2 }] }],
  };
  const payload = buildPayload({ _id: 's1' }, { _id: 'p1', title: 'T' }, snapshot, user);
  const json = JSON.stringify(payload);
  for (const leak of ['Arun Kumar', 'arun.k@', '23CSE101', 'SECRET=1']) assert.ok(!json.includes(leak), `leaks ${leak}`);
  assert.equal(payload.student.githubUsername, 'arun-k');
  assert.deepEqual(payload.repo.memberFiles, [{ path: 'a.js', changes: 2 }]);
});

test('Understanding = team average (non-takers count 0) + viva bonus', () => {
  const lotus = [
    { status: 'scored', percent: 80, petalsFilled: 7, viva: { done: true } },
    { status: 'not_started', percent: 0, petalsFilled: 0, viva: { done: false } },
  ];
  const { parts } = computeLabScore({ lotus });
  assert.equal(parts.understanding.score, 0.45);   // 40% average + 0.1 × 1/2
  assert.equal(parts.understanding.points, 15.8);   // × 35
  assert.match(parts.understanding.detail, /Team average 40%, 3.5\/8 petals, viva 1\/2/);
});

test('duplicate check flags copies but not shared boilerplate', () => {
  const mine = Array.from({ length: 20 }, (_, i) => ({ path: `src/f${i}.js`, sha: `s${i}` }));
  const boiler = new Set(['s0', 's1', 's2']);   // e.g. a starter template file present everywhere
  const copy = { project: 'copy', shas: new Set(mine.slice(0, 15).map((f) => f.sha)) };        // 15/20 identical
  const similar = { project: 'starter-user', shas: new Set([...boiler]) };
  const others = [copy, similar, { project: 'x1', shas: boiler }, { project: 'x2', shas: boiler }];
  const r = compare(mine, others, 10);
  assert.equal(r.flagged, true);
  assert.equal(r.matches[0].project, 'copy');
  assert.equal(r.considered, 17, 'files in 3+ other projects are boilerplate');
  assert.equal(r.matches[0].overlap, 71);   // 12 distinctive shared / 17
  assert.ok(!r.matches.some((m) => m.project === 'starter-user'));
});
