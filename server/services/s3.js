// ---------------------------------------------------------------
// Media uploads to the college's S3 bucket (spec §10: college-owned media).
//
// The browser uploads STRAIGHT to S3 with a presigned POST — the file
// never passes through our API (Railway bandwidth stays free). S3 itself
// enforces the rules we sign into the policy:
//   - exact key under S3_PREFIX/<projectId>/<kind>/
//   - image content type only, at most UPLOAD_MAX_MB
//   - expires in 5 minutes
// Video stays a YouTube link in v1 (spec §10, cost).
// ---------------------------------------------------------------
const crypto = require('crypto');
const { S3Client } = require('@aws-sdk/client-s3');
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');

const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const KINDS = ['thumbnail', 'screenshot', 'architecture', 'update'];

const config = () => ({
  bucket: process.env.S3_BUCKET,
  region: process.env.AWS_REGION,
  prefix: (process.env.S3_PREFIX || 'students-projects/').replace(/^\/+/, '').replace(/\/*$/, '/'),
  maxBytes: Number(process.env.UPLOAD_MAX_MB || 5) * 1024 * 1024,
  // CloudFront or custom domain in front of the bucket, if any
  publicBase: (process.env.S3_PUBLIC_BASE_URL || `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`).replace(/\/+$/, ''),
});

const isConfigured = () => !!(process.env.S3_BUCKET && process.env.AWS_REGION
  && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

let client;
const s3 = () => (client ||= new S3Client({ region: process.env.AWS_REGION }));   // reads AWS_* keys from env

// Returns { url, fields, publicUrl, key, maxBytes } for the browser to POST the file
const presignImageUpload = async ({ projectId, kind, contentType }) => {
  const { bucket, prefix, maxBytes, publicBase } = config();
  const ext = TYPES[contentType];
  const key = `${prefix}${projectId}/${kind}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const { url, fields } = await createPresignedPost(s3(), {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ['content-length-range', 1, maxBytes],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
    Expires: 300,
  });
  return { url, fields, key, publicUrl: `${publicBase}/${key}`, maxBytes };
};

module.exports = { presignImageUpload, isConfigured, TYPES, KINDS, config };
