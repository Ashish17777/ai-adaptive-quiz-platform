/**
 * Phase 9 — Quiz Analyzer
 * Computes effectiveness metrics per quiz: completion rate, avg score,
 * difficulty balance, and learning impact.
 */

const Attempt = require('../models/attemptModel');
const Quiz = require('../models/quizModel');

/**
 * Analyze effectiveness of all quizzes
 */
async function analyzeQuizEffectiveness() {
  // Aggregate attempts by quiz
  const raw = await Attempt.aggregate([
    {
      $group: {
        _id: '$quiz',
        totalAttempts: { $sum: 1 },
        completedAttempts: { $sum: { $cond: ['$isCompleted', 1, 0] } },
        avgScore: { $avg: '$percentage' },
        avgConfidence: { $avg: '$averageConfidence' },
        scores: { $push: { score: '$percentage', date: '$createdAt', isCompleted: '$isCompleted' } },
        difficultyDistribution: {
          $push: '$currentDifficulty',
        },
      },
    },
    { $sort: { totalAttempts: -1 } },
  ]);

  if (!raw.length) return [];

  // Fetch quiz details
  const quizIds = raw.map((r) => r._id).filter(Boolean);
  const quizzes = await Quiz.find({ _id: { $in: quizIds } }).lean();
  const qMap = {};
  quizzes.forEach((q) => { qMap[String(q._id)] = q; });

  return raw.map((r) => {
    const quiz = qMap[String(r._id)];
    if (!quiz) return null;

    const completionRate = r.totalAttempts > 0
      ? Math.round((r.completedAttempts / r.totalAttempts) * 100)
      : 0;
    const avgScore = Math.round(r.avgScore || 0);
    const avgConf = Math.round((r.avgConfidence || 0) * 100);

    // Difficulty balance: how evenly spread is difficulty across attempts
    const diffMap = { easy: 0, medium: 0, hard: 0, expert: 0 };
    (r.difficultyDistribution || []).forEach((d) => { if (d) diffMap[d] = (diffMap[d] || 0) + 1; });
    const total = r.completedAttempts || 1;
    const diffBalance = Object.values(diffMap).map((v) => Math.round((v / total) * 100));
    const isBalanced = diffBalance.filter((v) => v > 10).length >= 2;

    // Learning impact: compare first-half vs second-half scores over time
    const sorted = (r.scores || []).filter((s) => s.isCompleted).sort((a, b) => new Date(a.date) - new Date(b.date));
    let learningImpact = 0;
    if (sorted.length >= 4) {
      const half = Math.ceil(sorted.length / 2);
      const early = sorted.slice(0, half);
      const late = sorted.slice(half);
      const earlyAvg = early.reduce((s, e) => s + (e.score || 0), 0) / early.length;
      const lateAvg = late.reduce((s, e) => s + (e.score || 0), 0) / late.length;
      learningImpact = Math.round(lateAvg - earlyAvg);
    }

    // Effectiveness score (0-100): weighted composite
    const effectivenessScore = Math.min(
      100,
      Math.round(completionRate * 0.3 + avgScore * 0.4 + (isBalanced ? 20 : 5) + Math.max(0, learningImpact) * 0.5)
    );

    // Effectiveness grade
    let grade = 'A';
    if (effectivenessScore < 40) grade = 'F';
    else if (effectivenessScore < 55) grade = 'D';
    else if (effectivenessScore < 70) grade = 'C';
    else if (effectivenessScore < 85) grade = 'B';

    return {
      quizId: r._id,
      title: quiz.title,
      topic: quiz.topic || 'General',
      isAdaptive: quiz.isAdaptive,
      totalAttempts: r.totalAttempts,
      completedAttempts: r.completedAttempts,
      completionRate,
      avgScore,
      avgConfidence: avgConf,
      learningImpact,
      effectivenessScore,
      grade,
      difficultyBalance: {
        easy: diffMap.easy,
        medium: diffMap.medium,
        hard: diffMap.hard,
        expert: diffMap.expert,
      },
    };
  }).filter(Boolean);
}

module.exports = { analyzeQuizEffectiveness };
