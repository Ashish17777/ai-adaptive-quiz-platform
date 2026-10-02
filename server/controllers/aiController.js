const Attempt = require('../models/attemptModel');
const Question = require('../models/questionModel');
const User = require('../models/userModel');
const TopicMastery = require('../models/topicMasteryModel');
const LearningPath = require('../models/learningPathModel');
const PracticeSet = require('../models/practiceSetModel');
const AIReport = require('../models/aiReportModel');
const ChatMessage = require('../models/chatMessageModel');
const aiService = require('../services/aiService');
const { randomUUID } = require('crypto');

// Phase 7 Predictive Engine Services
const { updateStudentSkillProfile } = require('../services/skillAnalyzer');
const { generatePredictions } = require('../services/predictionEngine');
const { generateSmartRecommendations } = require('../services/recommendationEngine');
const { generateStudyPlan } = require('../services/studyPlanGenerator');

// ─── Helper: Update Topic Mastery After Attempt ──────────────────────────────

const updateTopicMastery = async (userId, responses) => {
  // Group responses by topic
  const byTopic = {};
  responses.forEach((r) => {
    const topic = (r.topic || 'general').toLowerCase();
    if (!byTopic[topic]) byTopic[topic] = { total: 0, correct: 0, confMatches: 0, timeSum: 0, difficulties: [] };
    byTopic[topic].total++;
    if (r.isCorrect) byTopic[topic].correct++;
    byTopic[topic].timeSum += r.timeTaken || 0;
    byTopic[topic].difficulties.push(r.difficulty || 'medium');

    // Confidence accuracy match
    const level = (r.confidenceLevel || 'medium').toLowerCase();
    const isMatch = (r.isCorrect && (level === 'high' || level === 'medium')) || (!r.isCorrect && level === 'low');
    if (isMatch) byTopic[topic].confMatches++;
  });

  for (const [topic, data] of Object.entries(byTopic)) {
    const accuracy = Math.round((data.correct / data.total) * 100);
    const confAccuracy = Math.round((data.confMatches / data.total) * 100);
    const avgTime = Math.round(data.timeSum / data.total);

    // Dominant difficulty
    const diffCounts = {};
    data.difficulties.forEach(d => { diffCounts[d] = (diffCounts[d] || 0) + 1; });
    const avgDifficulty = Object.entries(diffCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';

    let status = 'weak';
    if (accuracy >= 85) status = 'mastered';
    else if (accuracy >= 60) status = 'intermediate';

    await TopicMastery.findOneAndUpdate(
      { userId, topic },
      {
        $inc: { totalAnswered: data.total, correctCount: data.correct },
        $set: { accuracy, confidenceAccuracy: confAccuracy, avgTimeTaken: avgTime, avgDifficulty, status, lastUpdated: new Date() },
      },
      { upsert: true, new: true }
    );
  }
};

// ─── Helper: Update User Streak ───────────────────────────────────────────────

const updateStreak = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
  if (lastActive) lastActive.setHours(0, 0, 0, 0);

  const isToday = lastActive && lastActive.getTime() === today.getTime();
  const isYesterday = lastActive && (today - lastActive) === 86400000;

  if (!isToday) {
    const newStreak = isYesterday ? (user.currentStreak || 0) + 1 : 1;
    const longest = Math.max(newStreak, user.longestStreak || 0);
    await User.findByIdAndUpdate(userId, {
      currentStreak: newStreak,
      longestStreak: longest,
      lastActiveDate: new Date(),
    });
  }
};

// ─── POST /api/ai/trigger-post-quiz ──────────────────────────────────────────
// Called internally after a quiz attempt completes to update mastery + generate report

const triggerPostQuizAI = async (userId, attemptId) => {
  try {
    const attempt = await Attempt.findById(attemptId).populate('quiz');
    if (!attempt || !attempt.isCompleted) return;

    // 1. Update topic mastery
    await updateTopicMastery(userId, attempt.responses);

    // 2. Update streak
    await updateStreak(userId);

    // 3. Fetch updated mastery records
    const masteryRecords = await TopicMastery.find({ userId });

    // 4. Run AI analysis
    const analysis = await aiService.analyze({
      topicMasteryRecords: masteryRecords,
      attempts: [attempt],
    });

    // 5. Save AI Report Card
    const topicBreakdown = analysis.topicBreakdown || [];

    await AIReport.findOneAndUpdate(
      { attemptId },
      {
        userId,
        attemptId,
        summary: analysis.summary,
        learningLevel: analysis.learningLevel,
        accuracy: attempt.percentage || 0,
        confidenceAccuracy: attempt.confidenceAccuracyIndex || 0,
        adaptiveScore: attempt.confidenceScore || 0,
        difficultyReached: attempt.currentDifficulty || 'medium',
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        suggestedTopics: analysis.recommendedTopics,
        studyRecommendations: analysis.studyRecommendations,
        topicBreakdown,
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // 6. Rebuild learning path
    const allTopics = await Question.distinct('topic');
    const pathData = await aiService.buildPath(masteryRecords, allTopics);

    await LearningPath.findOneAndUpdate(
      { userId },
      {
        userId,
        currentLevel: pathData.currentLevel,
        steps: pathData.steps,
        recommendedTopics: pathData.recommendedTopics,
        weakTopics: pathData.weakTopics,
        strengths: pathData.strengths,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );

    // 7. Recalculate Student skill profile, predictions, recommendations, and study plans
    await updateStudentSkillProfile(userId, attemptId);
    await generatePredictions(userId);
    await generateSmartRecommendations(userId);
    await generateStudyPlan(userId);
  } catch (err) {
    console.error('[AI] Post-quiz trigger error:', err.message);
  }
};

// ─── GET /api/ai/report/:userId ───────────────────────────────────────────────

const getAIReport = async (req, res) => {
  try {
    const { userId } = req.params;
    const { attemptId } = req.query;

    // Auth check
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    let report;
    if (attemptId) {
      report = await AIReport.findOne({ attemptId }).lean();
    } else {
      // Latest report for this user
      report = await AIReport.findOne({ userId }).sort({ generatedAt: -1 }).lean();
    }

    if (!report) {
      return res.json({ success: true, hasReport: false });
    }

    res.json({ success: true, hasReport: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/ai/learning-path/:userId ───────────────────────────────────────

const getLearningPath = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    let path = await LearningPath.findOne({ userId }).lean();

    if (!path) {
      // Generate fresh path
      const masteryRecords = await TopicMastery.find({ userId });
      const allTopics = await Question.distinct('topic');
      const pathData = await aiService.buildPath(masteryRecords, allTopics);

      path = await LearningPath.findOneAndUpdate(
        { userId },
        { userId, ...pathData, generatedAt: new Date(), lastUpdated: new Date() },
        { upsert: true, new: true }
      );
    }

    // Also grab mastery for radar chart
    const masteryRecords = await TopicMastery.find({ userId }).lean();

    res.json({ success: true, path, masteryRecords });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/ai/analyze ─────────────────────────────────────────────────────

const analyzePerformance = async (req, res) => {
  try {
    const userId = req.user._id;
    const masteryRecords = await TopicMastery.find({ userId });
    const attempts = await Attempt.find({ user: userId, isCompleted: true }).limit(10).sort({ createdAt: -1 });

    const analysis = await aiService.analyze({ topicMasteryRecords: masteryRecords, attempts });
    res.json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/ai/recommend ───────────────────────────────────────────────────

const getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;
    const masteryRecords = await TopicMastery.find({ userId });

    if (masteryRecords.length === 0) {
      return res.json({
        success: true,
        recommendations: {
          recommendedTopics: [],
          studyRecommendations: ['Complete your first quiz to receive personalized recommendations.'],
          learningLevel: 'beginner',
          summary: 'No quiz data yet. Take your first quiz to unlock AI-powered recommendations!',
        },
      });
    }

    const analysis = await aiService.analyze({ topicMasteryRecords: masteryRecords });
    res.json({
      success: true,
      recommendations: {
        recommendedTopics: analysis.recommendedTopics,
        studyRecommendations: analysis.studyRecommendations,
        learningLevel: analysis.learningLevel,
        summary: analysis.summary,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/ai/explain ─────────────────────────────────────────────────────

const explainQuestion = async (req, res) => {
  try {
    const { questionId, selectedAnswer, isCorrect, confidenceLevel } = req.body;

    const question = await Question.findById(questionId);
    if (!question) return res.status(404).json({ success: false, message: 'Question not found' });

    const explanation = await aiService.explain({
      question,
      selectedAnswer: Number(selectedAnswer),
      isCorrect: Boolean(isCorrect),
      confidenceLevel: confidenceLevel || 'medium',
    });

    res.json({ success: true, explanation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/ai/practice/:userId ────────────────────────────────────────────

const getPracticeSet = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const masteryRecords = await TopicMastery.find({ userId });

    const weakTopics = masteryRecords.filter(r => r.status === 'weak').map(r => r.topic);
    const reviewTopics = masteryRecords.filter(r => r.status === 'intermediate').map(r => r.topic);

    // Get recent practice set question IDs to avoid repeats
    const recentSets = await PracticeSet.find({ userId }).sort({ createdAt: -1 }).limit(3);
    const recentQuestionIds = recentSets.flatMap(s => s.questions.map(q => q.toString()));

    const setData = await aiService.practice({
      weakTopics,
      reviewTopics,
      excludeQuestionIds: recentQuestionIds,
      totalQuestions: 10,
    });

    if (setData.questions.length === 0) {
      return res.json({
        success: true,
        hasQuestions: false,
        message: 'No questions found for your weak topics. Ask your admin to add more questions.',
      });
    }

    // Create and save practice set
    const practiceSet = await PracticeSet.create({
      userId,
      weakTopics: setData.actualWeakTopics,
      reviewTopics: setData.actualReviewTopics,
      questions: setData.questionIds,
      totalQuestions: setData.totalCount,
    });

    // Return questions (without correct answers for security)
    const questions = setData.questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options,
      difficulty: q.difficulty,
      topic: q.topic,
    }));

    res.json({
      success: true,
      hasQuestions: true,
      practiceSetId: practiceSet._id,
      questions,
      weakTopics: setData.actualWeakTopics,
      reviewTopics: setData.actualReviewTopics,
      totalCount: setData.totalCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/ai/practice/submit ────────────────────────────────────────────

const submitPracticeSet = async (req, res) => {
  try {
    const { practiceSetId, responses: reqResponses } = req.body;
    const userId = req.user._id;

    const practiceSet = await PracticeSet.findById(practiceSetId);
    if (!practiceSet) return res.status(404).json({ success: false, message: 'Practice set not found' });
    if (practiceSet.isCompleted) return res.status(400).json({ success: false, message: 'Already completed' });

    const questions = await Question.find({ _id: { $in: practiceSet.questions } });
    const questionMap = {};
    questions.forEach(q => { questionMap[q._id.toString()] = q; });

    let scoreCount = 0;
    let confidenceScore = 0;
    const responses = [];

    practiceSet.questions.forEach((qId, idx) => {
      const question = questionMap[qId.toString()];
      if (!question) return;

      const r = reqResponses?.[idx] || {};
      const selectedAnswer = r.answerIndex !== undefined ? Number(r.answerIndex) : -1;
      const confidenceLevel = r.confidenceLevel || 'medium';
      const timeTaken = r.timeTaken || 0;
      const isCorrect = question.correctAnswer === selectedAnswer;

      if (isCorrect) scoreCount++;

      const level = confidenceLevel.toLowerCase();
      if (isCorrect) {
        if (level === 'high') confidenceScore += 150;
        else if (level === 'medium') confidenceScore += 100;
        else confidenceScore += 80;
      } else {
        if (level === 'high') confidenceScore -= 50;
        else if (level === 'medium') confidenceScore -= 20;
      }

      responses.push({
        questionId: question._id,
        selectedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        confidenceLevel,
        timeTaken,
        topic: question.topic,
        difficulty: question.difficulty,
      });
    });

    const percentage = responses.length > 0 ? Math.round((scoreCount / responses.length) * 100) : 0;

    practiceSet.responses = responses;
    practiceSet.score = scoreCount;
    practiceSet.percentage = percentage;
    practiceSet.confidenceScore = confidenceScore;
    practiceSet.isCompleted = true;
    practiceSet.completedAt = new Date();
    await practiceSet.save();

    // Update topic mastery from practice set results
    await updateTopicMastery(userId, responses);

    res.json({
      success: true,
      isCompleted: true,
      score: scoreCount,
      totalQuestions: responses.length,
      percentage,
      confidenceScore,
      responses: responses.map((r, idx) => ({
        ...r,
        questionText: questionMap[r.questionId.toString()]?.questionText,
        options: questionMap[r.questionId.toString()]?.options,
        explanation: questionMap[r.questionId.toString()]?.explanation,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────

const sendChatMessage = async (req, res) => {
  try {
    const { message, sessionId: clientSessionId, context } = req.body;
    const userId = req.user._id;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const sessionId = clientSessionId || randomUUID();

    // Get user's weak topics for context
    const masteryRecords = await TopicMastery.find({ userId });
    const recentWrongTopics = masteryRecords
      .filter(r => r.status === 'weak')
      .map(r => r.topic);

    const latestAttempt = await Attempt.findOne({ user: userId, isCompleted: true })
      .sort({ createdAt: -1 })
      .populate('quiz');
    const learningLevel = masteryRecords.length > 0
      ? (masteryRecords.filter(r => r.status === 'mastered').length >= 3 ? 'advanced'
        : masteryRecords.filter(r => r.status === 'intermediate').length >= 2 ? 'intermediate' : 'beginner')
      : 'beginner';

    // Fetch last 10 messages of the current session before saving the new user message
    const prevMessages = await ChatMessage.find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();
    
    // Sort in chronological order
    prevMessages.reverse();

    // Build context for AI engine
    const aiContext = {
      topic: context?.topic || latestAttempt?.quiz?.topic || 'general',
      recentWrongTopics,
      learningLevel,
      adaptiveDifficultyLevel: latestAttempt?.currentDifficulty || 'medium',
      recentQuizResults: latestAttempt ? { percentage: latestAttempt.percentage } : null,
      history: prevMessages.map(m => ({
        role: m.role,
        content: m.content
      }))
    };

    // Save user message
    await ChatMessage.create({
      userId,
      sessionId,
      role: 'user',
      content: message.trim(),
      context: {
        questionId: context?.questionId || null,
        attemptId: context?.attemptId || null,
        topic: aiContext.topic,
      },
    });

    // Generate AI response
    const aiResponseText = await aiService.chat(message.trim(), aiContext);

    // Save AI response
    const aiMsg = await ChatMessage.create({
      userId,
      sessionId,
      role: 'assistant',
      content: aiResponseText,
      context: {
        topic: aiContext.topic,
      },
    });

    res.json({
      success: true,
      sessionId,
      response: {
        role: 'assistant',
        content: aiResponseText,
        timestamp: aiMsg.timestamp,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/ai/chat/:userId ─────────────────────────────────────────────────

const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionId } = req.query;

    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const filter = { userId };
    if (sessionId) filter.sessionId = sessionId;

    const messages = await ChatMessage.find(filter)
      .sort({ timestamp: 1 })
      .limit(100)
      .lean();

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/ai/streak/:userId ───────────────────────────────────────────────

const getStreak = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const user = await User.findById(userId).select('currentStreak longestStreak lastActiveDate name');

    // Generate AI-driven goals based on mastery
    const masteryRecords = await TopicMastery.find({ userId });
    const goals = [];

    const weakTopics = masteryRecords.filter(r => r.status === 'weak');
    const intermTopics = masteryRecords.filter(r => r.status === 'intermediate');

    if (weakTopics.length > 0) {
      goals.push({
        type: 'accuracy',
        icon: 'target',
        title: `Improve ${weakTopics[0].topic} accuracy above 60%`,
        current: weakTopics[0].accuracy,
        target: 60,
        progress: Math.min(100, Math.round((weakTopics[0].accuracy / 60) * 100)),
      });
    }

    if (intermTopics.length > 0) {
      goals.push({
        type: 'mastery',
        icon: 'star',
        title: `Master ${intermTopics[0].topic} (reach 85% accuracy)`,
        current: intermTopics[0].accuracy,
        target: 85,
        progress: Math.min(100, Math.round((intermTopics[0].accuracy / 85) * 100)),
      });
    }

    goals.push({
      type: 'streak',
      icon: 'streak',
      title: 'Complete 3 quizzes this week',
      current: Math.min(3, user?.currentStreak || 0),
      target: 3,
      progress: Math.min(100, Math.round(((user?.currentStreak || 0) / 3) * 100)),
    });

    res.json({
      success: true,
      streak: {
        current: user?.currentStreak || 0,
        longest: user?.longestStreak || 0,
        lastActive: user?.lastActiveDate || null,
      },
      goals,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/ai/admin-insights ───────────────────────────────────────────────

const getAdminAIInsights = async (req, res) => {
  try {
    // All topic mastery records across all users
    const allMastery = await TopicMastery.find().populate('userId', 'name').lean();

    // Heatmap: topic × user accuracy matrix
    const heatmapData = {};
    const userSet = new Set();

    allMastery.forEach(r => {
      const userName = r.userId?.name || 'Unknown';
      const topic = r.topic;
      userSet.add(userName);
      if (!heatmapData[topic]) heatmapData[topic] = {};
      heatmapData[topic][userName] = r.accuracy;
    });

    // Topic average accuracy (class-wide)
    const topicAverages = {};
    allMastery.forEach(r => {
      if (!topicAverages[r.topic]) topicAverages[r.topic] = { sum: 0, count: 0 };
      topicAverages[r.topic].sum += r.accuracy;
      topicAverages[r.topic].count++;
    });

    const classTopicPerformance = Object.entries(topicAverages).map(([topic, data]) => ({
      topic,
      avgAccuracy: Math.round(data.sum / data.count),
      studentCount: data.count,
    })).sort((a, b) => a.avgAccuracy - b.avgAccuracy);

    // At-risk students (avg accuracy < 50% across all topics)
    const userAccuracies = {};
    allMastery.forEach(r => {
      const uid = r.userId?._id?.toString();
      const name = r.userId?.name || 'Unknown';
      if (!uid) return;
      if (!userAccuracies[uid]) userAccuracies[uid] = { name, sum: 0, count: 0 };
      userAccuracies[uid].sum += r.accuracy;
      userAccuracies[uid].count++;
    });

    const atRiskStudents = Object.values(userAccuracies)
      .map(u => ({ name: u.name, avgAccuracy: Math.round(u.sum / u.count) }))
      .filter(u => u.avgAccuracy < 50)
      .sort((a, b) => a.avgAccuracy - b.avgAccuracy)
      .slice(0, 5);

    // Most difficult topics (lowest class average)
    const mostDifficult = [...classTopicPerformance].slice(0, 5);

    // Class average confidence
    const allConf = allMastery.map(r => r.confidenceAccuracy || 0);
    const classAvgConfidence = allConf.length > 0
      ? Math.round(allConf.reduce((a, b) => a + b, 0) / allConf.length)
      : 0;

    // Generate class summary
    const classSize = userSet.size;
    const worstTopic = mostDifficult[0]?.topic || 'N/A';
    const bestTopics = [...classTopicPerformance].reverse().slice(0, 2).map(t => t.topic);
    const classSummary = `Your class of ${classSize} student${classSize !== 1 ? 's' : ''} is performing best in `
      + `**${bestTopics.join(' and ')}**. The most challenging topic remains **${worstTopic}** `
      + `with a class average of ${mostDifficult[0]?.avgAccuracy || 0}%. `
      + `${atRiskStudents.length > 0 ? `${atRiskStudents.length} student(s) are at risk and need immediate attention.` : 'No students are currently flagged as at-risk.'}`;

    res.json({
      success: true,
      heatmap: {
        topics: Object.keys(heatmapData),
        users: [...userSet],
        data: heatmapData,
      },
      classTopicPerformance,
      mostDifficultTopics: mostDifficult,
      atRiskStudents,
      classAvgConfidence,
      classSummary,
      totalStudents: classSize,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  triggerPostQuizAI,
  updateTopicMastery,
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
};
