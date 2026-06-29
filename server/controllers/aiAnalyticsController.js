const StudentProfile = require('../models/studentProfileModel');
const Recommendation = require('../models/recommendationModel');
const Prediction = require('../models/predictionModel');
const StudyPlan = require('../models/studyPlanModel');
const TopicMastery = require('../models/topicMasteryModel');
const Attempt = require('../models/attemptModel');
const User = require('../models/userModel');
const LearningMetric = require('../models/learningMetricModel');

// Import services to trigger on-demand generation
const { generateSmartRecommendations } = require('../services/recommendationEngine');
const { generatePredictions } = require('../services/predictionEngine');
const { generateStudyPlan } = require('../services/studyPlanGenerator');
const { updateStudentSkillProfile } = require('../services/skillAnalyzer');

/**
 * AI Analytics Controller
 * Handles student diagnostics and administrative cohort-level predictions.
 */

// Helper to verify user access
function verifyAccess(req, userId, res) {
  if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
    res.status(403).json({ success: false, message: 'Access denied. Unauthorized request.' });
    return false;
  }
  return true;
}

/**
 * GET /api/recommendations/:userId
 */
const getRecommendations = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!verifyAccess(req, userId, res)) return;

    let recs = await Recommendation.findOne({ userId });
    if (!recs) {
      recs = await generateSmartRecommendations(userId);
    }

    res.json({ success: true, recommendations: recs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/predictions/:userId
 */
const getPredictions = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!verifyAccess(req, userId, res)) return;

    let predictions = await Prediction.findOne({ userId });
    if (!predictions) {
      predictions = await generatePredictions(userId);
    }

    res.json({ success: true, predictions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/study-plan/:userId
 */
const getStudyPlan = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!verifyAccess(req, userId, res)) return;

    let studyPlan = await StudyPlan.findOne({ userId, active: true });
    if (!studyPlan) {
      studyPlan = await generateStudyPlan(userId);
    }

    res.json({ success: true, studyPlan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/readiness/:userId
 */
const getReadiness = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!verifyAccess(req, userId, res)) return;

    let profile = await StudentProfile.findOne({ userId });
    let prediction = await Prediction.findOne({ userId });

    // Fallback trigger if not created
    if (!profile) {
      const attempts = await Attempt.find({ user: userId, isCompleted: true }).sort({ createdAt: -1 });
      if (attempts.length > 0) {
        profile = await updateStudentSkillProfile(userId, attempts[0]._id);
      }
    }
    if (!prediction) {
      prediction = await generatePredictions(userId);
    }

    res.json({
      success: true,
      readinessScore: profile ? profile.examReadinessScore : 0,
      readinessLevel: prediction ? prediction.readinessLevel : 'beginner',
      strengths: profile ? profile.strengths : [],
      weaknesses: profile ? profile.weaknesses : [],
      confidenceScore: profile ? profile.confidenceScore : 0
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/skill-profile/:userId
 */
const getSkillProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!verifyAccess(req, userId, res)) return;

    let profile = await StudentProfile.findOne({ userId });
    let metrics = await LearningMetric.findOne({ userId });

    if (!profile) {
      const attempts = await Attempt.find({ user: userId, isCompleted: true }).sort({ createdAt: -1 });
      if (attempts.length > 0) {
        profile = await updateStudentSkillProfile(userId, attempts[0]._id);
        metrics = await LearningMetric.findOne({ userId });
      }
    }

    // Dynamic Notifications Reminders Generator
    const reminders = [];
    if (profile) {
      // 1. Weakness notifications
      if (profile.weaknesses && profile.weaknesses.length > 0) {
        reminders.push(`You haven't practiced ${profile.weaknesses[0].toUpperCase()} recently. Consider initiating a review.`);
      }
      // 2. Drop-off/Confidence alignment alerts
      if (metrics && metrics.confidenceImprovementRate < -5) {
        reminders.push(`Warning: Your confidence estimation index dropped by ${Math.abs(metrics.confidenceImprovementRate)}%. Review answers before submitting.`);
      }
      // 3. Expert pathway alerts
      if (profile.averageDifficulty === 'hard') {
        reminders.push("Excellent work! You are close to unlocking 'Expert' adaptive questions pathway.");
      }
    }
    if (reminders.length === 0) {
      reminders.push("Keep practicing to initialize dynamic AI notifications and learning path alerts!");
    }

    res.json({
      success: true,
      profile,
      metrics,
      reminders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/predictions/cohort
 * Retrieve cohort predictive analytics for admin dashboards
 */
const getCohortPredictions = async (req, res) => {
  try {
    // 1. Class Readiness
    const profiles = await StudentProfile.find();
    const predictions = await Prediction.find();
    const metrics = await LearningMetric.find();

    const totalStudents = await User.countDocuments({ role: 'student' });

    let readinessSum = 0;
    const levelsCount = { beginner: 0, intermediate: 0, advanced: 0, exam_ready: 0 };
    
    profiles.forEach(p => {
      readinessSum += p.examReadinessScore || 0;
    });
    predictions.forEach(pr => {
      const lvl = pr.readinessLevel || 'beginner';
      if (levelsCount[lvl] !== undefined) {
        levelsCount[lvl]++;
      }
    });

    const averageReadinessScore = profiles.length > 0 ? Math.round(readinessSum / profiles.length) : 50;

    // 2. Most Difficult Topics (aggregate average accuracy per topic from TopicMastery)
    const topicAgg = await TopicMastery.aggregate([
      {
        $group: {
          _id: '$topic',
          avgAccuracy: { $avg: '$accuracy' }
        }
      },
      { $sort: { avgAccuracy: 1 } },
      { $limit: 5 }
    ]);
    const mostDifficultTopics = topicAgg.map(t => ({
      topic: t._id,
      accuracy: Math.round(t.avgAccuracy)
    }));

    // 3. Drop-off Analysis (Difficulties with low accuracy)
    const difficultyAgg = await TopicMastery.aggregate([
      {
        $group: {
          _id: '$avgDifficulty',
          avgAccuracy: { $avg: '$accuracy' }
        }
      }
    ]);
    const difficultyDropoffs = difficultyAgg.map(d => ({
      difficulty: d._id,
      accuracy: Math.round(d.avgAccuracy)
    }));

    // 4. Learning Trends
    let velocitySum = 0;
    let consistencySum = 0;
    profiles.forEach(p => {
      velocitySum += p.learningVelocity || 0;
    });
    metrics.forEach(m => {
      consistencySum += m.consistencyScore || 0;
    });
    const averageCohortVelocity = profiles.length > 0 ? Math.round(velocitySum / profiles.length) : 0;
    const averageConsistency = metrics.length > 0 ? Math.round(consistencySum / metrics.length) : 0;

    // 5. Predicted Success Rates
    const passingCount = levelsCount.advanced + levelsCount.exam_ready;
    const predictedSuccessRate = totalStudents > 0 ? Math.round((passingCount / totalStudents) * 100) : 0;

    // 6. Top Improving Students (high learning velocity)
    const topImproversRaw = await StudentProfile.find()
      .populate('userId', 'name email')
      .sort({ learningVelocity: -1 })
      .limit(5)
      .lean();

    const topImprovingStudents = topImproversRaw.map(p => ({
      name: p.userId ? p.userId.name : 'Unknown Student',
      email: p.userId ? p.userId.email : '',
      learningVelocity: p.learningVelocity || 0,
      readinessScore: p.examReadinessScore || 0
    }));

    res.json({
      success: true,
      cohortSize: totalStudents,
      averageReadinessScore,
      levelsDistribution: levelsCount,
      mostDifficultTopics,
      difficultyDropoffs,
      trends: {
        averageCohortVelocity,
        averageConsistency
      },
      predictedSuccessRate,
      topImprovingStudents
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getRecommendations,
  getPredictions,
  getStudyPlan,
  getReadiness,
  getSkillProfile,
  getCohortPredictions
};
