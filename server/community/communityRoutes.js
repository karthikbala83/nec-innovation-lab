// Mounted at /api — backing, following, comments and updates for a project.
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./communityController'));
const u = wrap(require('../updates/updateController'));
const { protect, optionalAuth } = require('../middleware/auth');

// Back / follow
router.post('/projects/:id/back', protect, c.back);
router.delete('/projects/:id/back', protect, c.unback);
router.get('/projects/:id/backers', c.backers);
router.get('/projects/:id/viewer', protect, c.viewerState);
router.post('/projects/:id/follow', protect, c.follow);
router.delete('/projects/:id/follow', protect, c.unfollow);
router.get('/me/following', protect, c.myFollows);

// Comments
router.get('/projects/:id/comments', optionalAuth, c.listComments);
router.post('/projects/:id/comments', protect, c.addComment);
router.delete('/comments/:cid', protect, c.deleteComment);
router.post('/comments/:cid/report', protect, c.reportComment);
router.post('/comments/:cid/hide', protect, c.hideComment);

// Update timeline
router.get('/projects/:id/updates', optionalAuth, u.list);
router.post('/projects/:id/updates', protect, u.create);
router.delete('/updates/:uid', protect, u.remove);

module.exports = router;
