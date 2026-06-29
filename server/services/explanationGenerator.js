const axios = require('axios');

/**
 * Generate a detailed correct answer key, step-by-step solution, concept explanation, and related topic tags.
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

  // 1. LLM Mode: Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{
              text: `For this question:
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
              }`
            }]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }
      );

      const resText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(resText);
      if (parsed.correctAnswerKey && parsed.stepByStepSolution) {
        return parsed;
      }
    } catch (e) {
      console.warn('[AIService] Gemini Explanation Gen failed. Falling back. Error:', e.message);
    }
  }

  // 2. Fallback: Intelligent Rule-Based Solution Compiler
  console.log(`[AIService] Running rule-based explanation generator for question "${qText.substring(0, 30)}..."`);

  // Parse details for steps
  const steps = [
    `Identify the core question requirements: Determine the properties of "${topic}" under "${difficulty}" parameters.`,
    `Evaluate the provided options: Compare Option ${correctLetter} (${correctText}) against the wrong choices.`,
    explanation ? `Apply the direct logic: ${explanation}` : `Apply standard principles: The correct option is ${correctLetter} because it mathematically or logically fits the prompt definition.`,
    `Double check edge cases and verify that Option ${correctLetter} is the unique correct solution.`
  ];

  const concept = `The question tests core properties of ${topic.toUpperCase()} at a ${difficulty.toUpperCase()} difficulty. ` +
    `Mastering this requires understanding standard structural properties, relationships, and operational rules governing the subject.`;

  const relatedTopics = [
    `Advanced ${topic}`,
    `${topic} Applications`,
    `Theoretical ${topic}`
  ];

  return {
    correctAnswerKey: `Option ${correctLetter}: ${correctText}`,
    stepByStepSolution: steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
    conceptExplanation: concept,
    relatedTopics
  };
}

module.exports = { generateExplanationDetails };
