const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const c = wrap(require('../controllers/adminController'));
const lab = wrap(require('../controllers/labAdminController'));
const intros = wrap(require('../intros/introController'));
const feedback = wrap(require('../feedback/feedbackController'));
const seasons = wrap(require('../seasons/seasonController'));
const reports = wrap(require('../reports/reportController'));
const { adminOnly } = require('../middleware/auth');

router.use(adminOnly);              // everything below is admin-only
router.get('/dashboard', c.dashboard);
router.get('/users', c.listUsers);
router.patch('/users/:id', c.updateUser);

// Lab Score, pilots, moderation, jobs (P1)
router.get('/lab', lab.overview);
router.put('/lab/weights', lab.setWeights);
router.post('/backings/:id/decide', lab.decidePilot);
router.post('/jobs/daily-checks', lab.runChecks);

// Recruiters & intro requests — the placement cell (P2)
router.post('/recruiters', c.createRecruiter);
router.get('/intros', intros.list);
router.patch('/intros/:id', intros.decide);

// Feedback & request moderation (messages the content check held back)
router.get('/feedback', feedback.adminList);
router.post('/feedback/:id', feedback.adminDecide);

// Seasons & Demo Day (P3)
router.post('/seasons', seasons.create);
router.put('/seasons/:id', seasons.update);
router.get('/seasons/:id/ranking', seasons.ranking);
router.post('/seasons/:id/results', seasons.publishResults);

// Reports & CSV exports (P3)
router.get('/reports', reports.overview);
router.get('/export/projects.csv', reports.exportProjects);
router.get('/export/students.csv', reports.exportStudents);
router.get('/export/intros.csv', reports.exportIntros);
router.get('/export/feedback.csv', reports.exportFeedback);
router.get('/export/season/:id.csv', reports.exportSeason);

module.exports = router;
