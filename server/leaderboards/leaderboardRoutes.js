// Public: anyone can see the rankings and how the score is weighted
const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('./leaderboardController'));

router.get('/', c.board);
router.get('/weights', c.weights);

module.exports = router;
