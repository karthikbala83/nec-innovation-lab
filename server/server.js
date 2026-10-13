// ---------------------------------------------------------------
// server.js — entry point. Keep this file SMALL.
// Structure lesson: server.js only wires things together.
// Real logic lives in routes -> controllers -> models.
// ---------------------------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const trackActivity = require('./middleware/trackActivity');
const errorHandler = require('./middleware/errorHandler');
const { protect } = require('./middleware/auth');
const { profiles, users } = require('./profiles/profileRoutes');
const { startScheduler } = require('./jobs/dailyChecks');

const app = express();

// ---- Global middleware ----
// Railway / Render sit behind a proxy: trust it so req.ip is the real visitor
app.set('trust proxy', 1);
// CLIENT_URL may list several origins: "https://lab.nandhaengg.org,https://nec-lab.netlify.app"
// CLIENT_URL_PATTERN (optional regex) allows Netlify deploy previews, e.g. ^https://[a-z0-9-]+--nec-lab\.netlify\.app$
const origins = (process.env.CLIENT_URL || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
const originPattern = process.env.CLIENT_URL_PATTERN ? new RegExp(process.env.CLIENT_URL_PATTERN) : null;
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || origins.includes(origin) || !!originPattern?.test(origin)),
  credentials: true,
}));
app.use(express.json({ limit: '200kb' }));

// ---- Routes ----
app.get('/', (req, res) => res.json({ status: 'API running', time: new Date() }));
// Health check for Railway: 200 only when the database is connected
app.get('/api/health', (req, res) => {
  const up = mongoose.connection.readyState === 1;
  res.status(up ? 200 : 503).json({ ok: up, db: mongoose.connection.name || null, time: new Date() });
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/notes', trackActivity, require('./routes/noteRoutes'));
app.use('/api/admin', trackActivity, require('./routes/adminRoutes'));

// ---- NEC Innovation Lab (P0) ----
app.use('/api/feed', require('./feed/feedRoutes'));                  // public
app.use('/api/profiles', profiles);                                  // public
app.use('/api/projects', require('./projects/projectRoutes'));      // mixed: see file
app.use('/api/users', users);                                        // logged in
app.use('/api/review', trackActivity, require('./review/reviewRoutes'));   // faculty / admin

// ---- P1: startup-portal layer ----
app.use('/api/leaderboards', require('./leaderboards/leaderboardRoutes'));  // public
app.use('/api/uploads', protect, require('./uploads/uploadRoutes'));         // S3 presigned uploads
app.use('/api', require('./community/communityRoutes'));                    // back, follow, comments, updates

// ---- 404 + error handler ----
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  connectDB();
  startScheduler();   // daily live checks + Lab Score refresh (JOBS_ENABLED=false to turn off)
  app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
}

module.exports = app;   // tests import the app without starting it
