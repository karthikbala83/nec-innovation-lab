// Mounted at /api/seasons (public pages; team and judge actions need a login)
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./seasonController'));
const { protect, optionalAuth, requireRole } = require('../middleware/auth');

router.get('/', c.list);
router.get('/:slug', optionalAuth, c.detail);
router.post('/:slug/entries', protect, requireRole('student', 'admin'), c.enter);
router.delete('/:slug/entries/:entryId', protect, c.withdraw);
router.get('/:slug/judging', protect, c.judging);
router.put('/:slug/entries/:entryId/score', protect, c.score);

module.exports = router;
