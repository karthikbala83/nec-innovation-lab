const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const { send, isConfigured: mailConfigured } = require('../services/mailer');
const EmailCode = require('../feedback/EmailCode');
const { hit } = require('../utils/rateLimit');

// CLIENT_URL may list several origins; links in messages use the first one
// Links in emails use the public site: PUBLIC_SITE_URL, else the custom domain in CLIENT_URL, else any public entry
const clientUrl = () => {
  const list = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)
    .map((o) => (/^https?:\/\//.test(o) ? o : `https://${o}`));
  const isPublic = (o) => !/localhost|127\.0\.0\.1/.test(o);
  const custom = list.find((o) => isPublic(o) && !/\.(netlify\.app|onrender\.com|vercel\.app)$/.test(o));   // prefer the college/custom domain
  return (process.env.PUBLIC_SITE_URL || custom || list.find(isPublic) || list[0]).replace(/\/+$/, '');
};
exports.clientUrl = clientUrl;

// helper: sign a JWT that carries BOTH user id and session id
const signToken = (userId, sessionId) =>
  jwt.sign({ id: userId, sid: sessionId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

// POST /api/auth/signup-code   { email } — prove the college email is yours before signing up
exports.signupCode = async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!User.isCollegeEmail(email)) {
    const domains = User.allowedDomains();
    return res.status(400).json({
      message: domains.length
        ? `Use your college email (@${domains.join(' or @')})`
        : 'Signup is closed: ALLOWED_EMAIL_DOMAIN is not configured on the server',
    });
  }
  if (!hit('signup-code-ip', req.ip, 40, 3600e3).ok || !hit('signup-code-email', email, 3, 3600e3).ok) {
    return res.status(429).json({ message: 'Too many codes requested — check your inbox (and spam) or try in an hour' });
  }
  if (await User.exists({ email })) return res.status(400).json({ message: 'Email already registered — log in instead' });
  const code = await EmailCode.issue(email);
  await send({
    to: email,
    subject: `Your NEC Innovation Lab signup code: ${code}`,
    heading: `Your code is ${code}`,
    paragraphs: ['Enter it on the signup page to create your account. It expires in 10 minutes.', 'If you did not ask for this, ignore this email.'],
  });
  const out = { sent: true };
  if (!mailConfigured() && process.env.NODE_ENV !== 'production') out.devCode = code;   // local testing only
  res.json(out);
};

// POST /api/auth/signup
// College email only, proved with an emailed code. Role is never taken from the body — admins promote faculty.
// (Students with the college Google Workspace can skip all this with "Continue with Google".)
exports.signup = async (req, res) => {
  try {
    const { name, email, password, githubUsername, profile = {}, code } = req.body;
    if (!User.isCollegeEmail(email)) {
      const domains = User.allowedDomains();
      return res.status(400).json({
        message: domains.length
          ? `Use your college email (@${domains.join(' or @')})`
          : 'Signup is closed: ALLOWED_EMAIL_DOMAIN is not configured on the server',
      });
    }
    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const { department, year, batch, rollNo, skills } = profile;
    const user = new User({
      name, email, password,
      githubUsername: githubUsername || undefined,
      profile: { department, year, batch, rollNo, skills },
    });
    await user.validate();   // check the form before using up the emailed code
    if (!(await EmailCode.verify(String(email).toLowerCase().trim(), code))) {
      return res.status(400).json({ message: 'Enter the 6-digit code we emailed you (it may have expired — request a new one)' });
    }
    await user.save();
    // auto-login after signup: create session + token
    const session = await Session.create({
      user: user._id,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    const token = signToken(user._id, session._id);
    res.status(201).json({ token, user: user.toAuthJSON() });
  } catch (err) {
    // Mongoose validation errors come out here — show them to the student, one line per field
    const message = err.name === 'ValidationError'
      ? Object.values(err.errors).map((e) => e.message).join('. ')
      : err.message;
    res.status(400).json({ message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  // password has select:false, so ask for it explicitly
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password)))
    return res.status(401).json({ message: 'Invalid email or password' });

  user.lastLoginAt = new Date();
  await user.save();

  const session = await Session.create({
    user: user._id,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  const token = signToken(user._id, session._id);
  res.json({ token, user: user.toAuthJSON() });
};

// POST /api/auth/logout  (protected)
exports.logout = async (req, res) => {
  await Session.findByIdAndUpdate(req.sessionId, { logoutAt: new Date() });
  res.json({ message: 'Logged out' });
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  // Always answer the same — don't reveal whether an email exists
  if (!user) return res.json({ message: 'If that email exists, a reset link was sent' });

  const rawToken = user.createResetToken();
  await user.save({ validateBeforeSave: false });

  const resetLink = `${clientUrl()}/reset-password/${rawToken}`;
  // Emailed through Resend (services/mailer.js). In development without a key the
  // mailer prints it, and the link is also returned so the flow is demonstrable.
  await send({
    to: user.email,
    subject: 'Reset your NEC Innovation Lab password',
    heading: 'Reset your password',
    paragraphs: ['Someone (hopefully you) asked to reset your password. The link works for 15 minutes.', 'If it wasn\'t you, ignore this email.'],
    cta: { label: 'Choose a new password', url: resetLink },
  }).catch((err) => console.error('Reset mail failed:', err.message));
  const payload = { message: 'If that email exists, a reset link was sent' };
  if (process.env.NODE_ENV !== 'production') payload.devResetLink = resetLink;
  res.json(payload);
};

// POST /api/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: Date.now() },   // token must not be expired
  });
  if (!user) return res.status(400).json({ message: 'Token invalid or expired' });

  user.password = req.body.password;   // pre-save hook re-hashes it
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  res.json({ message: 'Password updated. Please login.' });
};

// PATCH /api/auth/tour  { version }  (protected) — the app tour was finished or skipped
exports.tourDone = async (req, res) => {
  const version = Math.max(0, Math.min(100, Number(req.body.version) || 0));
  await User.updateOne({ _id: req.user._id }, { $max: { tourVersion: version } });
  res.json({ tourVersion: Math.max(version, req.user.tourVersion || 0) });
};

// PATCH /api/auth/me  (protected) — complete / edit your own profile
exports.updateMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  const { name, githubUsername, profile = {} } = req.body;
  if (name !== undefined) user.name = String(name).trim().slice(0, 60);
  if (githubUsername !== undefined) user.githubUsername = String(githubUsername).trim() || undefined;
  for (const k of ['department', 'batch', 'rollNo', 'company']) {
    if (profile[k] !== undefined) user.profile[k] = String(profile[k]).trim() || undefined;
  }
  if (profile.year !== undefined) user.profile.year = Number(profile.year) || undefined;
  if (Array.isArray(profile.skills)) user.profile.skills = profile.skills.map((s) => String(s).trim().slice(0, 30)).filter(Boolean).slice(0, 15);
  await user.save();   // model validates batch format, GitHub username…
  res.json({ user: user.toAuthJSON(), profile: user.profile, githubUsername: user.githubUsername });
};

// GET /api/auth/me  (protected)
exports.me = async (req, res) => {
  res.json({ user: req.user });
};
