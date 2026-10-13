const router = require('express').Router();
const c = require('../controllers/adminController');
const { adminOnly } = require('../middleware/auth');

router.use(adminOnly);              // everything below is admin-only
router.get('/dashboard', c.dashboard);
router.get('/users', c.listUsers);

module.exports = router;
