// ---------------------------------------------------------------
// "Continue with Google" for the college's Google Workspace.
// The browser gets an ID token from Google Identity Services; we verify
// it here (signature, audience = our client id, expiry) and only accept
// verified emails on ALLOWED_EMAIL_DOMAIN whose Workspace domain (hd)
// matches — a personal @gmail.com can't get in.
// First sign-in creates a student account; they then complete their
// profile (department, batch, roll number) on /settings.
// ---------------------------------------------------------------
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Session = require('../models/Session');

const clientId = () => process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
let client;
const oauth = () => (client ||= new OAuth2Client(clientId()));

const fail = (status, message) => Object.assign(new Error(message), { status });

// Separate so tests can check the rules without Google
const checkClaims = (p) => {
  const domains = User.allowedDomains();
  const email = String(p?.email || '').toLowerCase();
  if (!p?.email_verified) throw fail(401, 'Your Google email is not verified');
  if (!User.isCollegeEmail(email)) throw fail(403, `Use your college Google account (@${domains.join(' or @')})`);
  if (!p.hd || !domains.includes(String(p.hd).toLowerCase())) throw fail(403, 'Sign in with the college Google Workspace account, not a personal one');
  return email;
};

// POST /api/auth/google   { credential }
exports.google = async (req, res) => {
  if (!clientId()) throw fail(503, 'Google sign-in is not set up on the server (GOOGLE_CLIENT_ID)');
  let payload;
  try {
    const ticket = await oauth().verifyIdToken({ idToken: String(req.body.credential || ''), audience: clientId() });
    payload = ticket.getPayload();
  } catch {
    throw fail(401, 'Google sign-in failed — please try again');
  }
  const email = checkClaims(payload);

  let user = await User.findOne({ $or: [{ googleSub: payload.sub }, { email }] });
  if (user?.isDemo) throw fail(403, 'That address belongs to a demo account. Ask the admin.');
  if (user && user.googleSub && user.googleSub !== payload.sub) throw fail(403, 'This college email is linked to a different Google account');
  if (!user) {
    user = new User({
      name: payload.name || email.split('@')[0],
      email,
      googleSub: payload.sub,
      password: crypto.randomBytes(24).toString('base64url'),   // unusable; they sign in with Google
      verified: false,
    });
  } else if (!user.googleSub) {
    user.googleSub = payload.sub;   // first Google sign-in for an existing account
  }
  user.lastLoginAt = new Date();
  await user.save();

  const session = await Session.create({ user: user._id, userAgent: req.headers['user-agent'], ip: req.ip });
  const token = jwt.sign({ id: user._id, sid: session._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
  res.json({ token, user: user.toAuthJSON(), created: user.createdAt.getTime() > Date.now() - 10000 });
};

// GET /api/auth/config — what the login page can offer
exports.config = (req, res) => {
  res.json({ google: !!clientId(), domains: User.allowedDomains() });
};

exports.checkClaims = checkClaims;
