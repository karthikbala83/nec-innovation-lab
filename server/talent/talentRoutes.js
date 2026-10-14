// protect is applied in server.js
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./talentController'));
const { requireRole } = require('../middleware/auth');

router.get('/', requireRole('recruiter', 'faculty', 'admin'), c.search);

module.exports = router;
