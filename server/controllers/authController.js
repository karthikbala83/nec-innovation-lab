const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

// helper: sign a JWT that carries BOTH user id and session id
const signToken = (userId, sessionId) =>
  jwt.sign({ id: userId, sid: sessionId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

// POST /api/auth/signup
exports.signup = async (req, res) => {
  try {
    const { name, email, password, profile } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password, profile });
    // auto-login after signup: create session + token
    const session = await Session.create({
      user: user._id,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    const token = signToken(user._id, session._id);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
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
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
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

  const resetLink = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;
  // PRODUCTION: email this link (nodemailer / SES / Resend).
  // CLASSROOM: we log it + return it so the flow is fully demonstrable.
  console.log('Password reset link:', resetLink);
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

// GET /api/auth/me  (protected)
exports.me = async (req, res) => {
  res.json({ user: req.user });
};
