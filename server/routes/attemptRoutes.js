const express = require('express');
const router = express.Router();
const {
  startAttempt,
  submitAdaptiveAnswer,
  submitStaticAttempt,
  getUserResults,
  getAdminStats,
  getAttemptById,
  getAttemptQuestion,
} = require('../controllers/attemptController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', startAttempt);
router.post('/start', startAttempt); // backup
router.post('/submit-answer', submitAdaptiveAnswer);
router.post('/submit-static', submitStaticAttempt);
router.get('/results/:userId', getUserResults);
router.get('/stats', authorize('admin'), getAdminStats);
router.get('/:id/question/:index', getAttemptQuestion);
router.get('/:id', getAttemptById);

module.exports = router;
