const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('../controllers/adminController'));
const { adminOnly } = require('../middleware/auth');

router.use(adminOnly);              // everything below is admin-only
router.get('/dashboard', c.dashboard);
router.get('/users', c.listUsers);
router.patch('/users/:id', c.updateUser);

module.exports = router;
