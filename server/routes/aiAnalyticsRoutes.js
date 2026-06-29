const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getRecommendations,
  getPredictions,
  getStudyPlan,
  getReadiness,
  getSkillProfile,
  getCohortPredictions
} = require('../controllers/aiAnalyticsController');

// All analytics services require user protection
router.use(protect);

// Cohort aggregated stats for admins (defined first to prevent conflict with :userId parameter matching)
router.get('/predictions/cohort', authorize('admin'), getCohortPredictions);

// Student level diagnostic endpoints
router.get('/recommendations/:userId', getRecommendations);
router.get('/predictions/:userId', getPredictions);
router.get('/study-plan/:userId', getStudyPlan);
router.get('/readiness/:userId', getReadiness);
router.get('/skill-profile/:userId', getSkillProfile);

module.exports = router;
