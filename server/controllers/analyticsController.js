const Attempt = require('../models/attemptModel');
const Question = require('../models/questionModel');
const User = require('../models/userModel');

// @desc    Get detailed analytics for a student
// @route   GET /api/analytics/student/:userId
// @access  Private
const getStudentAnalytics = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user._id;

    // Check authorization: must be self or admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== targetUserId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these analytics' });
    }

    const attempts = await Attempt.find({ user: targetUserId, isCompleted: true })
      .populate('quiz', 'title isAdaptive topic')
      .sort({ createdAt: 1 }); // Chronological order

    if (attempts.length === 0) {
      return res.json({
        success: true,
        hasData: false,
        stats: {
          overallAccuracy: 0,
          averageConfidence: 0,
          confidenceAccuracyIndex: 0,
          adaptiveScore: 0,
          currentDifficulty: 'medium',
        },
        topicMastery: [],
        charts: {
          accuracyByTopic: [],
          confidenceByTopic: [],
          difficultyProgression: [],
          timeTakenTrend: [],
        },
      });
    }

    // High level metrics
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalConfidenceMatches = 0;
    let totalConfidenceSum = 0;
    let totalAdaptiveScore = 0;
    let lastDifficulty = 'medium';

    // Grouping by topic
    const topicStats = {};

    // For difficulty progression chart
    const difficultyProgression = [];
    const difficultyMapping = { easy: 1, medium: 2, hard: 3, expert: 4 };

    // For time taken trend chart
    const timeTakenTrend = [];

    attempts.forEach((attempt, aIdx) => {
      totalAdaptiveScore += attempt.confidenceScore || 0;
      lastDifficulty = attempt.currentDifficulty || lastDifficulty;

      attempt.responses.forEach((resp, rIdx) => {
        totalQuestions++;
        if (resp.isCorrect) totalCorrect++;

        const topic = resp.topic || attempt.quiz.topic || 'General';
        const level = (resp.confidenceLevel || 'medium').toLowerCase();
        
        // Confidence level score (1, 2, 3)
        let confVal = 2;
        if (level === 'high') confVal = 3;
        else if (level === 'low') confVal = 1;
        totalConfidenceSum += confVal;

        // Confidence accuracy index match
        const isMatch = (resp.isCorrect && (level === 'high' || level === 'medium')) ||
                        (!resp.isCorrect && level === 'low');
        if (isMatch) totalConfidenceMatches++;

        // Group by topic
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

        // Add to difficulty progression
        difficultyProgression.push({
          name: `Q${totalQuestions}`,
          level: difficultyMapping[resp.difficulty || 'medium'] || 2,
          difficulty: resp.difficulty || 'medium',
        });

        // Add to response time trend
        timeTakenTrend.push({
          name: `Q${totalQuestions}`,
          time: resp.timeTaken || 0,
          topic: topic,
        });
      });
    });

    // Compute student topic mastery
    const topicMastery = Object.values(topicStats).map((topicData) => {
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

    const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const averageConfidence = totalQuestions > 0 ? Math.round((totalConfidenceSum / (totalQuestions * 3)) * 100) : 0;
    const confidenceAccuracyIndex = totalQuestions > 0 ? Math.round((totalConfidenceMatches / totalQuestions) * 100) : 0;

    // Build lists for topic charts
    const accuracyByTopic = topicMastery.map(t => ({ topic: t.topic, accuracy: t.accuracy }));
    const confidenceByTopic = topicMastery.map(t => ({ topic: t.topic, confidence: t.averageConfidence }));

    res.json({
      success: true,
      hasData: true,
      stats: {
        overallAccuracy,
        averageConfidence,
        confidenceAccuracyIndex,
        adaptiveScore: totalAdaptiveScore,
        currentDifficulty: lastDifficulty,
      },
      topicMastery,
      charts: {
        accuracyByTopic,
        confidenceByTopic,
        difficultyProgression: difficultyProgression.slice(-20), // Send last 20 responses
        timeTakenTrend: timeTakenTrend.slice(-20),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get dashboard analytics for administrators
// @route   GET /api/analytics/admin
// @access  Private/Admin
const getAdminAnalytics = async (req, res) => {
  try {
    const attempts = await Attempt.find({ isCompleted: true })
      .populate('user', 'name')
      .populate('quiz', 'title topic');

    // 1. Player Rankings (sort by total confidence score)
    const playerScores = {};
    const questionDifficultyCounts = { easy: 0, medium: 0, hard: 0, expert: 0 };
    const topicAggregates = {};
    const questionMissedCounter = {};

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
        // Difficulty distribution count
        const diff = resp.difficulty || 'medium';
        if (questionDifficultyCounts[diff] !== undefined) {
          questionDifficultyCounts[diff]++;
        }

        // Topic aggregation
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

        // Question missed metrics
        const qId = resp.questionId ? resp.questionId.toString() : 'unknown';
        if (qId !== 'unknown') {
          if (!questionMissedCounter[qId]) {
            questionMissedCounter[qId] = {
              questionId: qId,
              incorrectCount: 0,
              totalCount: 0,
            };
          }
          questionMissedCounter[qId].totalCount++;
          if (!resp.isCorrect) {
            questionMissedCounter[qId].incorrectCount++;
          }
        }
      });
    });

    // Finalize player rankings list
    const playerRankings = Object.values(playerScores)
      .map(player => ({
        name: player.name,
        score: player.totalScore,
        accuracy: player.questionsCount > 0 ? Math.round((player.correctCount / player.questionsCount) * 100) : 0,
        quizzesPlayed: player.attemptsCount,
      }))
      .sort((a, b) => b.score - a.score);

    // Finalize most missed questions details
    const missedQuestionsRaw = Object.values(questionMissedCounter)
      .filter(q => q.incorrectCount > 0)
      .sort((a, b) => b.incorrectCount - a.incorrectCount)
      .slice(0, 5);

    // Populate actual question text for missed questions list
    const mostMissedQuestions = [];
    for (const mq of missedQuestionsRaw) {
      const dbQ = await Question.findById(mq.questionId);
      if (dbQ) {
        mostMissedQuestions.push({
          questionText: dbQ.questionText,
          missedCount: mq.incorrectCount,
          totalAttempts: mq.totalCount,
          accuracy: Math.round(((mq.totalCount - mq.incorrectCount) / mq.totalCount) * 100),
          topic: dbQ.topic,
        });
      }
    }

    // Finalize topic performance metrics
    const topicPerformanceList = Object.values(topicAggregates).map(topic => {
      const accuracy = topic.totalAnswers > 0 ? Math.round((topic.correctAnswers / topic.totalAnswers) * 100) : 0;
      const avgConfidence = topic.totalAnswers > 0 ? Math.round((topic.confidenceSum / (topic.totalAnswers * 3)) * 100) : 0;
      return {
        topic: topic.topic,
        accuracy,
        avgConfidence,
        totalAnswers: topic.totalAnswers,
      };
    });

    // Most difficult topics (lowest accuracy)
    const mostDifficultTopics = [...topicPerformanceList]
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3)
      .map(t => ({ topic: t.topic, accuracy: t.accuracy }));

    // Overall metrics
    let totalQuestionsCount = 0;
    let totalConfidenceSum = 0;
    topicPerformanceList.forEach(t => {
      totalQuestionsCount += t.totalAnswers;
      totalConfidenceSum += (t.avgConfidence * t.totalAnswers);
    });
    const avgConfidenceClass = totalQuestionsCount > 0 ? Math.round(totalConfidenceSum / totalQuestionsCount) : 0;

    // Charts payload structures
    const topicPerformanceChart = topicPerformanceList.map(t => ({
      topic: t.topic,
      accuracy: t.accuracy,
      confidence: t.avgConfidence,
    }));

    // Calculate confidence levels globally
    let highConfCount = 0, medConfCount = 0, lowConfCount = 0;
    attempts.forEach(att => {
      att.responses.forEach(resp => {
        if (resp.confidenceLevel === 'high') highConfCount++;
        else if (resp.confidenceLevel === 'low') lowConfCount++;
        else medConfCount++;
      });
    });

    const confidenceDistribution = [
      { name: 'High', value: highConfCount },
      { name: 'Medium', value: medConfCount },
      { name: 'Low', value: lowConfCount },
    ];

    // Difficulty distribution mapping
    const difficultyDistribution = [
      { name: 'Easy', value: questionDifficultyCounts.easy },
      { name: 'Medium', value: questionDifficultyCounts.medium },
      { name: 'Hard', value: questionDifficultyCounts.hard },
      { name: 'Expert', value: questionDifficultyCounts.expert },
    ];

    res.json({
      success: true,
      stats: {
        averageConfidence: avgConfidenceClass,
        mostMissedQuestions,
        mostDifficultTopics,
        playerRankings,
        difficultyDistribution,
      },
      charts: {
        topicPerformance: topicPerformanceChart,
        confidenceDistribution,
        leaderboardTrends: playerRankings.slice(0, 10), // Send top 10 players
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 9: ADVANCED ANALYTICS HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

const { analyzeQuestionQuality, getQuestionQualitySummary } = require('../services/questionAnalyzer');
const { analyzeQuizEffectiveness } = require('../services/quizAnalyzer');
const { segmentAllStudents } = require('../services/segmentationEngine');
const { analyzeBehavior } = require('../services/behaviorAnalyzer');
const { getStudentAnalyticsProfile } = require('../services/analyticsEngine');
const { generateStudentInsights, generateClassInsights } = require('../services/insightGenerator');
const TopicMastery = require('../models/topicMasteryModel');

// ── Question Quality Analytics ────────────────────────────────────────────────
// GET /api/analytics/question-quality
const getQuestionQuality = async (req, res) => {
  try {
    const metrics = await analyzeQuestionQuality();
    const summary = await getQuestionQualitySummary(metrics);
    res.json({ success: true, metrics, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Quiz Effectiveness Analytics ──────────────────────────────────────────────
// GET /api/analytics/quiz-effectiveness
const getQuizEffectiveness = async (req, res) => {
  try {
    const quizzes = await analyzeQuizEffectiveness();
    const avgEffectiveness = quizzes.length > 0
      ? Math.round(quizzes.reduce((s, q) => s + q.effectivenessScore, 0) / quizzes.length)
      : 0;
    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    quizzes.forEach((q) => { gradeDistribution[q.grade] = (gradeDistribution[q.grade] || 0) + 1; });
    res.json({ success: true, quizzes, avgEffectiveness, gradeDistribution });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Student Segmentation ──────────────────────────────────────────────────────
// GET /api/analytics/segmentation
const getStudentSegmentation = async (req, res) => {
  try {
    const result = await segmentAllStudents();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Behavioral Profile ────────────────────────────────────────────────────────
// GET /api/analytics/behavior/:userId
const getBehaviorProfile = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const behavior = await analyzeBehavior(userId);
    res.json({ success: true, behavior });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── AI Insight Cards ──────────────────────────────────────────────────────────
// GET /api/analytics/insights/:userId
const getAIInsights = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const [profile, behavior] = await Promise.all([
      getStudentAnalyticsProfile(userId),
      analyzeBehavior(userId),
    ]);
    const insights = generateStudentInsights(profile, behavior);
    res.json({ success: true, insights, profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Institutional Insights ────────────────────────────────────────────────────
// GET /api/analytics/institutional
const getInstitutionalInsights = async (req, res) => {
  try {
    // Topic mastery across all students
    const topicAgg = await Attempt.aggregate([
      { $match: { isCompleted: true } },
      { $unwind: '$responses' },
      {
        $group: {
          _id: '$responses.topic',
          total: { $sum: 1 },
          correct: { $sum: { $cond: ['$responses.isCorrect', 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const topicInsights = topicAgg
      .filter((t) => t._id)
      .map((t) => ({
        topic: t._id,
        accuracy: Math.round((t.correct / t.total) * 100),
        totalAnswers: t.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    // Monthly attempt volume trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await Attempt.aggregate([
      { $match: { isCompleted: true, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          attempts: { $sum: 1 },
          avgScore: { $avg: '$percentage' },
          students: { $addToSet: '$user' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const growth = monthlyTrend.map((m) => ({
      month: m._id,
      attempts: m.attempts,
      avgScore: Math.round(m.avgScore || 0),
      uniqueStudents: m.students.length,
    }));

    // Total stats
    const totalAttempts = await Attempt.countDocuments({ isCompleted: true });
    const totalStudents = await User.countDocuments({ role: 'student' });
    const avgScore = await Attempt.aggregate([
      { $match: { isCompleted: true } },
      { $group: { _id: null, avg: { $avg: '$percentage' } } },
    ]);

    const classInsights = generateClassInsights({
      topicPerformance: topicInsights,
      playerRankings: [],
      stats: { averageConfidence: 55 },
    });

    res.json({
      success: true,
      topicInsights,
      growth,
      summary: {
        totalAttempts,
        totalStudents,
        avgScore: Math.round(avgScore[0]?.avg || 0),
        hardestTopics: topicInsights.slice(0, 3),
        easiestTopics: [...topicInsights].sort((a, b) => b.accuracy - a.accuracy).slice(0, 3),
      },
      insights: classInsights,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Live Analytics (polling-based) ────────────────────────────────────────────
// GET /api/analytics/live
const getLiveAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const [recentAttempts, todayAttempts, topScorers] = await Promise.all([
      Attempt.find({ createdAt: { $gte: oneHourAgo } })
        .populate('user', 'name')
        .populate('quiz', 'title')
        .sort({ createdAt: -1 })
        .limit(10),
      Attempt.find({ isCompleted: true, createdAt: { $gte: oneDayAgo } }),
      Attempt.find({ isCompleted: true, createdAt: { $gte: oneDayAgo } })
        .populate('user', 'name')
        .sort({ percentage: -1 })
        .limit(10),
    ]);

    const activeCount = recentAttempts.filter((a) => !a.isCompleted).length;
    const avgTodayScore = todayAttempts.length > 0
      ? Math.round(todayAttempts.reduce((s, a) => s + a.percentage, 0) / todayAttempts.length)
      : 0;

    // Live leaderboard
    const leaderboard = topScorers.map((a) => ({
      name: a.user?.name || 'Unknown',
      score: a.percentage,
      quiz: a.quiz?.title || 'Unknown',
      time: a.createdAt,
    }));

    // Recent activity feed
    const feed = recentAttempts.slice(0, 8).map((a) => ({
      student: a.user?.name || 'Unknown',
      quiz: a.quiz?.title || 'Unknown',
      status: a.isCompleted ? 'completed' : 'in-progress',
      score: a.isCompleted ? a.percentage : null,
      time: a.createdAt,
    }));

    res.json({
      success: true,
      live: {
        activeStudents: activeCount,
        completedToday: todayAttempts.filter((a) => a.isCompleted).length,
        avgScoreToday: avgTodayScore,
        leaderboard,
        feed,
        lastUpdated: now,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Performance Benchmarking ──────────────────────────────────────────────────
// GET /api/analytics/benchmark/:userId
const getPerformanceBenchmark = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const [myAttempts, allAttempts] = await Promise.all([
      Attempt.find({ user: userId, isCompleted: true }),
      Attempt.find({ isCompleted: true }).populate('user', 'name'),
    ]);

    const myAvg = myAttempts.length > 0
      ? Math.round(myAttempts.reduce((s, a) => s + a.percentage, 0) / myAttempts.length)
      : 0;

    const classAvg = allAttempts.length > 0
      ? Math.round(allAttempts.reduce((s, a) => s + a.percentage, 0) / allAttempts.length)
      : 0;

    // Top 10% threshold
    const allScores = allAttempts.map((a) => a.percentage).sort((a, b) => b - a);
    const top10Index = Math.ceil(allScores.length * 0.1);
    const top10Avg = top10Index > 0
      ? Math.round(allScores.slice(0, top10Index).reduce((s, v) => s + v, 0) / top10Index)
      : 100;

    // Student percentile rank
    const betterThan = allScores.filter((s) => s < myAvg).length;
    const percentile = allScores.length > 0 ? Math.round((betterThan / allScores.length) * 100) : 0;

    // Topic comparison
    const myTopicMap = {};
    myAttempts.forEach((a) => {
      (a.responses || []).forEach((r) => {
        const t = r.topic || 'General';
        if (!myTopicMap[t]) myTopicMap[t] = { correct: 0, total: 0 };
        myTopicMap[t].total++;
        if (r.isCorrect) myTopicMap[t].correct++;
      });
    });

    const classTopicMap = {};
    allAttempts.forEach((a) => {
      (a.responses || []).forEach((r) => {
        const t = r.topic || 'General';
        if (!classTopicMap[t]) classTopicMap[t] = { correct: 0, total: 0 };
        classTopicMap[t].total++;
        if (r.isCorrect) classTopicMap[t].correct++;
      });
    });

    const topicComparison = Object.keys(myTopicMap).map((topic) => ({
      topic,
      myAccuracy: Math.round((myTopicMap[topic].correct / myTopicMap[topic].total) * 100),
      classAccuracy: classTopicMap[topic]
        ? Math.round((classTopicMap[topic].correct / classTopicMap[topic].total) * 100)
        : 0,
    }));

    res.json({
      success: true,
      benchmark: {
        myAvgScore: myAvg,
        classAvgScore: classAvg,
        top10AvgScore: top10Avg,
        percentileRank: percentile,
        totalStudents: new Set(allAttempts.map((a) => a.user?._id?.toString()).filter(Boolean)).size,
        topicComparison,
        performanceGap: myAvg - classAvg,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get detailed list of database entities for admin dashboard drill-downs
// @route   GET /api/analytics/dashboard-drilldown
// @access  Private/Admin
const getDashboardDrillDown = async (req, res) => {
  try {
    const { metric } = req.query;
    if (!metric) {
      return res.status(400).json({ success: false, message: 'Please specify a metric query parameter' });
    }

    const Quiz = require('../models/quizModel');
    const ExamSession = require('../models/examSessionModel');
    const SecurityLog = require('../models/securityLogModel');

    let list = [];

    if (metric === 'students') {
      const students = await User.find({ role: 'student' }).sort({ createdAt: -1 }).lean();
      list = await Promise.all(
        students.map(async (student) => {
          const attempts = await Attempt.find({ user: student._id, isCompleted: true }).lean();
          const quizzesAttempted = attempts.length;
          const totalPercentage = attempts.reduce((sum, a) => sum + (a.percentage || 0), 0);
          const averageScore = quizzesAttempted > 0 ? Math.round(totalPercentage / quizzesAttempted) : 0;
          return {
            _id: student._id,
            name: student.name,
            email: student.email,
            createdAt: student.createdAt,
            role: student.role,
            lastActive: student.lastActiveDate || student.createdAt,
            quizzesAttempted,
            averageScore,
          };
        })
      );
    } else if (metric === 'quizzes') {
      const quizzes = await Quiz.find({}).populate('createdBy', 'name email').sort({ createdAt: -1 }).lean();
      list = await Promise.all(
        quizzes.map(async (quiz) => {
          const totalQuestions = quiz.questions?.length || 0;
          const attemptsCount = await Attempt.countDocuments({ quiz: quiz._id, isCompleted: true });
          return {
            _id: quiz._id,
            title: quiz.title,
            topic: quiz.topic || 'General',
            isAdaptive: quiz.isAdaptive || false,
            totalQuestions,
            attemptsCount,
            createdAt: quiz.createdAt || new Date(),
            createdBy: quiz.createdBy?.name || 'Admin',
          };
        })
      );
    } else if (metric === 'active-exams') {
      const activeSessions = await ExamSession.find({ isActive: true })
        .populate('userId', 'name email')
        .populate('quizId', 'title')
        .sort({ loginTime: -1 })
        .lean();
      list = activeSessions.map(session => ({
        _id: session._id,
        studentName: session.userId?.name || 'Unknown',
        studentEmail: session.userId?.email || '',
        quizTitle: session.quizId?.title || 'Unknown',
        loginTime: session.loginTime,
        lastActive: session.lastActive,
        allowedTabSwitches: session.allowedTabSwitches,
        autoSubmitThreshold: session.autoSubmitThreshold,
        attemptId: session.attemptId,
      }));
    } else if (metric === 'violations') {
      const logs = await SecurityLog.find({
        eventType: { $nin: ['SECURITY_HEARTBEAT', 'PROCTOR_SNAP', 'CAMERA_PERMISSION_GRANTED'] }
      })
        .populate('userId', 'name email')
        .populate('quizId', 'title')
        .sort({ timestamp: -1 })
        .limit(200)
        .lean();
      list = logs.map(log => ({
        _id: log._id,
        studentName: log.userId?.name || 'Unknown',
        studentEmail: log.userId?.email || '',
        quizTitle: log.quizId?.title || 'Unknown',
        eventType: log.eventType,
        timestamp: log.timestamp,
        metadata: log.metadata,
        attemptId: log.attemptId,
      }));
    } else if (metric === 'ai-questions') {
      const aiQuestions = await Question.find({ generatedByAI: true })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .lean();
      list = aiQuestions.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
        topic: q.topic,
        explanation: q.explanation,
        createdAt: q.createdAt,
        createdBy: q.createdBy?.name || 'AI Generator',
      }));
    } else {
      return res.status(400).json({ success: false, message: `Unknown metric type: ${metric}` });
    }

    res.json({ success: true, list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
