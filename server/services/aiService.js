/**
 * AI Service Orchestrator
 * Purely AI-powered using Groq (OpenAI GPT-OSS-120B).
 * All rule-based fallbacks have been removed — errors are thrown cleanly if AI is unavailable.
 */

const { callGroq } = require('./groqClient');
const { analyzePerformance } = require('./recommendationEngine');
const { buildLearningPath } = require('./learningPathEngine');
const { generatePracticeSet } = require('./practiceSetEngine');

/**
 * Analyze a student's performance and return strengths/weaknesses/recommendations.
 */
async function analyze(params) {
  return analyzePerformance(params);
}

/**
 * Build or update a student's personalized learning path.
 */
async function buildPath(topicMasteryRecords, allTopicsInBank) {
  return buildLearningPath(topicMasteryRecords, allTopicsInBank);
}

/**
 * Generate explanation for a specific question response using Gemini AI.
 * Throws an error if the AI service is unavailable (no rule-based fallback).
 */
async function explain(params) {
  const { question, selectedAnswer, isCorrect, confidenceLevel } = params;

  if (!process.env.GROQ_API_KEY) {
    throw new Error('AI Service Unavailable: API key is not configured. Please verify your environment settings.');
  }

  try {
    const prompt = `You are an expert tutor. Please explain why the selected answer is correct or incorrect for this question.
Question: "${question.questionText}"
Options:
${(question.options || []).map((opt, idx) => `${idx}) ${opt}`).join('\n')}

Selected Answer Index: ${selectedAnswer} (Option Text: "${(question.options || [])[selectedAnswer] || 'None'}")
Is Correct: ${isCorrect}
Confidence Level: ${confidenceLevel}

Return a structured explanation. It must contain:
1. "explanation": A detailed, step-by-step reasoning breakdown (minimum 40 characters).
2. "whyWrong": If the answer is incorrect, explain why the selected option was incorrect. Otherwise, write "None".
3. "relatedConcepts": An array of 2-3 related topics.
4. "confidenceFeedback": Helpful feedback regarding the student's confidence alignment.
5. "studyHint": A difficulty-specific study tip.

Return your response ONLY as a JSON object matching this schema:
{
  "explanation": "...",
  "whyWrong": "...",
  "relatedConcepts": ["...", "..."],
  "confidenceFeedback": "...",
  "studyHint": "..."
}
`;

    const response = await callGroq(prompt, { jsonOutput: true });
    const parsed = JSON.parse(response);
    if (parsed.explanation) {
      return {
        questionText: question.questionText,
        selectedOption: (question.options || [])[selectedAnswer] || 'None',
        correctOption: (question.options || [])[question.correctAnswer],
        isCorrect,
        explanation: parsed.explanation,
        whyWrong: parsed.whyWrong !== 'None' ? parsed.whyWrong : null,
        relatedConcepts: parsed.relatedConcepts || [question.topic],
        confidenceFeedback: parsed.confidenceFeedback,
        studyHint: parsed.studyHint,
        topic: question.topic,
        difficulty: question.difficulty
      };
    }
  } catch (e) {
    console.error('[AIService] Groq Explanation failed. Error:', e.message);
    throw new Error('AI Service Unavailable: The explanation service is temporarily unreachable. Please try again after some time.');
  }

  throw new Error('AI Service Unavailable: The explanation service is temporarily unreachable. Please try again after some time.');
}

/**
 * Generate AI tutor chat response using Gemini AI.
 * Throws an error if the AI service is unavailable (no rule-based fallback).
 */
async function chat(message, context = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('AI Service Unavailable: API key is not configured. Please verify your environment settings.');
  }

  try {
    const historyPrompt = (context.history || [])
      .map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.content}`)
      .join('\n');
    
    const prompt = `You are a helpful, personalized AI Study Tutor for a student in our adaptive quiz platform.
Student Profile:
- Current Skill Level: ${context.learningLevel || 'intermediate'}
- Weak Topics: ${context.recentWrongTopics ? context.recentWrongTopics.join(', ') : 'None'}
- Adaptive Difficulty Level: ${context.adaptiveDifficultyLevel || 'medium'}
- Recent Quiz Performance: ${context.recentQuizResults ? `${context.recentQuizResults.percentage}% score` : 'No recent score'}

Topic of Conversation: ${context.topic || 'General'}

Instructions:
- Identify the user's intent:
  * "Explain": Provide a personalized, clear definition and explanation of the topic.
  * "Example": Provide a concrete, step-by-step example problem with its solution.
  * "Practice Question": Present a practice question on the topic, but do not show the answer immediately (prompt them to solve it).
  * "Hint": Provide a helpful clue or tip to solve a problem.
  * "Step-by-Step Solution": Provide a detailed, step-by-step solution breakdown of a problem.
- Personalize based on the student's skill level:
  * "beginner": Keep explanations extremely clear, use simple concepts, friendly tone, and intuitive analogies. Avoid complex formulas.
  * "advanced": Provide detailed, rigorous mathematical/technical breakdowns, advanced examples, and challenging questions.
- Address weak topics and use student performance data to tailor the feedback.
- Strictly avoid repeating responses or explanations that already exist in the chat history. Provide unique, context-aware information.

Chat History:
${historyPrompt || 'None'}

Student's new message: "${message}"

Tutor response:`;

    const resText = await callGroq(prompt);
    if (resText) return resText.trim();
  } catch (e) {
    console.error('[AIService] Groq Chat failed. Error:', e.message);
    throw new Error('AI Service Unavailable: The AI tutor is temporarily unreachable. Please try again after some time.');
  }

  throw new Error('AI Service Unavailable: The AI tutor is temporarily unreachable. Please try again after some time.');
}

/**
 * Generate personalized practice set.
 */
async function practice(params) {
  return generatePracticeSet(params);
}

module.exports = { analyze, buildPath, explain, chat, practice };
