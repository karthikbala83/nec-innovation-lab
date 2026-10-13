const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./projectController'));
const { protect, optionalAuth, requireRole } = require('../middleware/auth');

router.post('/', protect, requireRole('student', 'admin'), c.create);
router.get('/mine', protect, c.mine);
router.get('/:idOrSlug', optionalAuth, c.getOne);             // public once published
router.put('/:id', protect, c.update);
router.post('/:id/submit', protect, c.submit);
router.post('/:id/archive', protect, c.archive);
router.post('/:id/import', protect, c.importRepo);
router.get('/:id/snapshot', protect, c.snapshot);

module.exports = router;
