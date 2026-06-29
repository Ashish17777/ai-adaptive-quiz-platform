/**
 * Phase 9 — Analytics Engine
 * Central aggregator for student performance, topic mastery, confidence, and learning velocity.
 */

const Attempt = require('../models/attemptModel');
const TopicMastery = require('../models/topicMasteryModel');
const StudentProfile = require('../models/studentProfileModel');
const Prediction = require('../models/predictionModel');

/**
 * Calculate confidence accuracy index across attempts
 * Returns a percentage (0-100) of how well confidence aligns with correctness
 */
function calcConfidenceAccuracy(attempts) {
  let total = 0, aligned = 0;
  attempts.forEach((a) => {
    (a.responses || []).forEach((r) => {
      total++;
      const confHigh = r.confidenceLevel === 'high';
      const confLow = r.confidenceLevel === 'low';
      if (r.isCorrect && confHigh) aligned++;
      else if (!r.isCorrect && confLow) aligned++;
    });
  });
  return total > 0 ? Math.round((aligned / total) * 100) : 0;
}

/**
 * Calculate learning velocity (score delta per quiz)
 */
function calcLearningVelocity(attempts) {
  if (attempts.length < 2) return 0;
  const sorted = [...attempts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const first = sorted.slice(0, Math.ceil(sorted.length / 2));
  const last = sorted.slice(Math.ceil(sorted.length / 2));
  const firstAvg = first.reduce((s, a) => s + a.percentage, 0) / first.length;
  const lastAvg = last.reduce((s, a) => s + a.percentage, 0) / last.length;
  return Math.round(lastAvg - firstAvg);
}

/**
 * Get accuracy trend (last 10 attempts)
 */
function getAccuracyTrend(attempts) {
  return [...attempts]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-10)
    .map((a, i) => ({
      quiz: i + 1,
      accuracy: a.percentage,
      confidence: Math.round(a.averageConfidence * 100),
      difficulty: a.currentDifficulty || 'medium',
      date: a.createdAt,
    }));
}

/**
 * Full student analytics profile
 */
async function getStudentAnalyticsProfile(userId) {
  const [attempts, topicMasteries, profile, prediction] = await Promise.all([
    Attempt.find({ user: userId, isCompleted: true })
      .populate('quiz', 'title topic isAdaptive')
      .sort({ createdAt: -1 })
      .limit(30),
    TopicMastery.find({ userId }),
    StudentProfile.findOne({ userId }),
    Prediction.findOne({ userId }),
  ]);

  const overallAccuracy = attempts.length > 0
    ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
    : 0;

  const avgConfidence = attempts.length > 0
    ? Math.round((attempts.reduce((s, a) => s + (a.averageConfidence || 0), 0) / attempts.length) * 100)
    : 0;

  const confidenceAccuracy = calcConfidenceAccuracy(attempts);
  const learningVelocity = calcLearningVelocity(attempts);
  const accuracyTrend = getAccuracyTrend(attempts);

  // Readiness score from profile or compute
  const readinessScore = profile?.examReadinessScore
    || Math.min(100, Math.round(overallAccuracy * 0.6 + confidenceAccuracy * 0.4));

  // Risk score (inverse of readiness weighted by trend)
  const riskScore = Math.max(0, 100 - readinessScore);

  // Topic mastery mapped
  const topicMasteryMap = topicMasteries.map((tm) => ({
    topic: tm.topic,
    accuracy: Math.round(tm.accuracy || 0),
    avgDifficulty: tm.avgDifficulty || 'medium',
    totalAttempts: tm.totalAttempts || 0,
    status:
      (tm.accuracy || 0) >= 75 ? 'Mastered'
      : (tm.accuracy || 0) >= 50 ? 'Developing'
      : 'Needs Work',
  }));

  return {
    overallAccuracy,
    avgConfidence,
    confidenceAccuracy,
    learningVelocity,
    readinessScore,
    riskScore,
    adaptiveScore: profile?.adaptiveScore || overallAccuracy,
    totalAttempts: attempts.length,
    topicMastery: topicMasteryMap,
    accuracyTrend,
    prediction: prediction
      ? {
          predictedScore: prediction.predictedScore,
          predictedDifficulty: prediction.predictedDifficultyLevel,
          readinessLevel: prediction.readinessLevel,
        }
      : null,
  };
}

module.exports = { getStudentAnalyticsProfile, calcLearningVelocity, calcConfidenceAccuracy };
