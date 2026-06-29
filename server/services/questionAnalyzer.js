/**
 * Phase 9 — Question Analyzer
 * Computes quality metrics per question: correct rate, difficulty index,
 * discrimination index, average time taken, confidence distribution.
 */

const Attempt = require('../models/attemptModel');
const Question = require('../models/questionModel');

/**
 * Analyze all questions that have been attempted
 * Returns an array of per-question quality metrics
 */
async function analyzeQuestionQuality() {
  // Aggregate responses across all completed attempts grouped by questionId
  const raw = await Attempt.aggregate([
    { $match: { isCompleted: true } },
    { $unwind: '$responses' },
    {
      $group: {
        _id: '$responses.questionId',
        totalAttempts: { $sum: 1 },
        correctCount: { $sum: { $cond: ['$responses.isCorrect', 1, 0] } },
        totalTime: { $sum: '$responses.timeTaken' },
        confLow: {
          $sum: { $cond: [{ $eq: ['$responses.confidenceLevel', 'low'] }, 1, 0] },
        },
        confMedium: {
          $sum: { $cond: [{ $eq: ['$responses.confidenceLevel', 'medium'] }, 1, 0] },
        },
        confHigh: {
          $sum: { $cond: [{ $eq: ['$responses.confidenceLevel', 'high'] }, 1, 0] },
        },
        // Store details for discrimination and confidence accuracy calc
        scores: {
          $push: {
            isCorrect: '$responses.isCorrect',
            score: '$percentage',
            confidenceLevel: '$responses.confidenceLevel',
            timeTaken: '$responses.timeTaken'
          }
        },
      },
    },
    { $sort: { totalAttempts: -1 } },
  ]);

  if (!raw.length) return [];

  // Fetch question details
  const qIds = raw.map((r) => r._id).filter(Boolean);
  const questions = await Question.find({ _id: { $in: qIds } }).lean();
  const qMap = {};
  questions.forEach((q) => { qMap[String(q._id)] = q; });

  return raw.map((r) => {
    const q = qMap[String(r._id)];
    if (!q) return null;

    const correctRate = r.totalAttempts > 0 ? r.correctCount / r.totalAttempts : 0;
    const difficultyIndex = correctRate; // 0 = hard, 1 = easy

    // Discrimination index: correct rate among top-50% scorers vs bottom-50% scorers
    const sorted = (r.scores || []).sort((a, b) => (b.score || 0) - (a.score || 0));
    const half = Math.ceil(sorted.length / 2);
    const topHalf = sorted.slice(0, half);
    const botHalf = sorted.slice(half);
    const topCorrect = topHalf.filter((s) => s.isCorrect).length / (topHalf.length || 1);
    const botCorrect = botHalf.filter((s) => s.isCorrect).length / (botHalf.length || 1);
    const discriminationIndex = topCorrect - botCorrect;

    const avgTimeTaken = r.totalAttempts > 0 ? Math.round(r.totalTime / r.totalAttempts) : 0;

    // Calculate Confidence Accuracy: correct + high/medium OR incorrect + low
    let correctAndConfident = 0;
    let incorrectAndUnconfident = 0;
    (r.scores || []).forEach(s => {
      const level = (s.confidenceLevel || 'medium').toLowerCase();
      if (s.isCorrect && (level === 'high' || level === 'medium')) {
        correctAndConfident++;
      } else if (!s.isCorrect && level === 'low') {
        incorrectAndUnconfident++;
      }
    });
    const confidenceAccuracy = r.totalAttempts > 0
      ? (correctAndConfident + incorrectAndUnconfident) / r.totalAttempts
      : 0;

    // Calculate overall confidence score (0 - 100)
    const confidenceScore = r.totalAttempts > 0
      ? Math.round(((r.confHigh * 3 + r.confMedium * 2 + r.confLow) / (r.totalAttempts * 3)) * 100)
      : 0;

    // Quality flags
    let flag = null;
    if (correctRate > 0.85) flag = 'Too Easy';
    else if (correctRate < 0.2) flag = 'Too Hard';
    else if (discriminationIndex < 0.2 && r.totalAttempts >= 5) flag = 'Poor Quality';

    return {
      questionId: r._id,
      questionText: q.questionText,
      topic: q.topic,
      difficulty: q.difficulty,
      totalAttempts: r.totalAttempts,
      correctCount: r.correctCount,
      correctRate: Math.round(correctRate * 100),
      difficultyIndex: Math.round(difficultyIndex * 100),
      discriminationIndex: Math.round(discriminationIndex * 100),
      avgTimeTaken,
      confidenceScore,
      confidenceDistribution: {
        low: r.confLow,
        medium: r.confMedium,
        high: r.confHigh,
      },
      flag,
    };
  }).filter(Boolean);
}

/**
 * Get summary statistics for question quality
 */
async function getQuestionQualitySummary(metrics) {
  const total = metrics.length;
  const tooEasy = metrics.filter((m) => m.flag === 'Too Easy').length;
  const tooHard = metrics.filter((m) => m.flag === 'Too Hard').length;
  const poorQuality = metrics.filter((m) => m.flag === 'Poor Quality').length;
  const avgDiscrimination = total > 0
    ? Math.round(metrics.reduce((s, m) => s + m.discriminationIndex, 0) / total)
    : 0;
  const avgCorrectRate = total > 0
    ? Math.round(metrics.reduce((s, m) => s + m.correctRate, 0) / total)
    : 0;

  return { total, tooEasy, tooHard, poorQuality, avgDiscrimination, avgCorrectRate };
}

module.exports = { analyzeQuestionQuality, getQuestionQualitySummary };
