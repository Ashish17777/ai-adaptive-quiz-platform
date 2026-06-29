const express = require('express');
const router = express.Router();
const { getStudentPDFReport, getQuizPDFReport, getClassPDFReport } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

// Protect all routes
router.use(protect);

// PDF Export routes
router.get('/student/pdf/:id', getStudentPDFReport);
router.get('/quiz/pdf/:id', getQuizPDFReport);
router.get('/class/pdf/:id', getClassPDFReport);

module.exports = router;
