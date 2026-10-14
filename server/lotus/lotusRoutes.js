// protect is applied in server.js
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./lotusController'));
const { requireRole } = require('../middleware/auth');

// Student
router.get('/projects/:projectId', c.mine);
router.post('/projects/:projectId/start', c.start);
router.put('/attempts/:id/answers', c.saveAnswers);
router.post('/attempts/:id/submit', c.submit);

// Faculty viva mode (controller also checks "mentor of THIS project")
router.get('/projects/:projectId/review', requireRole('faculty', 'admin'), c.review);
router.post('/attempts/:id/override', requireRole('faculty', 'admin'), c.override);
router.post('/attempts/:id/viva', requireRole('faculty', 'admin'), c.viva);
router.post('/projects/:projectId/reset', requireRole('faculty', 'admin'), c.reset);

module.exports = router;
