const express = require('express');
const router = express.Router();
const {
  getStudentAnalytics,
  getAdminAnalytics,
  getQuestionQuality,
  getQuizEffectiveness,
  getStudentSegmentation,
  getBehaviorProfile,
  getAIInsights,
  getInstitutionalInsights,
  getLiveAnalytics,
  getPerformanceBenchmark,
  getDashboardDrillDown,
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// ── Existing routes ───────────────────────────────────────────────────────────
router.get('/student/:userId', getStudentAnalytics);
router.get('/student', getStudentAnalytics);
router.get('/admin', authorize('admin'), getAdminAnalytics);

// ── Phase 9: New analytics routes ─────────────────────────────────────────────
router.get('/question-quality', authorize('admin'), getQuestionQuality);
router.get('/quiz-effectiveness', authorize('admin'), getQuizEffectiveness);
router.get('/segmentation', authorize('admin'), getStudentSegmentation);
router.get('/institutional', authorize('admin'), getInstitutionalInsights);
router.get('/live', authorize('admin'), getLiveAnalytics);
router.get('/dashboard-drilldown', authorize('admin'), getDashboardDrillDown);

// Student or admin access
router.get('/behavior/:userId', getBehaviorProfile);
router.get('/behavior', getBehaviorProfile);
router.get('/insights/:userId', getAIInsights);
router.get('/insights', getAIInsights);
router.get('/benchmark/:userId', getPerformanceBenchmark);
router.get('/benchmark', getPerformanceBenchmark);

module.exports = router;
