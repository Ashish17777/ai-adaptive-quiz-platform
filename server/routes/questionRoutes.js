const express = require('express');
const router = express.Router();
const {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

router
  .route('/')
  .get(getQuestions)
  .post(authorize('admin'), createQuestion);

router
  .route('/:id')
  .get(getQuestionById)
  .put(authorize('admin'), updateQuestion)
  .delete(authorize('admin'), deleteQuestion);

module.exports = router;
