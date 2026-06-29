const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAIReport,
  getLearningPath,
  analyzePerformance,
  getRecommendations,
  explainQuestion,
  getPracticeSet,
  submitPracticeSet,
  sendChatMessage,
  getChatHistory,
  getStreak,
  getAdminAIInsights,
} = require('../controllers/aiController');

const {
  generateQuestionsAdmin,
  generateQuizAdmin,
  generatePracticeStudent,
  generateExplanation,
  generateQuizFromPDF,
  generateQuizFromImage,
  getAIUsageStats,
  getAILogs,
  getAIHealth
} = require('../controllers/aiGenerationController');

// Multer memory storage configuration for file parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// All AI routes require authentication
router.use(protect);

// Performance analysis
router.post('/analyze', analyzePerformance);
router.post('/recommend', getRecommendations);

// Report card
router.get('/report/:userId', getAIReport);

// Learning path
router.get('/learning-path/:userId', getLearningPath);

// Practice set
router.get('/practice/:userId', getPracticeSet);
router.post('/practice/submit', submitPracticeSet);

// Question explanation
router.post('/explain', explainQuestion);

// AI Tutor Chat
router.post('/chat', sendChatMessage);
router.get('/chat/:userId', getChatHistory);

// Streak & Goals
router.get('/streak/:userId', getStreak);

// Admin AI Insights (admin only)
router.get('/admin-insights', authorize('admin'), getAdminAIInsights);

// ─── Phase 6 Generation Routes ──────────────────────────────────────────────

// Preview and generate questions (Admin only)
router.post('/generate-question', authorize('admin'), generateQuestionsAdmin);

// Create complete AI quiz (Admin only)
router.post('/generate-quiz', authorize('admin'), generateQuizAdmin);

// Generate practice sets (Admin / Student)
router.post('/generate-practice', generatePracticeStudent);

// Generate step-by-step solution breakdowns (Admin / Student)
router.post('/generate-explanation', generateExplanation);

// Parse PDF notes to questions (Admin only)
router.post('/pdf-to-quiz', authorize('admin'), upload.single('file'), generateQuizFromPDF);

// Parse diagrams to questions (Admin only)
router.post('/image-to-quiz', authorize('admin'), upload.single('file'), generateQuizFromImage);

// AI usage statistics (Admin only)
router.get('/usage-stats', authorize('admin'), getAIUsageStats);

// AI Monitoring logs (Admin only)
router.get('/logs', authorize('admin'), getAILogs);

// AI Monitoring health check (Admin only)
router.get('/health', authorize('admin'), getAIHealth);

module.exports = router;
