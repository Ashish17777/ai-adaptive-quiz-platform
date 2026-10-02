const { callGroq } = require('./groqClient');

/**
 * Generate a detailed correct answer key, step-by-step solution, concept explanation, and related topic tags.
 * Purely AI-powered — throws an error if AI service is unavailable.
 */
async function generateExplanationDetails(question) {
  const qText = question.questionText || '';
  const options = question.options || [];
  const correctIdx = question.correctAnswer ?? 0;
  const topic = question.topic || 'general';
  const difficulty = question.difficulty || 'medium';
  const explanation = question.explanation || '';

  const correctLetter = String.fromCharCode(65 + correctIdx);
  const correctText = options[correctIdx] || '';

  if (!process.env.GROQ_API_KEY) {
    throw new Error('AI Service Unavailable: API key is not configured. Please verify your environment settings.');
  }

  try {
    const prompt = `For this question:
            "${qText}"
            Options: A) ${options[0]} B) ${options[1]} C) ${options[2]} D) ${options[3]}
            Correct Answer index is ${correctIdx} (${correctLetter}: ${correctText}).
            Existing explanation: "${explanation}"

            Format your response ONLY as a JSON object matching this schema:
            {
              "correctAnswerKey": "Option letter and value",
              "stepByStepSolution": "Numbered list of steps to reach the answer",
              "conceptExplanation": "A summary of the theoretical concepts behind the topic",
              "relatedTopics": ["Related Topic 1", "Related Topic 2"]
            }`;

    const resText = await callGroq(prompt, { jsonOutput: true });
    const parsed = JSON.parse(resText);
    if (parsed.correctAnswerKey && parsed.stepByStepSolution) {
      return parsed;
    }
  } catch (e) {
    console.error('[AIService] Groq Explanation Gen failed. Error:', e.message);
    throw new Error('AI Service Unavailable: The explanation engine is temporarily unreachable. Please try again after some time.');
  }

  throw new Error('AI Service Unavailable: The explanation engine is temporarily unreachable. Please try again after some time.');
}

module.exports = { generateExplanationDetails };
