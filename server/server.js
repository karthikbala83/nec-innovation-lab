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

const app = express();

// ---- Global middleware ----
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

// ---- Connect database ----
connectDB();

// ---- Routes ----
app.get('/', (req, res) => res.json({ status: 'API running', time: new Date() }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/notes', trackActivity, require('./routes/noteRoutes'));
app.use('/api/admin', trackActivity, require('./routes/adminRoutes'));

// ---- 404 + error handler ----
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
