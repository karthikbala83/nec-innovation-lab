// protect is applied in server.js
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./uploadController'));

router.get('/status', c.status);
router.post('/presign', c.presign);

module.exports = router;
