const Quiz = require('../models/quizModel');
const Question = require('../models/questionModel');
const { generateQuestions } = require('./questionGenerator');

/**
 * Shuffles options of generated questions so correct options are distributed
 * evenly across indices 0, 1, 2, 3 (corresponding to A, B, C, D: 25% target each).
 */
function balanceOptionPositions(questions) {
  const N = questions.length;
  const targetIndices = [];
  for (let i = 0; i < N; i++) {
    targetIndices.push(i % 4);
  }
  
  // Shuffle targetIndices to randomize correct option indices across questions
  for (let i = targetIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [targetIndices[i], targetIndices[j]] = [targetIndices[j], targetIndices[i]];
  }

  return questions.map((q, idx) => {
    const originalCorrectText = q.options[q.correctAnswer];
    const originalWrongTexts = q.options.filter((_, i) => i !== q.correctAnswer);

    // Shuffle wrong options randomly
    for (let i = originalWrongTexts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [originalWrongTexts[i], originalWrongTexts[j]] = [originalWrongTexts[j], originalWrongTexts[i]];
    }

    const targetCorrectIndex = targetIndices[idx];
    const newOptions = [];
    let wrongIdx = 0;
    
    for (let i = 0; i < 4; i++) {
      if (i === targetCorrectIndex) {
        newOptions.push(originalCorrectText);
      } else {
        newOptions.push(originalWrongTexts[wrongIdx++]);
      }
    }

    return {
      ...q,
      options: newOptions,
      correctAnswer: targetCorrectIndex
    };
  });
}

/**
 * Automatically generate questions and create a Quiz document in the database.
 */
async function generateCompleteQuiz({ title, topic, difficulty, numberOfQuestions = 5, userId }) {
  const count = Number(numberOfQuestions) || 5;
  const top = (topic || 'general').toLowerCase();
  const diff = (difficulty || 'medium').toLowerCase();

  // 1. Generate the questions via AI service
  let generatedQuestions = await generateQuestions({
    topic: top,
    difficulty: diff,
    numberOfQuestions: count,
    userId,
    action: 'quiz_generation'
  });

  // Pre-save validation checks
  if (!generatedQuestions || generatedQuestions.length === 0) {
    throw new Error('Failed to generate any valid questions for the specified topic.');
  }

  if (generatedQuestions.length !== count) {
    throw new Error(`AI generated quiz validation failed: Expected ${count} questions, but only ${generatedQuestions.length} were generated successfully.`);
  }

  for (let i = 0; i < generatedQuestions.length; i++) {
    const q = generatedQuestions[i];
    if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim() === '') {
      throw new Error(`AI generated quiz validation failed: Question ${i + 1} is missing text.`);
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`AI generated quiz validation failed: Question ${i + 1} must contain exactly 4 options.`);
    }
    if (q.options.some(opt => typeof opt !== 'string' || opt.trim() === '')) {
      throw new Error(`AI generated quiz validation failed: Question ${i + 1} contains empty or missing option text.`);
    }
    if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
      throw new Error(`AI generated quiz validation failed: Question ${i + 1} has an invalid correct answer index.`);
    }
    if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length < 30) {
      throw new Error(`AI generated quiz validation failed: Question ${i + 1} requires a descriptive explanation of at least 30 characters.`);
    }
    // Enforce consistency of topic and difficulty parameters
    q.topic = top;
    q.difficulty = diff;
  }

  // 2. Post-process options to balance answer choices evenly (A=25%, B=25%, C=25%, D=25%)
  generatedQuestions = balanceOptionPositions(generatedQuestions);

  // 3. Attach metadata and insert questions into Question Bank
  const questionsToSave = generatedQuestions.map(q => ({
    ...q,
    createdBy: userId,
    generatedByAI: true
  }));

  const savedQuestions = await Question.insertMany(questionsToSave);
  const questionIds = savedQuestions.map(q => q._id);

  // 4. Create and save the Quiz
  const quiz = await Quiz.create({
    title: title || `AI Generated Quiz: ${topic}`,
    description: `AI-generated assessment focusing on "${topic}" at "${difficulty}" difficulty.`,
    isAdaptive: true, // Generated quizzes enable adaptive difficulty pathways by default
    topic: top,
    questions: questionIds,
    createdBy: userId
  });

  return {
    quiz,
    questions: savedQuestions
  };
}

module.exports = { generateCompleteQuiz, balanceOptionPositions };
