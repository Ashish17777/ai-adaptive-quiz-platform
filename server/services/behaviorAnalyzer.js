/**
 * Phase 9 — Behavior Analyzer
 * Analyzes student behavioral patterns: quiz frequency, study time, engagement score,
 * topic preferences, and confidence trends.
 */

const Attempt = require('../models/attemptModel');

/**
 * Analyze behavioral profile for a single student
 */
async function analyzeBehavior(userId) {
  const attempts = await Attempt.find({ user: userId, isCompleted: true })
    .populate('quiz', 'title topic')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  if (!attempts.length) {
    return {
      quizFrequency: 0,
      avgSessionLength: 0,
      engagementScore: 0,
      preferredTopics: [],
      confidenceTrend: 'stable',
      studyStreak: 0,
      activeHours: [],
      behaviorProfile: 'Inactive',
    };
  }

  // ── Quiz Frequency (quizzes per week over last 30 days) ──────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentAttempts = attempts.filter((a) => new Date(a.createdAt) >= thirtyDaysAgo);
  const quizFrequency = parseFloat((recentAttempts.length / 4.3).toFixed(1)); // avg per week

  // ── Avg Session Length (seconds per quiz, capped at 30 min) ─────────
  const avgSessionLength = recentAttempts.length > 0
    ? Math.round(
        recentAttempts.reduce((s, a) => {
          const totalTime = (a.responses || []).reduce((t, r) => t + (r.timeTaken || 0), 0);
          return s + Math.min(totalTime, 1800);
        }, 0) / recentAttempts.length
      )
    : 0;

  // ── Engagement Score (0-100): active days / 30 * 100 + frequency bonus ──
  const uniqueDays = new Set(
    recentAttempts.map((a) => new Date(a.createdAt).toDateString())
  ).size;
  const engagementScore = Math.min(100, Math.round((uniqueDays / 30) * 70 + quizFrequency * 3));

  // ── Topic Preferences ────────────────────────────────────────────────
  const topicCounts = {};
  attempts.forEach((a) => {
    const topic = a.quiz?.topic || 'General';
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  });
  const preferredTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));

  // ── Confidence Trend ─────────────────────────────────────────────────
  const sorted10 = [...attempts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-10);
  let confidenceTrend = 'stable';
  if (sorted10.length >= 4) {
    const half = Math.ceil(sorted10.length / 2);
    const earlyConf = sorted10.slice(0, half).reduce((s, a) => s + (a.averageConfidence || 0), 0) / half;
    const lateConf = sorted10.slice(half).reduce((s, a) => s + (a.averageConfidence || 0), 0) / (sorted10.length - half);
    if (lateConf - earlyConf > 0.1) confidenceTrend = 'increasing';
    else if (earlyConf - lateConf > 0.1) confidenceTrend = 'decreasing';
  }

  // ── Study Streak (consecutive days) ─────────────────────────────────
  const attemptDays = [...new Set(
    attempts.map((a) => new Date(a.createdAt).toDateString())
  )].map((d) => new Date(d)).sort((a, b) => b - a);

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const day of attemptDays) {
    const diff = Math.round((cursor - day) / (1000 * 60 * 60 * 24));
    if (diff <= 1) { streak++; cursor = day; }
    else break;
  }

  // ── Active Hours (hour distribution) ─────────────────────────────────
  const hourCounts = new Array(24).fill(0);
  attempts.forEach((a) => { hourCounts[new Date(a.createdAt).getHours()]++; });
  const activeHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // ── Behavioral Profile ───────────────────────────────────────────────
  let behaviorProfile = 'Casual Learner';
  if (engagementScore >= 75 && quizFrequency >= 5) behaviorProfile = 'Dedicated Student';
  else if (engagementScore >= 50 && streak >= 5) behaviorProfile = 'Consistent Practitioner';
  else if (quizFrequency < 1) behaviorProfile = 'Occasional Visitor';
  else if (engagementScore < 25) behaviorProfile = 'Disengaged';

  return {
    quizFrequency,
    avgSessionLength,
    engagementScore,
    preferredTopics,
    confidenceTrend,
    studyStreak: streak,
    activeHours,
    behaviorProfile,
    totalAttempts: attempts.length,
    recentAttempts: recentAttempts.length,
    uniqueDaysActive: uniqueDays,
  };
}

module.exports = { analyzeBehavior };
