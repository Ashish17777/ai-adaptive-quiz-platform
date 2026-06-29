/**
 * AI Service Orchestrator
 * Routes AI requests to rule-based engines or LLM providers.
 * To enable LLM: set GEMINI_API_KEY or OPENAI_API_KEY in .env
 *
 * Architecture:
 *   - Rule-based engines always available (no API key needed)
 *   - LLM provider loaded only when API key present
 *   - Unified interface: callers never know which engine is active
 */

const axios = require('axios');
const { analyzePerformance } = require('./recommendationEngine');
const { buildLearningPath } = require('./learningPathEngine');
const { generateExplanation, generateChatResponse } = require('./explanationEngine');
const { generatePracticeSet } = require('./practiceSetEngine');

// Check if LLM keys are configured
const HAS_GEMINI = !!process.env.GEMINI_API_KEY;
const HAS_OPENAI = !!process.env.OPENAI_API_KEY;

if (HAS_GEMINI) {
  console.log('[AIService] Gemini API key detected — LLM mode active');
} else if (HAS_OPENAI) {
  console.log('[AIService] OpenAI API key detected — LLM mode active');
} else {
  console.log('[AIService] No LLM API key — using rule-based AI engines');
}

/**
 * Analyze a student's performance and return strengths/weaknesses/recommendations.
 */
async function analyze(params) {
  if (HAS_GEMINI) {
    // Future: return await geminiAnalyze(params);
  }
  if (HAS_OPENAI) {
    // Future: return await openaiAnalyze(params);
  }
  return analyzePerformance(params);
}

/**
 * Build or update a student's personalized learning path.
 */
async function buildPath(topicMasteryRecords, allTopicsInBank) {
  if (HAS_GEMINI || HAS_OPENAI) {
    // Future: LLM-generated path with richer context
  }
  return buildLearningPath(topicMasteryRecords, allTopicsInBank);
}

/**
 * Generate explanation for a specific question response.
 */
async function explain(params) {
  const { question, selectedAnswer, isCorrect, confidenceLevel } = params;

  if (HAS_GEMINI) {
    try {
      const prompt = `You are an expert tutor. Please explain why the selected answer is correct or incorrect for this question.
Question: "${question.questionText}"
Options:
${question.options.map((opt, idx) => `${idx}) ${opt}`).join('\n')}

Selected Answer Index: ${selectedAnswer} (Option Text: "${question.options[selectedAnswer] || 'None'}")
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

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }
      );
      const resText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(resText);
      if (parsed.explanation) {
        return {
          questionText: question.questionText,
          selectedOption: question.options[selectedAnswer] || 'None',
          correctOption: question.options[question.correctAnswer],
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
      console.warn('[AIService] Gemini Explanation failed. Falling back. Error:', e.message);
    }
  }

  if (HAS_OPENAI) {
    try {
      const prompt = `You are an expert tutor. Explain why the selected answer is correct or incorrect for this question.
Question: "${question.questionText}"
Options:
${question.options.map((opt, idx) => `${idx}) ${opt}`).join('\n')}

Selected Answer Index: ${selectedAnswer}
Is Correct: ${isCorrect}
Confidence Level: ${confidenceLevel}

Format response as JSON: {"explanation": "...", "whyWrong": "...", "relatedConcepts": ["...", "..."], "confidenceFeedback": "...", "studyHint": "..."}`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const resText = response.data?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(resText);
      if (parsed.explanation) {
        return {
          questionText: question.questionText,
          selectedOption: question.options[selectedAnswer] || 'None',
          correctOption: question.options[question.correctAnswer],
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
      console.warn('[AIService] OpenAI Explanation failed. Falling back. Error:', e.message);
    }
  }

  return generateExplanation(params);
}

/**
 * Generate AI tutor chat response.
 */
async function chat(message, context) {
  if (HAS_GEMINI) {
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

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        }
      );
      const resText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (resText) return resText.trim();
    } catch (e) {
      console.warn('[AIService] Gemini Chat failed. Error:', e.message);
    }
  }

  if (HAS_OPENAI) {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are a helpful, personalized AI Study Tutor for a student in our adaptive quiz platform.
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
- Strictly avoid repeating responses or explanations that already exist in the chat history. Provide unique, context-aware information.`
        }
      ];

      (context.history || []).forEach(h => {
        messages.push({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content
        });
      });

      messages.push({ role: 'user', content: message });

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const resText = response.data?.choices?.[0]?.message?.content;
      if (resText) return resText.trim();
    } catch (e) {
      console.warn('[AIService] OpenAI Chat failed. Error:', e.message);
    }
  }

  return generateChatResponse(message, context);
}

/**
 * Generate personalized practice set.
 */
async function practice(params) {
  return generatePracticeSet(params);
}

module.exports = { analyze, buildPath, explain, chat, practice };
