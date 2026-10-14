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
