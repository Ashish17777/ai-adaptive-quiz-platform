const Prediction = require('../models/predictionModel');
const StudentProfile = require('../models/studentProfileModel');
const TopicMastery = require('../models/topicMasteryModel');
const Attempt = require('../models/attemptModel');

/**
 * Performance Prediction Engine
 * Computes performance predictions, topic readiness estimations, and readiness categories.
 * Designed with standard linear coefficients for scoring so that machine learning weights (e.g. from linear/logistic regression) can easily replace them.
 */

const DIFFICULTY_MAP = { easy: 1, medium: 2, hard: 3, expert: 4 };
const REVERSE_DIFFICULTY_MAP = { 1: 'easy', 2: 'medium', 3: 'hard', 4: 'expert' };

/**
 * Generate and save predictions for a specific user
 */
async function generatePredictions(userId) {
  try {
    const profile = await StudentProfile.findOne({ userId });
    const topicMasteries = await TopicMastery.find({ userId });
    const attempts = await Attempt.find({ user: userId, isCompleted: true }).sort({ createdAt: -1 }).limit(5);

    if (!profile) {
      // Fallback prediction if profile is not initialized
      return await Prediction.findOneAndUpdate(
        { userId },
        {
          userId,
          predictedScore: 50,
          predictedDifficultyLevel: 'medium',
          predictedTopicMastery: [],
          readinessLevel: 'beginner',
          createdAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    // 1. Calculate Predicted Score
    // Predicted score = baseline (mean score of recent attempts) + learning velocity adjustment + consistency weight
    const recentScoresSum = attempts.reduce((sum, a) => sum + a.percentage, 0);
    const recentScoresAvg = attempts.length > 0 ? (recentScoresSum / attempts.length) : 50;
    
    // Add velocity adjustment (velocity can be positive or negative)
    const velocityAdj = (profile.learningVelocity || 0) * 0.5;
    
    // Final predicted score is capped between 0 and 100
    const predictedScore = Math.max(0, Math.min(100, Math.round(recentScoresAvg + velocityAdj)));

    // 2. Calculate Predicted Difficulty Level
    // The highest difficulty where student maintains >= 60% accuracy
    let maxDiffVal = 1; // Default easy
    topicMasteries.forEach((tm) => {
      const acc = tm.accuracy || 0;
      if (acc >= 60) {
        const val = DIFFICULTY_MAP[tm.avgDifficulty] || 1;
        if (val > maxDiffVal) {
          maxDiffVal = val;
        }
      }
    });
    const predictedDifficultyLevel = REVERSE_DIFFICULTY_MAP[maxDiffVal] || 'medium';

    // 3. Compute Predicted Topic Masteries
    // Predict score for individual topics based on current accuracy + velocity delta
    const predictedTopicMastery = topicMasteries.map((tm) => {
      const currentAcc = tm.accuracy || 0;
      const expectedGrowth = (profile.learningVelocity || 0) * 0.25;
      return {
        topic: tm.topic,
        predictedScore: Math.max(0, Math.min(100, Math.round(currentAcc + expectedGrowth)))
      };
    });

    // 4. Determine Readiness Level
    const readinessScore = profile.examReadinessScore || 0;
    let readinessLevel = 'beginner';
    if (readinessScore >= 85) {
      readinessLevel = 'exam_ready';
    } else if (readinessScore >= 70) {
      readinessLevel = 'advanced';
    } else if (readinessScore >= 50) {
      readinessLevel = 'intermediate';
    }

    // 5. Update Prediction Document in DB
    const prediction = await Prediction.findOneAndUpdate(
      { userId },
      {
        userId,
        predictedScore,
        predictedDifficultyLevel,
        predictedTopicMastery,
        readinessLevel,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    return prediction;
  } catch (err) {
    console.error('[PredictionEngine] Generation failed:', err.message);
    return null;
  }
}

module.exports = {
  generatePredictions
};
