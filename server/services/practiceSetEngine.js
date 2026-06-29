/**
 * Practice Set Engine
 * Generates personalized 10-question practice sets:
 * 70% weak-topic questions, 30% intermediate/review questions.
 */

const Question = require('../models/questionModel');

/**
 * Generate a personalized practice question set for a user.
 * @param {Object} params
 * @param {Array} params.weakTopics - Topics where accuracy < 60%
 * @param {Array} params.reviewTopics - Topics where accuracy 60-85% (intermediate)
 * @param {Array} params.excludeQuestionIds - Already-seen question IDs to avoid repeats
 * @param {number} params.totalQuestions - Target question count (default 10)
 * @returns {Object} { questions, weakTopics, reviewTopics }
 */
async function generatePracticeSet({
  weakTopics = [],
  reviewTopics = [],
  excludeQuestionIds = [],
  totalQuestions = 10,
}) {
  const weakCount = Math.round(totalQuestions * 0.7); // 70% weak
  const reviewCount = totalQuestions - weakCount;       // 30% review

  const excludeIds = excludeQuestionIds.map(id => id.toString());
  const selectedQuestions = [];
  const usedIds = new Set(excludeIds);

  /**
   * Fetch questions for a given set of topics, avoiding duplicates.
   */
  const fetchQuestions = async (topics, count) => {
    if (!topics || topics.length === 0 || count <= 0) return [];

    const questions = await Question.find({
      topic: { $in: topics },
      _id: { $nin: [...usedIds] },
    }).limit(count * 3); // Fetch extra for randomization

    // Shuffle and pick `count`
    const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, count);
    shuffled.forEach(q => usedIds.add(q._id.toString()));
    return shuffled;
  };

  // 1. Fetch weak-topic questions
  if (weakTopics.length > 0) {
    const weakQs = await fetchQuestions(weakTopics, weakCount);
    selectedQuestions.push(...weakQs);
  }

  // 2. Fill remaining slots with review/intermediate questions
  const remaining = totalQuestions - selectedQuestions.length;
  if (remaining > 0 && reviewTopics.length > 0) {
    const reviewQs = await fetchQuestions(reviewTopics, remaining);
    selectedQuestions.push(...reviewQs);
  }

  // 3. If still not enough, pull from any topic
  const finalRemaining = totalQuestions - selectedQuestions.length;
  if (finalRemaining > 0) {
    const fallbackQs = await Question.find({
      _id: { $nin: [...usedIds] },
    }).limit(finalRemaining);
    selectedQuestions.push(...fallbackQs);
  }

  // Final shuffle of the full set
  const finalSet = selectedQuestions.sort(() => Math.random() - 0.5);

  return {
    questions: finalSet,
    questionIds: finalSet.map(q => q._id),
    actualWeakTopics: weakTopics,
    actualReviewTopics: reviewTopics,
    totalCount: finalSet.length,
  };
}

module.exports = { generatePracticeSet };
