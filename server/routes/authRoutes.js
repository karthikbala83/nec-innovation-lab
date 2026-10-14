const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('../controllers/authController'));
const g = wrap(require('../controllers/googleAuthController'));
const { protect } = require('../middleware/auth');

router.post('/signup-code', c.signupCode);
router.post('/signup', c.signup);
router.post('/google', g.google);
router.get('/config', g.config);
router.post('/login', c.login);
router.post('/logout', protect, c.logout);
router.post('/forgot-password', c.forgotPassword);
router.post('/reset-password/:token', c.resetPassword);
router.get('/me', protect, c.me);
router.patch('/me', protect, c.updateMe);
router.patch('/tour', protect, c.tourDone);

module.exports = router;
