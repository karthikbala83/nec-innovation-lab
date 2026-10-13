// Verifies the JWT on protected routes.
// Client sends: Authorization: Bearer <token>
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
  if (!token) return res.status(401).json({ message: 'Not logged in' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    req.user = user;               // downstream handlers can use req.user
    req.sessionId = decoded.sid;   // session id baked into the token
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Admin access only' });
  next();
};

// Allow only the listed roles: router.post('/x', requireRole('faculty', 'admin'), handler)
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ message: `Only ${roles.join(' / ')} can do this` });
  next();
};

// Public pages: attach req.user if a valid token is present, otherwise carry on
// as an anonymous visitor. A bad/expired token is ignored, never a 401.
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = (await User.findById(decoded.id)) || undefined;
  } catch {
    /* anonymous */
  }
  next();
};

module.exports = { protect, adminOnly, requireRole, optionalAuth };
