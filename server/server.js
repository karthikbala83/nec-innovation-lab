// ---------------------------------------------------------------
// server.js — entry point. Keep this file SMALL.
// Structure lesson: server.js only wires things together.
// Real logic lives in routes -> controllers -> models.
// ---------------------------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const trackActivity = require('./middleware/trackActivity');
const errorHandler = require('./middleware/errorHandler');
const { profiles, users } = require('./profiles/profileRoutes');
const { startScheduler } = require('./jobs/dailyChecks');

const app = express();

// ---- Global middleware ----
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '200kb' }));

// ---- Routes ----
app.get('/', (req, res) => res.json({ status: 'API running', time: new Date() }));
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
