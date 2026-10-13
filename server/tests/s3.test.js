// Presigned S3 uploads: signing happens locally, so dummy keys are fine (no AWS call).
const test = require('node:test');
const assert = require('node:assert/strict');

test('presigned upload is locked to the project folder, image type and size', async () => {
  Object.assign(process.env, {
    AWS_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'AKIA' + 'TESTTESTTESTTEST', AWS_SECRET_ACCESS_KEY: 'test-secret',
    S3_BUCKET: 'nec-innovation-lab', S3_PREFIX: '/students-projects', UPLOAD_MAX_MB: '5', S3_PUBLIC_BASE_URL: '',
  });
  const { presignImageUpload, isConfigured } = require('../services/s3');
  assert.ok(isConfigured());

  const r = await presignImageUpload({ projectId: 'abc123', kind: 'screenshot', contentType: 'image/png' });
  assert.match(r.key, /^students-projects\/abc123\/screenshot\/\d+-[0-9a-f]{12}\.png$/);
  assert.equal(r.publicUrl, `https://nec-innovation-lab.s3.ap-south-1.amazonaws.com/${r.key}`);
  assert.match(r.url, /nec-innovation-lab/);

  const policy = JSON.parse(Buffer.from(r.fields.Policy, 'base64').toString());
  const conds = JSON.stringify(policy.conditions);
  assert.ok(conds.includes('["content-length-range",1,5242880]'), 'size capped at 5 MB');
  assert.ok(conds.includes('["eq","$Content-Type","image/png"]'), 'content type pinned');
  assert.ok(conds.includes(`{"key":"${r.key}"}`), 'exact key, no writing elsewhere');
  assert.ok(new Date(policy.expiration) - Date.now() <= 300 * 1000 + 5000, 'expires within 5 minutes');
});
