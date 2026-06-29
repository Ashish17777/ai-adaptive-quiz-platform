/**
 * Phase 9 — AI Insight Generator
 * Generates natural-language educational insights from analytics data.
 * Rule-based (no LLM required) — pattern matching on thresholds.
 */

/**
 * Generate insight cards from student analytics profile
 * @param {Object} profile - from analyticsEngine.getStudentAnalyticsProfile
 * @param {Object} behavior - from behaviorAnalyzer.analyzeBehavior
 * @returns {Array} insight cards [{type, title, message, priority}]
 */
function generateStudentInsights(profile, behavior) {
  const insights = [];

  const {
    overallAccuracy, confidenceAccuracy, learningVelocity,
    readinessScore, topicMastery, accuracyTrend,
  } = profile;

  // ── Performance Insights ─────────────────────────────────────────────
  if (overallAccuracy >= 85) {
    insights.push({ type: 'success', icon: 'trophy', priority: 1,
      title: 'Excellent Overall Performance',
      message: `Your average accuracy of ${overallAccuracy}% places you in the top tier. Keep challenging yourself with harder difficulty levels.`,
    });
  } else if (overallAccuracy < 50) {
    insights.push({ type: 'warning', icon: 'alert', priority: 1,
      title: 'Performance Needs Attention',
      message: `Your current accuracy of ${overallAccuracy}% suggests focused review sessions would help. Try the AI Tutor for personalized guidance.`,
    });
  }

  // ── Learning Velocity ────────────────────────────────────────────────
  if (learningVelocity >= 10) {
    insights.push({ type: 'success', icon: 'trending-up', priority: 2,
      title: 'Rapid Learning Detected',
      message: `Your score improved by ${learningVelocity} points across recent quizzes — you're in a strong improvement streak!`,
    });
  } else if (learningVelocity <= -8) {
    insights.push({ type: 'warning', icon: 'trending-down', priority: 2,
      title: 'Performance Decline Detected',
      message: `Scores have dropped by ${Math.abs(learningVelocity)} points recently. Consider revisiting topics where you previously struggled.`,
    });
  }

  // ── Confidence Calibration ───────────────────────────────────────────
  if (confidenceAccuracy >= 75) {
    insights.push({ type: 'info', icon: 'brain', priority: 3,
      title: 'Well-Calibrated Confidence',
      message: `Your confidence aligns with correctness ${confidenceAccuracy}% of the time — excellent self-assessment skills.`,
    });
  } else if (confidenceAccuracy < 45) {
    insights.push({ type: 'warning', icon: 'help-circle', priority: 2,
      title: 'Confidence Calibration Needed',
      message: `Your confidence ratings only match outcomes ${confidenceAccuracy}% of the time. Try to reflect more carefully before marking your confidence level.`,
    });
  }

  // ── Topic-Specific Insights ──────────────────────────────────────────
  if (topicMastery && topicMastery.length > 0) {
    const weakTopics = topicMastery.filter((t) => t.accuracy < 50);
    const strongTopics = topicMastery.filter((t) => t.accuracy >= 80);

    if (weakTopics.length > 0) {
      const weakNames = weakTopics.slice(0, 3).map((t) => t.topic).join(', ');
      insights.push({ type: 'warning', icon: 'target', priority: 2,
        title: 'Weak Topics Identified',
        message: `Students struggle with: ${weakNames}. Focused practice on these topics could significantly boost your overall score.`,
      });
    }

    if (strongTopics.length > 0) {
      const strongNames = strongTopics.slice(0, 2).map((t) => t.topic).join(', ');
      insights.push({ type: 'success', icon: 'star', priority: 3,
        title: 'Mastered Topics',
        message: `You've achieved mastery in: ${strongNames} (${strongTopics[0].accuracy}%+ accuracy). Consider sharing study tips with peers!`,
      });
    }
  }

  // ── Readiness ────────────────────────────────────────────────────────
  if (readinessScore >= 85) {
    insights.push({ type: 'success', icon: 'check-circle', priority: 1,
      title: 'Exam Ready',
      message: `Your readiness score of ${readinessScore}% indicates you're well prepared for upcoming assessments.`,
    });
  } else if (readinessScore < 40) {
    insights.push({ type: 'warning', icon: 'clock', priority: 1,
      title: 'More Practice Needed',
      message: `Your readiness score of ${readinessScore}% suggests more targeted practice is needed before high-stakes assessments.`,
    });
  }

  // ── Behavioral Insights ──────────────────────────────────────────────
  if (behavior) {
    if (behavior.studyStreak >= 7) {
      insights.push({ type: 'success', icon: 'flame', priority: 3,
        title: `${behavior.studyStreak}-Day Study Streak!`,
        message: 'Incredible consistency! A regular study habit is one of the strongest predictors of long-term academic success.',
      });
    }
    if (behavior.engagementScore < 25) {
      insights.push({ type: 'info', icon: 'activity', priority: 2,
        title: 'Low Engagement Detected',
        message: `Your engagement score is ${behavior.engagementScore}/100. Even 15 minutes of daily practice can significantly improve learning outcomes.`,
      });
    }
    if (behavior.confidenceTrend === 'increasing') {
      insights.push({ type: 'info', icon: 'trending-up', priority: 4,
        title: 'Confidence Growing',
        message: 'Your confidence in answers has been steadily increasing — a great sign of growing subject mastery.',
      });
    }
  }

  // Sort by priority (1 = highest) and return top 6
  return insights.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

/**
 * Generate class-level insights for admin
 */
function generateClassInsights(analytics) {
  const insights = [];
  const { topicPerformance, playerRankings, stats } = analytics;

  if (stats?.averageConfidence) {
    if (stats.averageConfidence < 40) {
      insights.push({ type: 'warning', icon: 'alert', priority: 1,
        title: 'Class-Wide Low Confidence',
        message: `Average class confidence is ${stats.averageConfidence}%. Consider introducing more scaffolded practice with explanations.`,
      });
    }
  }

  if (topicPerformance && topicPerformance.length > 0) {
    const sorted = [...topicPerformance].sort((a, b) => a.accuracy - b.accuracy);
    const hardest = sorted[0];
    const easiest = sorted[sorted.length - 1];

    if (hardest && hardest.accuracy < 50) {
      insights.push({ type: 'warning', icon: 'book', priority: 1,
        title: 'Class Struggles With ' + hardest.topic,
        message: `Only ${hardest.accuracy}% accuracy on "${hardest.topic}" — this topic needs additional instructional focus or remediation resources.`,
      });
    }
    if (easiest && easiest.accuracy > 85) {
      insights.push({ type: 'info', icon: 'star', priority: 3,
        title: 'Strong Performance in ' + easiest.topic,
        message: `The class is excelling in "${easiest.topic}" with ${easiest.accuracy}% accuracy. Consider advancing to more challenging content.`,
      });
    }
  }

  if (playerRankings && playerRankings.length > 0) {
    const top = playerRankings[0];
    const bottom = playerRankings[playerRankings.length - 1];
    if (top && bottom && top.accuracy - bottom.accuracy > 40) {
      insights.push({ type: 'info', icon: 'users', priority: 2,
        title: 'High Performance Spread',
        message: `There's a ${top.accuracy - bottom.accuracy}% accuracy gap between top and bottom students. Consider differentiated instruction or peer tutoring.`,
      });
    }
  }

  return insights.slice(0, 5);
}

module.exports = { generateStudentInsights, generateClassInsights };
