const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/signup', c.signup);
router.post('/login', c.login);
router.post('/logout', protect, c.logout);
router.post('/forgot-password', c.forgotPassword);
router.post('/reset-password/:token', c.resetPassword);
router.get('/me', protect, c.me);

module.exports = router;
