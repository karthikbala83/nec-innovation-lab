const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const { send } = require('../services/mailer');

// CLIENT_URL may list several origins; links in messages use the first one
const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
exports.clientUrl = clientUrl;

// helper: sign a JWT that carries BOTH user id and session id
const signToken = (userId, sessionId) =>
  jwt.sign({ id: userId, sid: sessionId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

// POST /api/auth/signup
// College email only. Role is never taken from the body — admins promote faculty.
exports.signup = async (req, res) => {
  try {
    const { name, email, password, githubUsername, profile = {} } = req.body;
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
    const user = await User.create({
      name, email, password,
      githubUsername: githubUsername || undefined,
      profile: { department, year, batch, rollNo, skills },
    });
    // auto-login after signup: create session + token
    const session = await Session.create({
      user: user._id,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    const token = signToken(user._id, session._id);
    res.status(201).json({ token, user: user.toAuthJSON() });
  } catch (err) {
    // Mongoose validation errors come out here — show them to the student
    res.status(400).json({ message: err.message });
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

// GET /api/auth/me  (protected)
exports.me = async (req, res) => {
  res.json({ user: req.user });
};
