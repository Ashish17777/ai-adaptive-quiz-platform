const Attempt = require('../models/attemptModel');
const User = require('../models/userModel');
const Quiz = require('../models/quizModel');
const Question = require('../models/questionModel');
const Recommendation = require('../models/recommendationModel');
const AILog = require('../models/aiLogModel');
const { generateSmartRecommendations } = require('../services/recommendationEngine');
const { generateStudentPDF, generateQuizPDF, generateClassPDF } = require('../services/pdfReportGenerator');

/**
 * Helper to log export actions to AILog
 */
async function logExport(userId, reportType, isSuccess, durationMs, errorMsg = '') {
  try {
    await AILog.create({
      userId,
      action: 'pdf_report_export',
      topic: reportType,
      prompt: `PDF Export requested for ${reportType}`,
      validationResults: {
        success: isSuccess,
        errors: errorMsg ? [errorMsg] : []
      },
      generationTimeMs: Math.round(durationMs),
      errorMessage: errorMsg,
      success: isSuccess
    });
  } catch (err) {
    console.error('[AILog] Failed to save pdf export log:', err.message);
  }
}

/**
 * @desc    Get student performance PDF report
 * @route   GET /api/reports/student/pdf/:id
 * @access  Private
 */
const getStudentPDFReport = async (req, res) => {
  const startTime = Date.now();
  const targetUserId = req.params.id;

  try {
    // 1. Authorization check: self or admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== targetUserId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these analytics' });
    }

    // 2. Fetch User
    const student = await User.findById(targetUserId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    // 3. Aggregate Student Analytics Data
    const attempts = await Attempt.find({ user: targetUserId, isCompleted: true })
      .populate('quiz', 'title isAdaptive topic')
      .sort({ createdAt: 1 });

    const stats = {
      overallAccuracy: 0,
      averageConfidence: 0,
      confidenceAccuracyIndex: 0,
      adaptiveScore: 0,
      currentDifficulty: 'medium',
    };

    let topicMastery = [];

    if (attempts.length > 0) {
      let totalQuestions = 0;
      let totalCorrect = 0;
      let totalConfidenceMatches = 0;
      let totalConfidenceSum = 0;
      let totalAdaptiveScore = 0;
      let lastDifficulty = 'medium';

      const topicStats = {};

      attempts.forEach((attempt) => {
        totalAdaptiveScore += attempt.confidenceScore || 0;
        lastDifficulty = attempt.currentDifficulty || lastDifficulty;

        attempt.responses.forEach((resp) => {
          totalQuestions++;
          if (resp.isCorrect) totalCorrect++;

          const topic = resp.topic || (attempt.quiz ? attempt.quiz.topic : 'General') || 'General';
          const level = (resp.confidenceLevel || 'medium').toLowerCase();
          
          let confVal = 2;
          if (level === 'high') confVal = 3;
          else if (level === 'low') confVal = 1;
          totalConfidenceSum += confVal;

          const isMatch = (resp.isCorrect && (level === 'high' || level === 'medium')) ||
                          (!resp.isCorrect && level === 'low');
          if (isMatch) totalConfidenceMatches++;

          if (!topicStats[topic]) {
            topicStats[topic] = {
              topic,
              total: 0,
              correct: 0,
              confidenceSum: 0,
              confidenceMatches: 0,
            };
          }
          topicStats[topic].total++;
          if (resp.isCorrect) topicStats[topic].correct++;
          topicStats[topic].confidenceSum += confVal;
          if (isMatch) topicStats[topic].confidenceMatches++;
        });
      });

      topicMastery = Object.values(topicStats).map((topicData) => {
        const accuracy = Math.round((topicData.correct / topicData.total) * 100);
        const avgConf = Math.round((topicData.confidenceSum / (topicData.total * 3)) * 100);
        
        let status = 'Needs Improvement';
        if (accuracy >= 85) {
          status = 'Mastered';
        } else if (accuracy < 50) {
          status = 'Weak Area';
        }

        return {
          topic: topicData.topic,
          accuracy,
          averageConfidence: avgConf,
          status,
          totalQuestions: topicData.total,
        };
      });

      stats.overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
      stats.averageConfidence = totalQuestions > 0 ? Math.round((totalConfidenceSum / (totalQuestions * 3)) * 100) : 0;
      stats.confidenceAccuracyIndex = totalQuestions > 0 ? Math.round((totalConfidenceMatches / totalQuestions) * 100) : 0;
      stats.adaptiveScore = totalAdaptiveScore;
      stats.currentDifficulty = lastDifficulty;
    }

    const analytics = {
      overallAccuracy: stats.overallAccuracy,
      averageConfidence: stats.averageConfidence,
      confidenceAccuracyIndex: stats.confidenceAccuracyIndex,
      adaptiveScore: stats.adaptiveScore,
      currentDifficulty: stats.currentDifficulty,
      topicMastery
    };

    // 4. Recommendations
    let recommendations = await Recommendation.findOne({ userId: targetUserId });
    if (!recommendations) {
      try {
        recommendations = await generateSmartRecommendations(targetUserId);
      } catch (recErr) {
        console.error('Failed to generate smart recommendations for PDF:', recErr.message);
      }
    }

    // 5. Response headers
    const safeName = student.name.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_student_report.pdf"`);

    // 6. Generate and stream
    generateStudentPDF(student, analytics, recommendations, res);

    const duration = Date.now() - startTime;
    await logExport(req.user._id, 'Student Report', true, duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    await logExport(req.user._id, 'Student Report', false, duration, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get quiz evaluation PDF report
 * @route   GET /api/reports/quiz/pdf/:id
 * @access  Private
 */
const getQuizPDFReport = async (req, res) => {
  const startTime = Date.now();
  const id = req.params.id;

  try {
    // 1. Fetch Attempt
    const attempt = await Attempt.findById(id)
      .populate('user', 'name email')
      .populate('quiz', 'title description isAdaptive topic')
      .populate({
        path: 'questionsOrder',
        select: 'questionText options correctAnswer difficulty topic explanation',
      })
      .populate({
        path: 'responses.questionId',
        select: 'questionText options correctAnswer difficulty topic explanation',
      });

    if (!attempt) {
      // If attempt is not found, check if it's a quiz ID to run a quiz-wide summary
      const quiz = await Quiz.findById(id).populate('createdBy', 'name');
      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Quiz or Attempt report target not found' });
      }

      // Quiz wide report authorization check: admin only
      if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized to view quiz analytics' });
      }

      // Generate quiz-wide PDF report directly
      const allAttempts = await Attempt.find({ quiz: quiz._id, isCompleted: true });
      const totalAttemptsCount = await Attempt.countDocuments({ quiz: quiz._id });
      const completedAttemptsCount = allAttempts.length;

      const completionRate = totalAttemptsCount > 0 ? Math.round((completedAttemptsCount / totalAttemptsCount) * 100) : 0;
      const uniqueUsers = new Set(allAttempts.map(a => a.user.toString()));
      
      const averageAccuracy = completedAttemptsCount > 0 
        ? Math.round(allAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / completedAttemptsCount) 
        : 0;

      const quizStats = {
        participantCount: uniqueUsers.size,
        averageScore: averageAccuracy,
        completionRate
      };

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${quiz.title.replace(/\s+/g, '_')}_stats_report.pdf"`);

      // Reuse attempt layout by creating a mock attempt wrap
      const mockAttempt = {
        quiz,
        user: { name: 'Cohort Summary' },
        score: averageAccuracy,
        totalQuestions: quiz.questions ? quiz.questions.length : 0,
        percentage: averageAccuracy,
        confidenceScore: 0,
        averageConfidence: 0,
        confidenceAccuracyIndex: 0,
        overconfidenceCount: 0,
        underconfidenceCount: 0,
        currentDifficulty: 'medium',
        responses: []
      };

      generateQuizPDF(mockAttempt, quizStats, res);
      const duration = Date.now() - startTime;
      await logExport(req.user._id, 'Quiz Report', true, duration);
      return;
    }

    // 2. Authorization check: self or admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== attempt.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these results' });
    }

    // 3. Quiz stats aggregates across all attempts
    const allQuizAttempts = await Attempt.find({ quiz: attempt.quiz._id });
    const completedAttempts = allQuizAttempts.filter(a => a.isCompleted);

    const totalAttemptsCount = allQuizAttempts.length;
    const completedAttemptsCount = completedAttempts.length;

    const completionRate = totalAttemptsCount > 0 ? Math.round((completedAttemptsCount / totalAttemptsCount) * 100) : 0;
    const uniqueUsers = new Set(allQuizAttempts.map(a => a.user.toString()));
    const participantCount = uniqueUsers.size;

    const averageScore = completedAttemptsCount > 0
      ? Math.round(completedAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / completedAttemptsCount)
      : 0;

    const quizStats = {
      participantCount,
      averageScore,
      completionRate
    };

    // 4. Response headers
    const studentName = attempt.user ? attempt.user.name : 'Student';
    const safeName = studentName.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_quiz_report.pdf"`);

    // 5. Generate and stream
    generateQuizPDF(attempt, quizStats, res);

    const duration = Date.now() - startTime;
    await logExport(req.user._id, 'Quiz Report', true, duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    await logExport(req.user._id, 'Quiz Report', false, duration, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get class cohort performance analytics PDF report
 * @route   GET /api/reports/class/pdf/:id
 * @access  Private (Admin only)
 */
const getClassPDFReport = async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. Authorization: Enforce Admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can download cohort reports' });
    }

    // 2. Aggregate Class Analytics Data
    const attempts = await Attempt.find({ isCompleted: true })
      .populate('user', 'name')
      .populate('quiz', 'title topic');

    const playerScores = {};
    const topicAggregates = {};

    attempts.forEach(attempt => {
      const studentName = attempt.user ? attempt.user.name : 'Unknown Student';
      const studentId = attempt.user ? attempt.user._id.toString() : 'unknown';

      if (studentId !== 'unknown') {
        if (!playerScores[studentId]) {
          playerScores[studentId] = {
            name: studentName,
            totalScore: 0,
            attemptsCount: 0,
            correctCount: 0,
            questionsCount: 0,
          };
        }
        playerScores[studentId].totalScore += attempt.confidenceScore || 0;
        playerScores[studentId].attemptsCount++;
        playerScores[studentId].correctCount += attempt.score;
        playerScores[studentId].questionsCount += attempt.totalQuestions;
      }

      attempt.responses.forEach(resp => {
        const topic = resp.topic || 'General';
        if (!topicAggregates[topic]) {
          topicAggregates[topic] = {
            topic,
            totalAnswers: 0,
            correctAnswers: 0,
            confidenceSum: 0,
          };
        }
        topicAggregates[topic].totalAnswers++;
        if (resp.isCorrect) topicAggregates[topic].correctAnswers++;
        
        let confVal = 2;
        if (resp.confidenceLevel === 'high') confVal = 3;
        else if (resp.confidenceLevel === 'low') confVal = 1;
        topicAggregates[topic].confidenceSum += confVal;
      });
    });

    const playerRankings = Object.values(playerScores)
      .map(player => ({
        name: player.name,
        score: player.totalScore,
        accuracy: player.questionsCount > 0 ? Math.round((player.correctCount / player.questionsCount) * 100) : 0,
        quizzesPlayed: player.attemptsCount,
      }))
      .sort((a, b) => b.score - a.score);

    const topicPerformanceList = Object.values(topicAggregates).map(topic => {
      const accuracy = topic.totalAnswers > 0 ? Math.round((topic.correctAnswers / topic.totalAnswers) * 100) : 0;
      const avgConfidence = topic.totalAnswers > 0 ? Math.round((topic.confidenceSum / (topic.totalAnswers * 3)) * 100) : 0;
      return {
        topic: topic.topic,
        accuracy,
        confidence: avgConfidence,
        totalAnswers: topic.totalAnswers,
      };
    });

    const mostDifficultTopics = [...topicPerformanceList]
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3)
      .map(t => ({ topic: t.topic, accuracy: t.accuracy }));

    let totalQuestionsCount = 0;
    let totalConfidenceSum = 0;
    topicPerformanceList.forEach(t => {
      totalQuestionsCount += t.totalAnswers;
      totalConfidenceSum += (t.confidence * t.totalAnswers);
    });
    const avgConfidenceClass = totalQuestionsCount > 0 ? Math.round(totalConfidenceSum / totalQuestionsCount) : 0;

    const totalStudents = await User.countDocuments({ role: 'student' });

    const classStats = {
      totalStudents,
      averageConfidence: avgConfidenceClass,
      mostDifficultTopics,
      topicPerformance: topicPerformanceList,
      playerRankings
    };

    // 3. Response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Class_Analytics_Report_${new Date().toISOString().slice(0, 10)}.pdf"`);

    // 4. Generate and stream
    generateClassPDF(classStats, res);

    const duration = Date.now() - startTime;
    await logExport(req.user._id, 'Class Report', true, duration);

  } catch (error) {
    const duration = Date.now() - startTime;
    await logExport(req.user._id, 'Class Report', false, duration, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getStudentPDFReport,
  getQuizPDFReport,
  getClassPDFReport
};
