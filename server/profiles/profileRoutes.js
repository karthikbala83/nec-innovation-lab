const wrap = require('../utils/asyncHandler');
const c = wrap(require('./profileController'));
const { protect } = require('../middleware/auth');

// Two routers: /api/profiles is public, /api/users needs a login
const profiles = require('express').Router();
profiles.get('/:handle', c.profile);

const users = require('express').Router();
users.use(protect);
users.get('/lookup', c.lookup);
users.get('/mentors', c.mentors);

module.exports = { profiles, users };
