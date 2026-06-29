const Recommendation = require('../models/recommendationModel');
const StudentProfile = require('../models/studentProfileModel');
const TopicMastery = require('../models/topicMasteryModel');
const Quiz = require('../models/quizModel');
const Attempt = require('../models/attemptModel');

/**
 * Enhanced Recommendation Engine
 * Recommends Quizzes, Practice Sets, Lessons, and Explanations based on performance history.
 * Easily links with collaborative filtering or content-based filtering ML models in the future.
 */

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'expert'];

function classifyTopic(accuracy) {
  if (accuracy >= 85) return 'mastered';
  if (accuracy >= 60) return 'intermediate';
  return 'weak';
}

function generateNarrative(strengths, weaknesses, recommendedTopics, learningLevel) {
  const strengthStr = strengths.length > 0
    ? `You have shown strong performance in: **${strengths.join(', ')}**.`
    : 'You are still building your foundational knowledge across topics.';

  const weakStr = weaknesses.length > 0
    ? `Areas that need focused practice: **${weaknesses.join(', ')}**.`
    : 'You are performing consistently well across all studied topics.';

  const recStr = recommendedTopics.length > 0
    ? `Your personalized next steps: ${recommendedTopics.map((t, i) => `${i + 1}. ${t}`).join(', ')}.`
    : 'Continue practising consistently to reinforce mastery.';

  const levelStr = {
    beginner: 'You are at the Beginner level — focus on building core fundamentals.',
    intermediate: 'You are at the Intermediate level — push into harder difficulty questions.',
    advanced: 'You are at the Advanced level — challenge yourself with expert-tier content.',
  }[learningLevel] || '';

  return `${strengthStr} ${weakStr} ${recStr} ${levelStr}`;
}

function analyzePerformance({ topicMasteryRecords = [], attempts = [] }) {
  const strengths = [];
  const weaknesses = [];
  const intermediateTopics = [];
  const topicBreakdown = [];

  let totalAccuracy = 0;
  let totalConfidenceAccuracy = 0;
  let count = 0;

  topicMasteryRecords.forEach((record) => {
    const acc = record.accuracy || 0;
    const confAcc = record.confidenceAccuracy || 0;
    totalAccuracy += acc;
    totalConfidenceAccuracy += confAcc;
    count++;

    const status = classifyTopic(acc);
    topicBreakdown.push({
      topic: record.topic,
      accuracy: acc,
      status,
      questionsCount: record.totalAnswered,
    });

    if (status === 'mastered') strengths.push(record.topic);
    else if (status === 'weak') weaknesses.push(record.topic);
    else intermediateTopics.push(record.topic);
  });

  const recommendedTopics = [
    ...weaknesses.slice(0, 3),
    ...intermediateTopics.slice(0, 2),
  ];

  const avgAccuracy = count > 0 ? Math.round(totalAccuracy / count) : 0;
  let learningLevel = 'beginner';
  if (avgAccuracy >= 80) learningLevel = 'advanced';
  else if (avgAccuracy >= 55) learningLevel = 'intermediate';

  const studyRecommendations = [];
  if (weaknesses.length > 0) {
    studyRecommendations.push(`Focus your next 3 sessions on: ${weaknesses.slice(0, 2).join(' and ')}.`);
  }
  if (intermediateTopics.length > 0) {
    studyRecommendations.push(`Practice harder difficulty questions in: ${intermediateTopics[0]}.`);
  }
  if (strengths.length > 0) {
    studyRecommendations.push(`Maintain mastery in ${strengths[0]} by taking an expert-level quiz.`);
  }
  if (studyRecommendations.length === 0) {
    studyRecommendations.push('Complete your first quiz to unlock personalized recommendations.');
  }

  const avgOverallAccuracy = count > 0 ? Math.round(totalAccuracy / count) : 0;
  const avgConfAccuracy = count > 0 ? Math.round(totalConfidenceAccuracy / count) : 0;

  return {
    strengths,
    weaknesses,
    recommendedTopics,
    learningLevel,
    studyRecommendations,
    topicBreakdown,
    summary: generateNarrative(strengths, weaknesses, recommendedTopics, learningLevel),
    stats: {
      avgAccuracy: avgOverallAccuracy,
      avgConfidenceAccuracy: avgConfAccuracy,
    },
  };
}

/**
 * Generate Smart Recommendations based on user data
 */
async function generateSmartRecommendations(userId) {
  try {
    const profile = await StudentProfile.findOne({ userId });
    const masteries = await TopicMastery.find({ userId });
    const quizzes = await Quiz.find();
    const attempts = await Attempt.find({ user: userId, isCompleted: true }).sort({ createdAt: -1 }).limit(3);

    // Map topic accuracy for lookup
    const topicAccMap = {};
    masteries.forEach(m => {
      topicAccMap[m.topic.toLowerCase()] = m.accuracy || 0;
    });

    // 1. Smart Quiz Recommendations with Estimated Success Probability
    const recommendedQuizzes = quizzes.map((quiz) => {
      const topic = (quiz.topic || 'general').toLowerCase();
      const topicAcc = topicAccMap[topic] !== undefined ? topicAccMap[topic] : 50; // default 50%
      
      // Calculate estimated success probability based on accuracy
      let probability = topicAcc / 100;

      // Adjust for difficulty level mismatches
      if (profile) {
        const studentDiffVal = DIFFICULTY_ORDER.indexOf(profile.averageDifficulty || 'medium');
        const quizDiffVal = DIFFICULTY_ORDER.indexOf(quiz.difficulty || 'medium');
        const diffDelta = quizDiffVal - studentDiffVal;
        
        if (diffDelta > 0) {
          probability -= (diffDelta * 0.15); // penalize if quiz is too hard
        } else if (diffDelta < 0) {
          probability += (Math.abs(diffDelta) * 0.05); // slight bonus if quiz is easy
        }

        // Adjust for learning velocity trends
        probability += (profile.learningVelocity || 0) * 0.005;
      }

      // Cap probability between 0.1 and 0.99
      probability = Math.max(0.1, Math.min(0.99, Number(probability.toFixed(2))));

      return {
        quizId: quiz._id,
        title: quiz.title,
        topic: quiz.topic || 'general',
        difficulty: quiz.difficulty || 'medium',
        estimatedSuccessProbability: probability
      };
    })
    // Sort quizzes by success probability to display optimal quizzes first (excluding extremely low success rate)
    .sort((a, b) => b.estimatedSuccessProbability - a.estimatedSuccessProbability)
    .slice(0, 4);

    // 2. Recommended Practice Sets (Weak topics)
    const recommendedPracticeSets = [];
    if (profile && profile.weaknesses && profile.weaknesses.length > 0) {
      profile.weaknesses.forEach(w => {
        recommendedPracticeSets.push({
          topic: w,
          reason: `Accuracy in ${w} is currently low. Dynamic practice recommended.`
        });
      });
    } else {
      recommendedPracticeSets.push({
        topic: 'general math',
        reason: 'Recommended core exercises to build daily practice habit.'
      });
    }

    // 3. Recommended Topics
    const recommendedTopics = [];
    if (profile && profile.weaknesses && profile.weaknesses.length > 0) {
      recommendedTopics.push({
        topic: profile.weaknesses[0],
        reason: 'Priority topic to study'
      });
    }
    masteries.forEach(m => {
      if (m.accuracy >= 60 && m.accuracy < 85) {
        recommendedTopics.push({
          topic: m.topic,
          reason: 'Improve intermediate skills'
        });
      }
    });

    // 4. Recommended Lessons (Topic Study Guides)
    const recommendedLessons = [];
    const targetTopics = recommendedTopics.map(t => t.topic);
    if (targetTopics.length > 0) {
      targetTopics.slice(0, 2).forEach(topic => {
        recommendedLessons.push({
          title: `Mastery Guide: ${topic.charAt(0).toUpperCase() + topic.slice(1)}`,
          content: `Step-by-step concepts, formulas, and visual diagram review files for ${topic}.`,
          url: `/lessons/${topic}`
        });
      });
    } else {
      recommendedLessons.push({
        title: 'Core Problem Solving Skills',
        content: 'Overview of SAT-aligned exam strategies, time management, and confidence estimation.',
        url: '/lessons/general'
      });
    }

    // 5. Recommended Explanations (From missed questions in recent attempts)
    const recommendedExplanations = [];
    attempts.forEach(att => {
      att.responses.forEach(r => {
        if (!r.isCorrect && recommendedExplanations.length < 3) {
          recommendedExplanations.push({
            questionText: `Question in ${r.topic}: Review the core steps and incorrect answers.`,
            explanation: `Review step-by-step breakdown to learn how to solve ${r.topic} challenges.`
          });
        }
      });
    });

    if (recommendedExplanations.length === 0) {
      recommendedExplanations.push({
        questionText: 'Double-check equations and formulas',
        explanation: 'Review explanation engines and tutor solutions to optimize question patterns.'
      });
    }

    const recDoc = await Recommendation.findOneAndUpdate(
      { userId },
      {
        userId,
        recommendedQuizzes,
        recommendedPracticeSets,
        recommendedTopics,
        recommendedLessons,
        recommendedExplanations,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    return recDoc;
  } catch (err) {
    console.error('[RecommendationEngine] Smart recommendations generation failed:', err.message);
    return null;
  }
}

module.exports = {
  analyzePerformance,
  classifyTopic,
  generateNarrative,
  generateSmartRecommendations
};
