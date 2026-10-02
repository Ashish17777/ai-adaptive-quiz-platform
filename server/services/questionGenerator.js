const { callGroq } = require('./groqClient');

function cleanJsonResponse(text) {
  if (!text) return '';
  let cleanText = text.trim();
  if (cleanText.startsWith('```')) {
    const lines = cleanText.split('\n');
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    if (lines[lines.length - 1].startsWith('```')) {
      lines.pop();
    }
    cleanText = lines.join('\n').trim();
  }
  return cleanText;
}

/**
 * Jaccard similarity between two strings (word-level).
 */
function getSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...setA].filter(x => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return intersection.length / union.size;
}

/**
 * Check if the question is a duplicate of an existing question in the DB or the current batch.
 */
async function isDuplicate(questionText, topic, currentList) {
  if (!questionText) return true;
  for (const existing of currentList) {
    if (getSimilarity(questionText, existing.questionText) > 0.75) {
      return true;
    }
  }
  try {
    const Question = require('../models/questionModel');
    const existingQuestions = await Question.find({ topic: topic.toLowerCase() })
      .select('questionText')
      .limit(100)
      .lean();
    for (const existing of existingQuestions) {
      if (getSimilarity(questionText, existing.questionText) > 0.75) {
        return true;
      }
    }
  } catch (error) {
    // DB unavailable — skip DB dedup check
  }
  return false;
}

/**
 * Full quality control check for AI-generated questions.
 */
async function qualityControlCheck(q, topic, difficulty, currentList) {
  if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
    return { valid: false, reason: 'Invalid correct answer index (must be 0-3)' };
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    return { valid: false, reason: 'Must have exactly 4 options' };
  }
  const uniqueOptions = new Set(q.options.map(opt => opt ? opt.trim().toLowerCase() : ''));
  if (uniqueOptions.size !== 4 || uniqueOptions.has('')) {
    return { valid: false, reason: 'Options must be 4 distinct, non-empty values' };
  }
  if (await isDuplicate(q.questionText, topic, currentList)) {
    return { valid: false, reason: 'Duplicate question text detected (Jaccard similarity > 75%)' };
  }
  if (q.difficulty && q.difficulty.toLowerCase() !== difficulty.toLowerCase()) {
    return { valid: false, reason: 'Difficulty mismatch' };
  }
  if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length < 30) {
    return { valid: false, reason: 'Explanation too short or missing' };
  }
  return { valid: true };
}

/**
 * Validate a single generated question structure.
 */
function validateQuestion(q, topic, difficulty) {
  if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim() === '') {
    return false;
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    return false;
  }
  if (q.options.some(opt => typeof opt !== 'string' || opt.trim() === '')) {
    return false;
  }
  if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
    return false;
  }
  q.topic = (q.topic || topic || 'general').toLowerCase();
  q.difficulty = (q.difficulty || difficulty || 'medium').toLowerCase();
  if (!['easy', 'medium', 'hard', 'expert'].includes(q.difficulty)) {
    q.difficulty = 'medium';
  }
  q.explanation = q.explanation || `The correct answer is option ${String.fromCharCode(65 + q.correctAnswer)}.`;
  return true;
}

/**
 * Core question generator — Gemini AI only.
 * Throws a clear error if the AI service is unavailable.
 */
async function generateQuestions({ topic, difficulty, numberOfQuestions = 5, questionType = 'MCQ', pdfContent, userId, action }) {
  const count = Number(numberOfQuestions) || 5;
  const diff = (difficulty || 'medium').toLowerCase();
  const top = (topic || 'general').toLowerCase();

  if (!process.env.GROQ_API_KEY) {
    throw new Error('AI service is not configured. Please set up a valid GROQ_API_KEY.');
  }

  const validatedList = [];
  let attempts = 0;
  const maxAttempts = 3;
  const startTime = Date.now();
  let promptUsed = '';
  let apiErrorMessage = '';
  const validationErrors = [];

  while (validatedList.length < count && attempts < maxAttempts) {
    attempts++;
    const remainingCount = count - validatedList.length;
    try {
      const pdfConstraint = pdfContent ? `\nCRITICAL: Generate questions strictly based on the following text content extracted from a study document/PDF:\n"""\n${pdfContent}\n"""\nQuestions MUST ONLY reference facts, concepts, definitions, or formulas discussed in this text.` : '';

      const prompt = `Generate exactly ${remainingCount} unique multiple choice questions (MCQ) about "${top}" with "${diff}" difficulty.${pdfConstraint}

              Difficulty Guidelines:
              - "easy": Direct recall of terminology, definitions, and basic principles. Simple, single-step questions.
              - "medium": Application-based concepts, interpreting examples, or single-step formula applications.
              - "hard": Multi-step reasoning, combination of two or more distinct concepts, or algebraic/logical derivations.
              - "expert": Advanced analytical problem solving, edge cases, complex composite structures, or theoretical failures/proofs.

              Formatting & Quality Requirements:
              - If a question involves programming code or scripts:
                * Put the code inside markdown code blocks with the language identifier (e.g. \`\`\`python\ncode\n\`\`\`).
                * NEVER compress multi-line code onto one line. Use actual newlines (\\n) and standard indentation for every code block.
              - The questionText must be clean, neat, and clearly phrased.
              - The "options" array MUST contain EXACTLY 4 distinct, non-empty options.
              - Explanations must be thorough, step-by-step, and explain the logic clearly.

              For each question, return exactly 4 options, the 0-indexed correctAnswer, and a detailed explanation (minimum 30 characters, explaining the reasoning and why the others are wrong).
              Format your response ONLY as a JSON object matching this schema:
              {
                "questions": [
                  {
                    "questionText": "Question string?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correctAnswer": 0,
                    "explanation": "Detailed explanation string",
                    "topic": "${top}",
                    "difficulty": "${diff}"
                  }
                ]
              }
              
              DO NOT generate questions similar to: ${validatedList.map(q => q.questionText).join(' | ')}`;

      promptUsed = prompt;

      const resText = await callGroq(prompt, { jsonOutput: true });
      const cleanText = cleanJsonResponse(resText);
      const parsed = JSON.parse(cleanText);
      const questionsList = parsed.questions || parsed.array || (Array.isArray(parsed) ? parsed : Object.values(parsed)[0]);
      if (Array.isArray(questionsList)) {
        for (const q of questionsList) {
          const fullQ = { ...q, topic: q.topic || top, difficulty: q.difficulty || diff, generatedByAI: true };
          const qc = await qualityControlCheck(fullQ, top, diff, validatedList);
          if (qc.valid) {
            validatedList.push(fullQ);
          } else {
            console.warn('[AIService] Question rejected by QC:', qc.reason);
            validationErrors.push(`${fullQ.questionText || 'Empty question'}: ${qc.reason}`);
          }
        }
      }
    } catch (e) {
      console.error('[AIService] Groq Question Gen failed. Error:', e.message);
      apiErrorMessage = `Groq Error: ${e.message}`;
      break;
    }
  }

  // Log AI usage
  const generationTimeMs = Date.now() - startTime;
  const success = validatedList.length >= count;

  if (userId) {
    try {
      const AILog = require('../models/aiLogModel');
      await AILog.create({
        userId,
        action: action || 'question_generation',
        topic: top,
        difficulty: diff,
        prompt: promptUsed || 'N/A',
        generatedQuestions: validatedList,
        validationResults: {
          success: validationErrors.length === 0 && validatedList.length > 0,
          errors: validationErrors
        },
        generationTimeMs,
        errorMessage: apiErrorMessage,
        success
      });
    } catch (logErr) {
      console.error('[AILog] Failed to save log:', logErr.message);
    }
  }

  if (validatedList.length === 0) {
    throw new Error('AI Service Unavailable: Our question generation engine is temporarily unreachable. Please try again in a few moments.');
  }

  return validatedList;
}

module.exports = { generateQuestions, validateQuestion, qualityControlCheck, getSimilarity };
