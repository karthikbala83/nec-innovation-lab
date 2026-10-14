// protect is applied in server.js
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./introController'));
const { requireRole } = require('../middleware/auth');

router.post('/', requireRole('recruiter'), c.create);
router.get('/mine', c.mine);

module.exports = router;
