const express = require('express');
const router = express.Router();
const {
  getQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
} = require('../controllers/quizController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router
  .route('/')
  .get(getQuizzes)
  .post(authorize('admin'), createQuiz);

router
  .route('/:id')
  .get(getQuizById)
  .put(authorize('admin'), updateQuiz)
  .delete(authorize('admin'), deleteQuiz);

module.exports = router;
