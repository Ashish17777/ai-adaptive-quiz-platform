const express = require('express');
const router = express.Router();
const {
  logEvent,
  getSession,
  getReport,
  getRiskScore,
  autoSubmit,
  getCohortSecurityAnalytics,
  getAnalyticsTrends,
  getStudentSecurityReport,
} = require('../controllers/securityController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Student-accessible endpoints
router.post('/log-event', logEvent);
router.post('/auto-submit', autoSubmit);
router.get('/session/:id', getSession);
router.get('/report/:id', getReport);
router.get('/risk-score/:userId', getRiskScore);

// Admin-only endpoints
router.get('/analytics/cohort', authorize('admin'), getCohortSecurityAnalytics);
router.get('/analytics/trends', authorize('admin'), getAnalyticsTrends);
router.get('/student-report/:userId', authorize('admin'), getStudentSecurityReport);

module.exports = router;
