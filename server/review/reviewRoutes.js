// protect is applied in server.js
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./reviewController'));
const { requireRole } = require('../middleware/auth');

router.use(requireRole('faculty', 'admin'));
router.get('/', c.queue);
router.post('/:id/approve', c.approve);
router.post('/:id/return', c.sendBack);

module.exports = router;
