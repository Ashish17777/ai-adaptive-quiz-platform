const MasteryTracking = require('../models/masteryTrackingModel');
const LearningMetric = require('../models/learningMetricModel');
const Attempt = require('../models/attemptModel');

/**
 * Mastery Tracker Service
 * Handles historical logs for student analytics and calculates practice consistency ratings.
 * Designed to be modular so machine learning feature pipelines can ingest this historical timeline.
 */

/**
 * Log a single topic mastery event
 */
async function trackTopicMastery(userId, topic, accuracy, difficulty, confidence) {
  try {
    const timestamp = new Date();
    
    // Find or create the tracking record for this user + topic
    await MasteryTracking.findOneAndUpdate(
      { userId, topic: topic.toLowerCase() },
      {
        $push: {
          accuracyHistory: { timestamp, accuracy },
          difficultyHistory: { timestamp, difficulty },
          confidenceHistory: { timestamp, confidence }
        }
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('[MasteryTracker] Failed to log mastery event:', err.message);
  }
}

/**
 * Calculate study consistency score (0 - 100)
 * Evaluates active practice days over the last 14 days.
 */
async function calculateConsistencyScore(userId) {
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Get all completed attempts by user in the last 14 days
    const recentAttempts = await Attempt.find({
      user: userId,
      isCompleted: true,
      createdAt: { $gte: twoWeeksAgo }
    }).select('createdAt');

    if (recentAttempts.length === 0) return 0;

    // Identify unique active days
    const uniqueDays = new Set(
      recentAttempts.map(att => new Date(att.createdAt).toDateString())
    );

    // Score: 100 if practiced on 7+ unique days in past 2 weeks, otherwise proportional
    const activeDaysCount = uniqueDays.size;
    const consistencyScore = Math.min(Math.round((activeDaysCount / 7) * 100), 100);

    return consistencyScore;
  } catch (err) {
    console.error('[MasteryTracker] Consistency calculation failed:', err.message);
    return 0;
  }
}

module.exports = {
  trackTopicMastery,
  calculateConsistencyScore
};
