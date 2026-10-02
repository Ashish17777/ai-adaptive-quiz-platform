const Question = require('../models/questionModel');
const Quiz = require('../models/quizModel');
const PracticeSet = require('../models/practiceSetModel');
const AIUsage = require('../models/aiUsageModel');
const AILog = require('../models/aiLogModel');

// Services
const { generateQuestions } = require('../services/questionGenerator');
const { generateCompleteQuiz } = require('../services/quizGenerator');
const { generatePracticeQuiz } = require('../services/practiceGenerator');
const { generateExplanationDetails } = require('../services/explanationGenerator');
const { extractTextFromPDF, extractContextFromImage } = require('../services/contentExtractor');
const { callGemini } = require('../services/geminiClient');

function chunkText(text, size = 1500) {
  const chunks = [];
  let index = 0;
  while (index < text.length) {
    let nextIndex = index + size;
    if (nextIndex < text.length) {
      const lastSpace = text.lastIndexOf(' ', nextIndex);
      if (lastSpace > index) {
        nextIndex = lastSpace;
      }
    }
    chunks.push(text.substring(index, nextIndex).trim());
    index = nextIndex;
  }
  return chunks.filter(Boolean);
}

/**
 * Log AI Usage in the database.
 */
async function logUsage(userId, action, count = 1) {
  try {
    await AIUsage.create({
      userId,
      action,
      count
    });
  } catch (err) {
    console.error('[AIUsage] Failed to log usage:', err.message);
  }
}

/**
 * @desc    Generate questions (not saved to DB yet) for admin preview
 * @route   POST /api/ai/generate-question
 * @access  Private (Admin only)
 */
const generateQuestionsAdmin = async (req, res) => {
  try {
    const { topic, difficulty, numberOfQuestions, questionType } = req.body;
    const count = Number(numberOfQuestions) || 5;

    if (!topic) {
      return res.status(400).json({ success: false, message: 'Please provide a topic' });
    }

    const questions = await generateQuestions({
      topic,
      difficulty,
      numberOfQuestions: count,
      questionType,
      userId: req.user._id,
      action: 'question_generation'
    });

    await logUsage(req.user._id, 'question_generation', questions.length);

    res.json({
      success: true,
      questions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Generate a complete quiz (saved to DB)
 * @route   POST /api/ai/generate-quiz
 * @access  Private (Admin only)
 */
const generateQuizAdmin = async (req, res) => {
  try {
    const { title, topic, difficulty, numberOfQuestions } = req.body;
    const count = Number(numberOfQuestions) || 5;

    if (!topic || !title) {
      return res.status(400).json({ success: false, message: 'Please provide a title and topic' });
    }

    const { quiz, questions } = await generateCompleteQuiz({
      title,
      topic,
      difficulty,
      numberOfQuestions: count,
      userId: req.user._id
    });

    await logUsage(req.user._id, 'quiz_generation', 1);
    await logUsage(req.user._id, 'question_generation', questions.length);

    res.status(201).json({
      success: true,
      quiz,
      questionsCount: questions.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Generate a custom mixed-difficulty practice set for students
 * @route   POST /api/ai/generate-practice
 * @access  Private
 */
const generatePracticeStudent = async (req, res) => {
  try {
    const { topic, numberOfQuestions, studentLevel } = req.body;
    const count = Number(numberOfQuestions) || 15;

    if (!topic) {
      return res.status(400).json({ success: false, message: 'Please provide a topic' });
    }

    const data = await generatePracticeQuiz({
      userId: req.user._id,
      topic,
      numberOfQuestions: count,
      studentLevel: studentLevel || 'intermediate'
    });

    await logUsage(req.user._id, 'practice_generation', 1);
    await logUsage(req.user._id, 'question_generation', data.totalCount);

    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Generate structured explanation details for a question
 * @route   POST /api/ai/generate-explanation
 * @access  Private
 */
const generateExplanation = async (req, res) => {
  try {
    const { questionId, questionText, options, correctAnswer, topic, difficulty, explanation } = req.body;

    let questionObj = {};
    if (questionId) {
      const dbQ = await Question.findById(questionId);
      if (dbQ) questionObj = dbQ;
    }

    // Fallback to body properties if not in DB or custom question passed
    questionObj = {
      questionText: questionObj.questionText || questionText,
      options: questionObj.options || options,
      correctAnswer: questionObj.correctAnswer ?? correctAnswer,
      topic: questionObj.topic || topic,
      difficulty: questionObj.difficulty || difficulty,
      explanation: questionObj.explanation || explanation
    };

    if (!questionObj.questionText || !questionObj.options) {
      return res.status(400).json({ success: false, message: 'Invalid question details provided' });
    }

    const explanationDetails = await generateExplanationDetails(questionObj);

    res.json({
      success: true,
      explanation: explanationDetails
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Upload study guide PDF and generate questions
 * @route   POST /api/ai/pdf-to-quiz
 * @access  Private (Admin only)
 */
const generateQuizFromPDF = async (req, res) => {
  const startTime = Date.now();
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a PDF file' });
    }

    const { difficulty, numberOfQuestions } = req.body;
    const count = Number(numberOfQuestions) || 5;

    // 1. Parse PDF text content
    const parseResult = await extractTextFromPDF(req.file.buffer, { noCap: true });
    const fullText = parseResult.text || '';
    
    // 2. Clean text content (remove non-printable control characters)
    const cleanedText = fullText.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

    // 3. Chunk text content into ~1500 character blocks
    const chunks = chunkText(cleanedText, 1500);
    if (chunks.length === 0) {
      chunks.push('general educational topic');
    }

    const mainTopic = parseResult.keywords[0] || 'general';
    const topicsIdentified = parseResult.keywords;

    // 4. Loop through chunks to call generateQuestions(..., { pdfContent: chunk })
    const questions = [];
    const numChunks = chunks.length;

    for (let i = 0; i < numChunks; i++) {
      const remainingNeeded = count - questions.length;
      if (remainingNeeded <= 0) break;

      const chunkCount = Math.ceil(remainingNeeded / (numChunks - i));
      if (chunkCount <= 0) continue;

      const chunkQuestions = await generateQuestions({
        topic: `${mainTopic} (specifically covering: ${topicsIdentified.join(', ')})`,
        difficulty: difficulty || 'medium',
        numberOfQuestions: chunkCount,
        pdfContent: chunks[i],
        userId: req.user._id,
        action: 'pdf_to_quiz'
      });

      questions.push(...chunkQuestions);
    }

    // Top up if we didn't generate enough questions
    if (questions.length < count) {
      const remainingNeeded = count - questions.length;
      const topUpQuestions = await generateQuestions({
        topic: `${mainTopic} (specifically covering: ${topicsIdentified.join(', ')})`,
        difficulty: difficulty || 'medium',
        numberOfQuestions: remainingNeeded,
        userId: req.user._id,
        action: 'pdf_to_quiz'
      });
      questions.push(...topUpQuestions);
    }

    const generationTimeMs = Date.now() - startTime;

    // 5. Log overall PDF quiz generation inside AILog DB
    await AILog.create({
      userId: req.user._id,
      action: 'pdf_to_quiz',
      topic: mainTopic,
      difficulty: difficulty || 'medium',
      prompt: `PDF processing: ${cleanedText.length} characters, ${parseResult.pageCount} pages, keywords: ${topicsIdentified.join(', ')}`,
      generatedQuestions: questions,
      validationResults: {
        success: questions.length >= count,
        errors: []
      },
      generationTimeMs,
      success: questions.length >= count
    });

    await logUsage(req.user._id, 'pdf_extraction', 1);
    await logUsage(req.user._id, 'question_generation', questions.length);

    // 6. Return pages processed, text length, topics identified, keywords, and questions
    res.json({
      success: true,
      topic: mainTopic,
      keywords: topicsIdentified,
      questions,
      pageCount: parseResult.pageCount,
      textLength: cleanedText.length,
      topicsIdentified,
      textSnippet: cleanedText.substring(0, 400)
    });
  } catch (err) {
    const generationTimeMs = Date.now() - startTime;
    if (req.user && req.user._id) {
      try {
        await AILog.create({
          userId: req.user._id,
          action: 'pdf_to_quiz',
          errorMessage: err.message,
          success: false,
          validationResults: { success: false, errors: [err.message] },
          generationTimeMs
        });
      } catch (logErr) {
        console.error('[AILog] Failed to log pdf error:', logErr.message);
      }
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Upload educational image and generate questions
 * @route   POST /api/ai/image-to-quiz
 * @access  Private (Admin only)
 */
const generateQuizFromImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }

    const { difficulty, numberOfQuestions } = req.body;
    const count = Number(numberOfQuestions) || 5;

    // 1. Analyze image to extract context
    const imageContext = await extractContextFromImage(req.file.buffer, req.file.originalname);

    // 2. Generate questions from extracted diagram context
    const questions = await generateQuestions({
      topic: `${imageContext.topic} (depicting: ${imageContext.description})`,
      difficulty: difficulty || 'medium',
      numberOfQuestions: count
    });

    await logUsage(req.user._id, 'image_extraction', 1);
    await logUsage(req.user._id, 'question_generation', questions.length);

    res.json({
      success: true,
      topic: imageContext.topic,
      description: imageContext.description,
      questions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get AI Generation Usage Statistics
 * @route   GET /api/ai/usage-stats
 * @access  Private (Admin only)
 */
const getAIUsageStats = async (req, res) => {
  try {
    // Total numbers of generated objects
    const totalQuestionsGenerated = await Question.countDocuments({ generatedByAI: true });
    const totalQuizzesGenerated = await Quiz.countDocuments({ description: /AI-generated/ });
    
    // Aggregation of usage logs per action types
    const logs = await AIUsage.aggregate([
      {
        $group: {
          _id: '$action',
          totalCount: { $sum: '$count' },
          activityCount: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      questionsGenerated: totalQuestionsGenerated,
      quizzesGenerated: totalQuizzesGenerated,
      practiceSetsGenerated: 0,
      pdfProcessed: 0,
      imageProcessed: 0
    };

    logs.forEach(log => {
      if (log._id === 'question_generation') stats.questionsGenerated = log.totalCount;
      if (log._id === 'quiz_generation') stats.quizzesGenerated = log.totalCount;
      if (log._id === 'practice_generation') stats.practiceSetsGenerated = log.totalCount;
      if (log._id === 'pdf_extraction') stats.pdfProcessed = log.totalCount;
      if (log._id === 'image_extraction') stats.imageProcessed = log.totalCount;
    });

    // Recent AI activity log
    const recentLogs = await AIUsage.find()
      .populate('userId', 'name email')
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      stats,
      recentActivity: recentLogs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get AI logs for monitoring
 * @route   GET /api/ai/logs
 * @access  Private (Admin only)
 */
const getAILogs = async (req, res) => {
  try {
    const logs = await AILog.find()
      .populate('userId', 'name email')
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      logs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Get AI Health check stats
 * @route   GET /api/ai/health
 * @access  Private (Admin only)
 */
const getAIHealth = async (req, res) => {
  try {
    let apiConnected = false;
    let details = 'No LLM API Key configured in server environment.';

    if (process.env.GROQ_API_KEY) {
      try {
        await callGemini('ping');
        apiConnected = true;
        details = 'Groq API (OpenAI GPT-OSS-120B) Connected successfully.';
      } catch (err) {
        details = `Groq API ping failure: ${err.message}`;
      }
    } else if (process.env.GEMINI_API_KEY) {
      try {
        await callGemini('ping');
        apiConnected = true;
        details = 'Gemini 3.8 Flash API Connected successfully.';
      } catch (err) {
        details = `Gemini API ping failure: ${err.message}`;
      }
    }

    const lastSuccess = await AILog.findOne({ success: true })
      .sort({ timestamp: -1 })
      .select('timestamp')
      .lean();
      
    const errorCount = await AILog.countDocuments({ success: false });

    res.json({
      success: true,
      apiConnected,
      details,
      lastSuccessfulGeneration: lastSuccess ? lastSuccess.timestamp : null,
      errorCount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  generateQuestionsAdmin,
  generateQuizAdmin,
  generatePracticeStudent,
  generateExplanation,
  generateQuizFromPDF,
  generateQuizFromImage,
  getAIUsageStats,
  getAILogs,
  getAIHealth
};
