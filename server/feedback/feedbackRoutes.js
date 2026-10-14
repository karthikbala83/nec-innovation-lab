// Mounted at /api. Likes, feedback and requests are open to visitors;
// the inbox needs a login; the sender's thread uses the private link token.
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./feedbackController'));
const { protect, optionalAuth } = require('../middleware/auth');

router.post('/projects/:id/like', optionalAuth, c.toggleLike);
router.post('/projects/:id/feedback', optionalAuth, c.submit);

router.post('/visitor/email-code', c.sendCode);
router.post('/visitor/verify', c.verifyCode);

router.get('/messages/:id', c.senderThread);
router.post('/messages/:id/reply', c.senderReply);

router.get('/inbox', protect, c.inbox);
router.get('/inbox/unread', protect, c.unread);
router.post('/inbox/:id/read', protect, c.markRead);
router.post('/inbox/:id/reply', protect, c.reply);

module.exports = router;
