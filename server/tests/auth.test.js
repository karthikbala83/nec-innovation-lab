// Google sign-in rules (no network: we test the claim checks the verified token must pass).
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkClaims } = require('../controllers/googleAuthController');

test('only verified college Workspace accounts get in', () => {
  process.env.ALLOWED_EMAIL_DOMAIN = 'nandhaengg.org';
  const ok = { email: 'Arun.K@NandhaEngg.org', email_verified: true, hd: 'nandhaengg.org' };
  assert.equal(checkClaims(ok), 'arun.k@nandhaengg.org');

  assert.throws(() => checkClaims({ ...ok, email_verified: false }), /not verified/);
  assert.throws(() => checkClaims({ email: 'arun@gmail.com', email_verified: true }), /college Google account/);
  // A college-looking address on a personal Google account (no Workspace hd claim) is refused
  assert.throws(() => checkClaims({ ...ok, hd: undefined }), /Workspace/);
  assert.throws(() => checkClaims({ ...ok, hd: 'other.edu' }), /Workspace/);
});

test('signup forgives how students type GitHub username and batch', () => {
  const User = require('../models/User');
  const make = (githubUsername, batch) => new User({ name: 'A', email: 'a@nandhaengg.org', password: 'secret123', githubUsername, profile: { batch } });
  for (const [gh, want] of [['https://github.com/arun-k', 'arun-k'], ['github.com/arun-k/', 'arun-k'], ['@arun-k', 'arun-k'], ['arun-k', 'arun-k']]) {
    assert.equal(make(gh).githubUsername, want);
  }
  for (const [b, want] of [['2023 - 2027', '2023-2027'], ['2023–2027', '2023-2027'], ['2023-27', '2023-2027'], ['2023 to 2027', '2023-2027'], ['2023', '2023-2027']]) {
    assert.equal(make(undefined, b).profile.batch, want);
  }
  const err = make('not a name!', '23-27').validateSync();
  assert.match(err.errors.githubUsername.message, /just the name/);
  assert.match(err.errors['profile.batch'].message, /e\.g\. 2023-2027/);
});
