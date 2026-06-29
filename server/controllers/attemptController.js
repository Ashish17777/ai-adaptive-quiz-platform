const Attempt = require('../models/attemptModel');
const Quiz = require('../models/quizModel');
const Question = require('../models/questionModel');
const User = require('../models/userModel');
const { triggerPostQuizAI } = require('./aiController');

// Helper functions for Phase 8 option and question shuffles
const shuffleArray = (arr) => {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const getShuffledQuestionOptions = (question, optionOrder) => {
  if (!optionOrder || optionOrder.length === 0) return question.options;
  return optionOrder.map(idx => question.options[idx]);
};

// @desc    Start a quiz attempt
// @route   POST /api/attempts/start
// @access  Private
const startAttempt = async (req, res) => {
  try {
    const { quizId } = req.body;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const enforceSec = quiz.securitySettings?.enforceSecurity;

    // Check if there are active attempts that are incomplete for this user and quiz
    let existingAttempt = await Attempt.findOne({
      user: req.user._id,
      quiz: quizId,
      isCompleted: false,
    });

    if (existingAttempt) {
      // If there is an incomplete attempt, return it so they can resume
      // For adaptive, retrieve the current active question
      if (quiz.isAdaptive) {
        const currentQuestionId = existingAttempt.questionsOrder[existingAttempt.questionsOrder.length - 1];
        const question = await Question.findById(currentQuestionId);
        
        let respItem = existingAttempt.responses.find(r => r.questionId.toString() === currentQuestionId.toString());
        let optionOrder = [0, 1, 2, 3];
        if (respItem && respItem.optionOrder && respItem.optionOrder.length > 0) {
          optionOrder = respItem.optionOrder;
        } else {
          optionOrder = enforceSec ? shuffleArray([0, 1, 2, 3]) : [0, 1, 2, 3];
          if (!respItem) {
            existingAttempt.responses.push({
              questionId: currentQuestionId,
              optionOrder,
              confidenceLevel: 'medium',
            });
          } else {
            respItem.optionOrder = optionOrder;
          }
          await existingAttempt.save();
        }

        const shuffledOptions = getShuffledQuestionOptions(question, optionOrder);

        return res.json({
          success: true,
          attemptId: existingAttempt._id,
          isAdaptive: true,
          isCompleted: false,
          currentQuestionIndex: existingAttempt.questionsOrder.length,
          question: {
            _id: question._id,
            questionText: question.questionText,
            options: shuffledOptions,
            difficulty: question.difficulty,
            topic: question.topic,
          },
        });
      } else {
        // For static, return the attempt details and they can fetch quiz details
        return res.json({
          success: true,
          attemptId: existingAttempt._id,
          isAdaptive: false,
          isCompleted: false,
        });
      }
    }

    if (quiz.isAdaptive) {
      // Find initial Medium question for the topic
      const initialQuestion = await Question.findOne({
        topic: quiz.topic,
        difficulty: 'medium',
      });

      if (!initialQuestion) {
        // If no medium, check for any difficulty
        const fallbackQuestion = await Question.findOne({ topic: quiz.topic });
        if (!fallbackQuestion) {
          return res.status(400).json({
            success: false,
            message: `No questions found in the question bank for topic '${quiz.topic}'`,
          });
        }

        const initialOptionOrder = enforceSec ? shuffleArray([0, 1, 2, 3]) : [0, 1, 2, 3];
        const attempt = await Attempt.create({
          user: req.user._id,
          quiz: quizId,
          isAdaptive: true,
          questionsOrder: [fallbackQuestion._id],
          answers: [],
          responses: [{
            questionId: fallbackQuestion._id,
            optionOrder: initialOptionOrder,
            confidenceLevel: 'medium',
            timeTaken: 0,
            isCorrect: false
          }],
          currentDifficulty: fallbackQuestion.difficulty,
          isCompleted: false,
        });

        const shuffledOptions = getShuffledQuestionOptions(fallbackQuestion, initialOptionOrder);

        return res.status(201).json({
          success: true,
          attemptId: attempt._id,
          isAdaptive: true,
          isCompleted: false,
          currentQuestionIndex: 1,
          question: {
            _id: fallbackQuestion._id,
            questionText: fallbackQuestion.questionText,
            options: shuffledOptions,
            difficulty: fallbackQuestion.difficulty,
            topic: fallbackQuestion.topic,
          },
        });
      }

      const initialOptionOrder = enforceSec ? shuffleArray([0, 1, 2, 3]) : [0, 1, 2, 3];
      const attempt = await Attempt.create({
        user: req.user._id,
        quiz: quizId,
        isAdaptive: true,
        questionsOrder: [initialQuestion._id],
        answers: [],
        responses: [{
          questionId: initialQuestion._id,
          optionOrder: initialOptionOrder,
          confidenceLevel: 'medium',
          timeTaken: 0,
          isCorrect: false
        }],
        currentDifficulty: 'medium',
        isCompleted: false,
      });

      const shuffledOptions = getShuffledQuestionOptions(initialQuestion, initialOptionOrder);

      res.status(201).json({
        success: true,
        attemptId: attempt._id,
        isAdaptive: true,
        isCompleted: false,
        currentQuestionIndex: 1,
        question: {
          _id: initialQuestion._id,
          questionText: initialQuestion.questionText,
          options: shuffledOptions,
          difficulty: initialQuestion.difficulty,
          topic: initialQuestion.topic,
        },
      });
    } else {
      // Static Quiz attempt creation
      let questionsOrder = [...quiz.questions];
      if (enforceSec) {
        questionsOrder = shuffleArray(questionsOrder);
      }

      const initialResponses = questionsOrder.map(qId => ({
        questionId: qId,
        optionOrder: enforceSec ? shuffleArray([0, 1, 2, 3]) : [0, 1, 2, 3],
        confidenceLevel: 'medium',
        timeTaken: 0,
        isCorrect: false
      }));

      const attempt = await Attempt.create({
        user: req.user._id,
        quiz: quizId,
        isAdaptive: false,
        questionsOrder,
        answers: new Array(questionsOrder.length).fill(-1),
        responses: initialResponses,
        isCompleted: false,
      });

      res.status(201).json({
        success: true,
        attemptId: attempt._id,
        isAdaptive: false,
        isCompleted: false,
        totalQuestions: questionsOrder.length,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit an answer for current question (Adaptive Mode)
// @route   POST /api/attempts/submit-answer
// @access  Private
const submitAdaptiveAnswer = async (req, res) => {
  try {
    const { attemptId, answerIndex, confidenceLevel, timeTaken } = req.body;

    if (answerIndex === undefined || answerIndex === null) {
      return res.status(400).json({ success: false, message: 'Please provide an answer index' });
    }
    if (!confidenceLevel) {
      return res.status(400).json({ success: false, message: 'Please provide a confidence level' });
    }

    const attempt = await Attempt.findById(attemptId).populate('quiz');
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    if (attempt.isCompleted) {
      return res.status(400).json({ success: false, message: 'This quiz attempt is already completed' });
    }

    // Retrieve active question details
    const activeQuestionId = attempt.questionsOrder[attempt.questionsOrder.length - 1];
    const question = await Question.findById(activeQuestionId);

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    // Map answerIndex using optionOrder if available
    let mappedAnswerIndex = Number(answerIndex);
    let respItem = attempt.responses.find(r => r.questionId.toString() === activeQuestionId.toString());
    
    if (respItem && respItem.optionOrder && respItem.optionOrder.length > 0) {
      mappedAnswerIndex = respItem.optionOrder[Number(answerIndex)];
    }

    // Check correctness using mapped index
    const isCorrect = question.correctAnswer === mappedAnswerIndex;

    // Save answer & responses
    attempt.answers.push(mappedAnswerIndex);

    if (respItem) {
      respItem.selectedAnswer = mappedAnswerIndex;
      respItem.correctAnswer = question.correctAnswer;
      respItem.isCorrect = isCorrect;
      respItem.confidenceLevel = confidenceLevel;
      respItem.timeTaken = Number(timeTaken) || 0;
      respItem.difficulty = question.difficulty;
      respItem.topic = question.topic;
    } else {
      attempt.responses.push({
        questionId: question._id,
        selectedAnswer: mappedAnswerIndex,
        correctAnswer: question.correctAnswer,
        isCorrect,
        confidenceLevel,
        timeTaken: Number(timeTaken) || 0,
        difficulty: question.difficulty,
        topic: question.topic,
        optionOrder: [0, 1, 2, 3]
      });
    }

    // Calculate confidence-based scoring & metrics
    let scoreCount = 0;
    let confidenceScore = 0;
    let overconfidenceCount = 0;
    let underconfidenceCount = 0;
    let matchedCorrectnessCount = 0;
    let confidenceSum = 0;

    attempt.responses.forEach((resp) => {
      if (resp.selectedAnswer === undefined || resp.selectedAnswer === -1) return; // skip unanswered placeholder items

      if (resp.isCorrect) {
        scoreCount++;
      }

      const level = (resp.confidenceLevel || 'medium').toLowerCase();
      const correct = resp.isCorrect;

      // Confidence scoring
      if (correct) {
        if (level === 'high') confidenceScore += 150;
        else if (level === 'medium') confidenceScore += 100;
        else confidenceScore += 80;
      } else {
        if (level === 'high') confidenceScore -= 50;
        else if (level === 'medium') confidenceScore -= 20;
        else confidenceScore += 0;
      }

      // Over/Underconfidence
      if (!correct && level === 'high') {
        overconfidenceCount++;
      }
      if (correct && level === 'low') {
        underconfidenceCount++;
      }

      // Match logic for accuracy index
      const isMatch = (correct && (level === 'high' || level === 'medium')) ||
                      (!correct && level === 'low');
      if (isMatch) {
        matchedCorrectnessCount++;
      }

      // Avg confidence calculation: low=1, medium=2, high=3
      if (level === 'high') confidenceSum += 3;
      else if (level === 'medium') confidenceSum += 2;
      else confidenceSum += 1;
    });

    attempt.score = scoreCount;
    attempt.confidenceScore = confidenceScore;
    attempt.overconfidenceCount = overconfidenceCount;
    attempt.underconfidenceCount = underconfidenceCount;
    
    // Count active responses that have been answered
    const activeResponses = attempt.responses.filter(r => r.selectedAnswer !== undefined && r.selectedAnswer !== -1);
    
    attempt.confidenceAccuracyIndex = activeResponses.length > 0
      ? Math.round((matchedCorrectnessCount / activeResponses.length) * 100)
      : 0;
    attempt.averageConfidence = activeResponses.length > 0
      ? Math.round((confidenceSum / (activeResponses.length * 3)) * 100)
      : 0;
    attempt.totalQuestions = attempt.answers.length;

    // Adjust difficulty for the next question
    let nextDifficulty = attempt.currentDifficulty;
    if (isCorrect) {
      if (attempt.currentDifficulty === 'easy') {
        nextDifficulty = 'medium';
      } else if (attempt.currentDifficulty === 'medium') {
        nextDifficulty = 'hard';
      } else if (attempt.currentDifficulty === 'hard') {
        nextDifficulty = 'expert';
      }
    } else {
      if (attempt.currentDifficulty === 'expert') {
        nextDifficulty = 'hard';
      } else if (attempt.currentDifficulty === 'hard') {
        nextDifficulty = 'medium';
      } else if (attempt.currentDifficulty === 'medium') {
        nextDifficulty = 'easy';
      }
    }
    attempt.currentDifficulty = nextDifficulty;

    // Check completion threshold (max 8 questions)
    const MAX_ADAPTIVE_QUESTIONS = 8;
    if (attempt.answers.length >= MAX_ADAPTIVE_QUESTIONS) {
      attempt.isCompleted = true;
      attempt.percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
      await attempt.save();

      // Trigger AI post-quiz analysis (non-blocking)
      triggerPostQuizAI(attempt.user.toString(), attempt._id.toString()).catch(e => console.error('[AI trigger]', e.message));

      return res.json({
        success: true,
        isCompleted: true,
        attempt: await Attempt.findById(attemptId)
          .populate('quiz')
          .populate({
            path: 'questionsOrder',
            select: 'questionText options correctAnswer difficulty topic explanation',
          })
          .populate({
            path: 'responses.questionId',
            select: 'questionText options correctAnswer difficulty topic explanation',
          }),
      });
    }

    // Find next question in topic of target difficulty not already answered
    let nextQuestion = await Question.findOne({
      topic: attempt.quiz.topic,
      difficulty: nextDifficulty,
      _id: { $nin: attempt.questionsOrder },
    });

    // Fallback if no questions available at the targeted difficulty
    if (!nextQuestion) {
      nextQuestion = await Question.findOne({
        topic: attempt.quiz.topic,
        _id: { $nin: attempt.questionsOrder },
      });
    }

    if (!nextQuestion) {
      // End quiz
      attempt.isCompleted = true;
      attempt.percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
      await attempt.save();

      // Trigger AI post-quiz analysis (non-blocking)
      triggerPostQuizAI(attempt.user.toString(), attempt._id.toString()).catch(e => console.error('[AI trigger]', e.message));

      return res.json({
        success: true,
        isCompleted: true,
        attempt: await Attempt.findById(attemptId)
          .populate('quiz')
          .populate({
            path: 'questionsOrder',
            select: 'questionText options correctAnswer difficulty topic explanation',
          })
          .populate({
            path: 'responses.questionId',
            select: 'questionText options correctAnswer difficulty topic explanation',
          }),
      });
    }

    // Append next question
    attempt.questionsOrder.push(nextQuestion._id);
    
    // Generate optionOrder for the next question
    const enforceSec = attempt.quiz.securitySettings?.enforceSecurity;
    const nextOptionOrder = enforceSec ? shuffleArray([0, 1, 2, 3]) : [0, 1, 2, 3];
    attempt.responses.push({
      questionId: nextQuestion._id,
      optionOrder: nextOptionOrder,
      confidenceLevel: 'medium',
      timeTaken: 0,
      isCorrect: false
    });
    
    await attempt.save();

    const shuffledOptions = getShuffledQuestionOptions(nextQuestion, nextOptionOrder);

    res.json({
      success: true,
      isCompleted: false,
      currentQuestionIndex: attempt.questionsOrder.length,
      question: {
        _id: nextQuestion._id,
        questionText: nextQuestion.questionText,
        options: shuffledOptions,
        difficulty: nextQuestion.difficulty,
        topic: nextQuestion.topic,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit answers for all questions (Static Mode)
// @route   POST /api/attempts/submit-static
// @access  Private
const submitStaticAttempt = async (req, res) => {
  try {
    const { attemptId, answers, responses: reqResponses } = req.body;

    const attempt = await Attempt.findById(attemptId).populate('quiz');
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    if (attempt.isCompleted) {
      return res.status(400).json({ success: false, message: 'Attempt is already completed' });
    }

    const questions = await Question.find({ _id: { $in: attempt.questionsOrder } });

    // Map questions by ID for order alignment
    const questionMap = {};
    questions.forEach((q) => {
      questionMap[q._id.toString()] = q;
    });

    const updatedResponses = [];
    attempt.answers = [];

    attempt.questionsOrder.forEach((qId, idx) => {
      const question = questionMap[qId.toString()];
      if (!question) return;

      let studentAnswer = -1;
      let confidenceLevel = 'medium';
      let timeTaken = 0;

      if (reqResponses && Array.isArray(reqResponses) && reqResponses[idx]) {
        const respItem = reqResponses[idx];
        studentAnswer = respItem.answerIndex !== undefined ? respItem.answerIndex : -1;
        confidenceLevel = respItem.confidenceLevel || 'medium';
        timeTaken = respItem.timeTaken || 0;
      } else if (answers && Array.isArray(answers)) {
        studentAnswer = answers[idx];
      }

      // Read optionOrder from pre-filled response
      let existingResp = attempt.responses[idx];
      let optionOrder = (existingResp && existingResp.optionOrder && existingResp.optionOrder.length > 0)
        ? existingResp.optionOrder
        : [0, 1, 2, 3];

      let mappedAnswer = studentAnswer;
      if (studentAnswer !== -1) {
        mappedAnswer = optionOrder[Number(studentAnswer)];
      }

      const isCorrect = question.correctAnswer === Number(mappedAnswer);

      attempt.answers.push(Number(mappedAnswer));
      updatedResponses.push({
        questionId: question._id,
        selectedAnswer: Number(mappedAnswer),
        correctAnswer: question.correctAnswer,
        isCorrect,
        confidenceLevel,
        timeTaken: Number(timeTaken) || 0,
        difficulty: question.difficulty,
        topic: question.topic,
        optionOrder: optionOrder
      });
    });

    attempt.responses = updatedResponses;

    // Calculate metrics
    let scoreCount = 0;
    let confidenceScore = 0;
    let overconfidenceCount = 0;
    let underconfidenceCount = 0;
    let matchedCorrectnessCount = 0;
    let confidenceSum = 0;

    attempt.responses.forEach((resp) => {
      if (resp.isCorrect) {
        scoreCount++;
      }

      const level = (resp.confidenceLevel || 'medium').toLowerCase();
      const correct = resp.isCorrect;

      // Confidence scoring rules
      if (correct) {
        if (level === 'high') confidenceScore += 150;
        else if (level === 'medium') confidenceScore += 100;
        else confidenceScore += 80;
      } else {
        if (level === 'high') confidenceScore -= 50;
        else if (level === 'medium') confidenceScore -= 20;
        else confidenceScore += 0;
      }

      // Over/Underconfidence
      if (!correct && level === 'high') {
        overconfidenceCount++;
      }
      if (correct && level === 'low') {
        underconfidenceCount++;
      }

      // Match logic
      const isMatch = (correct && (level === 'high' || level === 'medium')) ||
                      (!correct && level === 'low');
      if (isMatch) {
        matchedCorrectnessCount++;
      }

      // Avg confidence calculation: low=1, medium=2, high=3
      if (level === 'high') confidenceSum += 3;
      else if (level === 'medium') confidenceSum += 2;
      else confidenceSum += 1;
    });

    attempt.score = scoreCount;
    attempt.confidenceScore = confidenceScore;
    attempt.overconfidenceCount = overconfidenceCount;
    attempt.underconfidenceCount = underconfidenceCount;
    attempt.confidenceAccuracyIndex = attempt.responses.length > 0
      ? Math.round((matchedCorrectnessCount / attempt.responses.length) * 100)
      : 0;
    attempt.averageConfidence = attempt.responses.length > 0
      ? Math.round((confidenceSum / (attempt.responses.length * 3)) * 100)
      : 0;
    attempt.totalQuestions = attempt.questionsOrder.length;
    attempt.percentage = attempt.totalQuestions > 0 ? Math.round((scoreCount / attempt.totalQuestions) * 100) : 0;
    attempt.isCompleted = true;

    await attempt.save();

    // Trigger AI post-quiz analysis (non-blocking)
    triggerPostQuizAI(attempt.user.toString(), attempt._id.toString()).catch(e => console.error('[AI trigger]', e.message));

    res.json({
      success: true,
      isCompleted: true,
      attempt: await Attempt.findById(attemptId)
        .populate('quiz')
        .populate({
          path: 'questionsOrder',
          select: 'questionText options correctAnswer difficulty topic explanation',
        })
        .populate({
          path: 'responses.questionId',
          select: 'questionText options correctAnswer difficulty topic explanation',
        }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all attempts for a specific user
// @route   GET /api/results/:userId
// @access  Private
const getUserResults = async (req, res) => {
  try {
    // Check if the user is fetching their own results, or is an Admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these results' });
    }

    const attempts = await Attempt.find({ user: req.params.userId, isCompleted: true })
      .populate('quiz', 'title description isAdaptive topic')
      .populate({
        path: 'questionsOrder',
        select: 'questionText options correctAnswer difficulty topic explanation',
      })
      .populate({
        path: 'responses.questionId',
        select: 'questionText options correctAnswer difficulty topic explanation',
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, count: attempts.length, attempts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get statistics for Admin Dashboard
// @route   GET /api/attempts/stats
// @access  Private/Admin
const getAdminStats = async (req, res) => {
  try {
    const ExamSession = require('../models/examSessionModel');
    const SecurityLog = require('../models/securityLogModel');

    const totalUsers = await User.countDocuments({ role: 'student' });
    const totalQuizzes = await Quiz.countDocuments();
    const activeExams = await ExamSession.countDocuments({ isActive: true });

    // Violations today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const violationsToday = await SecurityLog.countDocuments({
      timestamp: { $gte: today },
      eventType: { $nin: ['SECURITY_HEARTBEAT', 'PROCTOR_SNAP', 'CAMERA_PERMISSION_GRANTED'] }
    });

    const generatedQuestions = await Question.countDocuments({ generatedByAI: true });
    const totalQuestions = await Question.countDocuments();
    const totalAttempts = await Attempt.countDocuments({ isCompleted: true });

    // Recent attempts list
    const recentAttempts = await Attempt.find({ isCompleted: true })
      .populate('user', 'name email')
      .populate('quiz', 'title isAdaptive')
      .sort({ createdAt: -1 })
      .limit(5);

    // Score distribution categories
    const highScores = await Attempt.countDocuments({ isCompleted: true, percentage: { $gte: 80 } });
    const midScores = await Attempt.countDocuments({ isCompleted: true, percentage: { $gte: 50, $lt: 80 } });
    const lowScores = await Attempt.countDocuments({ isCompleted: true, percentage: { $lt: 50 } });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalQuizzes,
        activeExams,
        violationsToday,
        generatedQuestions,
        totalQuestions,
        totalAttempts,
        scoreDistribution: {
          high: highScores,
          medium: midScores,
          low: lowScores,
        },
      },
      recentAttempts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single attempt by ID
// @route   GET /api/attempts/:id
// @access  Private
const getAttemptById = async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id)
      .populate('quiz', 'title description isAdaptive topic')
      .populate({
        path: 'questionsOrder',
        select: 'questionText options correctAnswer difficulty topic explanation',
      })
      .populate({
        path: 'responses.questionId',
        select: 'questionText options correctAnswer difficulty topic explanation',
      });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    // Security: Check if user owns this attempt, or is admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== attempt.user.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these results' });
    }

    res.json({ success: true, attempt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get question by index for attempt (one-at-a-time, secure delivery)
// @route   GET /api/attempts/:id/question/:index
// @access  Private
const getAttemptQuestion = async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' });
    }

    // Security check
    if (req.user.role !== 'admin' && req.user._id.toString() !== attempt.user.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this attempt' });
    }

    const index = parseInt(req.params.index);
    if (isNaN(index) || index < 0 || index >= attempt.questionsOrder.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    const questionId = attempt.questionsOrder[index];
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    // Get optionOrder or fallback to [0,1,2,3]
    let optionOrder = [0, 1, 2, 3];
    let respItem = attempt.responses[index];
    if (respItem && respItem.optionOrder && respItem.optionOrder.length > 0) {
      optionOrder = respItem.optionOrder;
    } else {
      // If no response pre-populated, let's create it and store optionOrder if security is enabled
      const Quiz = require('../models/quizModel');
      const quizObj = await Quiz.findById(attempt.quiz);
      const enforceSec = quizObj ? quizObj.securitySettings?.enforceSecurity : false;
      optionOrder = enforceSec ? shuffleArray([0, 1, 2, 3]) : [0, 1, 2, 3];

      // Update responses
      if (!respItem) {
        attempt.responses.push({
          questionId: question._id,
          optionOrder,
          confidenceLevel: 'medium',
        });
        await attempt.save();
      }
    }

    // Shuffle options array based on optionOrder
    const shuffledOptions = optionOrder.map(originalIdx => question.options[originalIdx]);

    res.json({
      success: true,
      question: {
        _id: question._id,
        questionText: question.questionText,
        options: shuffledOptions,
        difficulty: question.difficulty,
        topic: question.topic,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  startAttempt,
  submitAdaptiveAnswer,
  submitStaticAttempt,
  getUserResults,
  getAdminStats,
  getAttemptById,
  getAttemptQuestion,
};
