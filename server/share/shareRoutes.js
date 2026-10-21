// Public, read-only: link-preview HTML for crawlers (see shareController)
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./shareController'));

router.get('/html/p/:slug', c.project);
router.get('/html/u/:handle', c.profile);
router.get('/html/*', c.fallback);
router.get('/html', c.fallback);

module.exports = router;
