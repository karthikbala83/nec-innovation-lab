const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('../controllers/adminController'));
const lab = wrap(require('../controllers/labAdminController'));
const { adminOnly } = require('../middleware/auth');

router.use(adminOnly);              // everything below is admin-only
router.get('/dashboard', c.dashboard);
router.get('/users', c.listUsers);
router.patch('/users/:id', c.updateUser);

// Lab Score, pilots, moderation, jobs (P1)
router.get('/lab', lab.overview);
router.put('/lab/weights', lab.setWeights);
router.post('/backings/:id/decide', lab.decidePilot);
router.post('/jobs/daily-checks', lab.runChecks);

module.exports = router;
