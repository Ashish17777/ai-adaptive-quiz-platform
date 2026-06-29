const StudentProfile = require('../models/studentProfileModel');
const TopicMastery = require('../models/topicMasteryModel');
const Attempt = require('../models/attemptModel');
const LearningMetric = require('../models/learningMetricModel');
const { trackTopicMastery, calculateConsistencyScore } = require('./masteryTracker');

/**
 * Skill Analyzer Engine
 * Core service analyzing student attempt patterns, strengths, weaknesses, and learning velocities.
 * Exposes a plug-and-play architecture where advanced classification models (e.g., SVM, logistic regression) can be loaded.
 */

const DIFFICULTY_VALUES = { easy: 1, medium: 2, hard: 3, expert: 4 };
const DIFFICULTY_LABELS = { 1: 'easy', 2: 'medium', 3: 'hard', 4: 'expert' };

/**
 * Processes latest attempt and updates student profile, mastery history logs, and rates.
 */
async function updateStudentSkillProfile(userId, attemptId) {
  try {
    const attempt = await Attempt.findById(attemptId).populate('quiz');
    if (!attempt || !attempt.isCompleted) return null;

    // 1. Gather all TopicMastery records
    const topicMasteryRecords = await TopicMastery.find({ userId });
    
    // 2. Identify Strengths, Weaknesses and construct Mastery Map
    const topicMastery = new Map();
    const strengths = [];
    const weaknesses = [];

    topicMasteryRecords.forEach((tm) => {
      const topic = tm.topic.toLowerCase();
      const accuracy = tm.accuracy || 0;
      topicMastery.set(topic, accuracy);

      if (accuracy >= 85) strengths.push(topic);
      else if (accuracy < 60) weaknesses.push(topic);
      
      // Push event log node to MasteryTracking history
      trackTopicMastery(
        userId,
        topic,
        accuracy,
        tm.avgDifficulty || 'medium',
        tm.confidenceAccuracy || 0
      );
    });

    // 3. Compute overall average difficulty
    let diffSum = 0;
    let diffCount = 0;
    topicMasteryRecords.forEach((tm) => {
      const diffVal = DIFFICULTY_VALUES[tm.avgDifficulty] || 2;
      diffSum += diffVal;
      diffCount++;
    });
    const avgDiffNum = diffCount > 0 ? Math.round(diffSum / diffCount) : 2;
    const averageDifficulty = DIFFICULTY_LABELS[avgDiffNum] || 'medium';

    // 4. Calculate Learning Velocity
    // Learning velocity represents the average increase in percentage points per attempt
    const recentAttempts = await Attempt.find({ user: userId, isCompleted: true })
      .sort({ createdAt: -1 })
      .limit(6);

    let learningVelocity = 0;
    if (recentAttempts.length > 1) {
      const ordered = [...recentAttempts].reverse();
      let totalDelta = 0;
      for (let i = 1; i < ordered.length; i++) {
        totalDelta += (ordered[i].percentage - ordered[i - 1].percentage);
      }
      learningVelocity = Math.round(totalDelta / (ordered.length - 1));
    }

    // 5. Update consistency & metric rates
    const consistencyScore = await calculateConsistencyScore(userId);

    // Calculate metric improvement rates (comparing last half vs first half of attempts)
    let improvementRate = 0;
    let confidenceImprovementRate = 0;
    const allAttempts = await Attempt.find({ user: userId, isCompleted: true }).sort({ createdAt: -1 });
    
    if (allAttempts.length >= 2) {
      const mid = Math.ceil(allAttempts.length / 2);
      const recentHalf = allAttempts.slice(0, mid);
      const olderHalf = allAttempts.slice(mid);

      const recentAcc = recentHalf.reduce((s, a) => s + a.percentage, 0) / recentHalf.length;
      const olderAcc = olderHalf.reduce((s, a) => s + a.percentage, 0) / olderHalf.length;
      improvementRate = Math.round(recentAcc - olderAcc);

      const recentConf = recentHalf.reduce((s, a) => s + a.confidenceAccuracyIndex, 0) / recentHalf.length;
      const olderConf = olderHalf.reduce((s, a) => s + a.confidenceAccuracyIndex, 0) / olderHalf.length;
      confidenceImprovementRate = Math.round(recentConf - olderConf);
    }

    // Upsert LearningMetric document
    await LearningMetric.findOneAndUpdate(
      { userId },
      {
        $set: {
          improvementRate,
          topicGrowthRate: strengths.length * 10, // heuristic representation
          difficultyAdvancementRate: avgDiffNum * 15,
          confidenceImprovementRate,
          consistencyScore
        },
        $push: {
          velocityHistory: {
            timestamp: new Date(),
            velocity: learningVelocity
          }
        }
      },
      { upsert: true, new: true }
    );

    // 6. Calculate provisional Exam Readiness Score
    // Readiness incorporates: Accuracy, Confidence, Mastery, Adaptive Difficulty, Practice Consistency
    const avgAccuracy = recentAttempts.length > 0 
      ? recentAttempts.reduce((sum, a) => sum + a.percentage, 0) / recentAttempts.length 
      : 0;
    const avgConfIndex = recentAttempts.length > 0 
      ? recentAttempts.reduce((sum, a) => sum + a.confidenceAccuracyIndex, 0) / recentAttempts.length 
      : 0;

    const diffWeight = avgDiffNum * 15; // Max 60
    const accuracyWeight = avgAccuracy * 0.4; // Max 40
    const confidenceWeight = avgConfIndex * 0.2; // Max 20
    const consistencyWeight = consistencyScore * 0.1; // Max 10
    
    // Capped readiness score
    const examReadinessScore = Math.min(
      Math.round(accuracyWeight + confidenceWeight + diffWeight + consistencyWeight),
      100
    );

    // 7. Update and return Student Profile
    const profile = await StudentProfile.findOneAndUpdate(
      { userId },
      {
        userId,
        topicMastery,
        confidenceScore: Math.round(avgConfIndex),
        adaptiveScore: recentAttempts.length > 0 ? recentAttempts[0].confidenceScore : 0,
        averageDifficulty,
        learningVelocity,
        strengths,
        weaknesses,
        examReadinessScore,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );

    return profile;
  } catch (err) {
    console.error('[SkillAnalyzer] Failed to update student skill profile:', err.message);
    return null;
  }
}

module.exports = {
  updateStudentSkillProfile
};
