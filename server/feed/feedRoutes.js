// Public: no login needed to browse
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./feedController'));

router.get('/', c.feed);
router.get('/filters', c.filters);

module.exports = router;
