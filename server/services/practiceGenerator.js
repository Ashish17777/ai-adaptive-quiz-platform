const PracticeSet = require('../models/practiceSetModel');
const Question = require('../models/questionModel');
const { generateQuestions } = require('./questionGenerator');

/**
 * Generate a custom, mixed-difficulty practice set for a specific topic.
 * Ratios:
 *   - Beginner: 50% Easy, 40% Medium, 10% Hard
 *   - Intermediate (Default): 30% Easy, 40% Medium, 30% Hard
 *   - Advanced: 10% Easy, 30% Medium, 60% Hard
 */
async function generatePracticeQuiz({ userId, topic, numberOfQuestions = 15, studentLevel = 'intermediate' }) {
  const count = Number(numberOfQuestions) || 15;
  const top = (topic || 'general').toLowerCase();
  const level = (studentLevel || 'intermediate').toLowerCase();

  // 1. Determine difficulty mix ratios
  let easyPct = 0.3;
  let mediumPct = 0.4;
  let hardPct = 0.3;

  if (level === 'beginner') {
    easyPct = 0.5;
    mediumPct = 0.4;
    hardPct = 0.1;
  } else if (level === 'advanced') {
    easyPct = 0.1;
    mediumPct = 0.3;
    hardPct = 0.6;
  }

  const easyCount = Math.round(count * easyPct);
  const mediumCount = Math.round(count * mediumPct);
  const hardCount = count - easyCount - mediumCount;

  // 2. Generate questions for each difficulty tier
  const promises = [];
  if (easyCount > 0) {
    promises.push(generateQuestions({ topic: top, difficulty: 'easy', numberOfQuestions: easyCount }));
  }
  if (mediumCount > 0) {
    promises.push(generateQuestions({ topic: top, difficulty: 'medium', numberOfQuestions: mediumCount }));
  }
  if (hardCount > 0) {
    promises.push(generateQuestions({ topic: top, difficulty: 'hard', numberOfQuestions: hardCount }));
  }

  const results = await Promise.all(promises);
  const allGenerated = results.flat();

  if (allGenerated.length === 0) {
    throw new Error('Failed to generate practice questions.');
  }

  // 3. Save questions to the global database collection
  const questionsToSave = allGenerated.map(q => ({
    ...q,
    createdBy: userId,
    generatedByAI: true
  }));

  const savedQuestions = await Question.insertMany(questionsToSave);
  const questionIds = savedQuestions.map(q => q._id);

  // 4. Create and register the PracticeSet template
  const practiceSet = await PracticeSet.create({
    userId,
    weakTopics: [top],
    reviewTopics: [],
    questions: questionIds,
    totalQuestions: questionIds.length,
    isCompleted: false
  });

  return {
    practiceSetId: practiceSet._id,
    questions: savedQuestions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options,
      difficulty: q.difficulty,
      topic: q.topic
    })),
    totalCount: questionIds.length
  };
}

module.exports = { generatePracticeQuiz };
