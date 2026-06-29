const Quiz = require('../models/quizModel');
const Question = require('../models/questionModel');

// @desc    Get all quizzes
// @route   GET /api/quizzes
// @access  Private
const getQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find()
      .populate('createdBy', 'name email')
      .populate('questions', '_id questionText difficulty topic')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: quizzes.length, quizzes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single quiz details
// @route   GET /api/quizzes/:id
// @access  Private
const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'questions',
        select: 'questionText options difficulty topic',
      });

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    res.json({ success: true, quiz });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new quiz
// @route   POST /api/quizzes
// @access  Private/Admin
const createQuiz = async (req, res) => {
  try {
    const { title, description, isAdaptive, topic, questions, securitySettings } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Please add a quiz title' });
    }

    if (isAdaptive && !topic) {
      return res.status(400).json({ success: false, message: 'Topic is required for adaptive quizzes' });
    }

    // Prepare quiz object
    const quizData = {
      title,
      description,
      isAdaptive: !!isAdaptive,
      createdBy: req.user._id,
    };

    if (isAdaptive) {
      quizData.topic = topic.trim().toLowerCase();
      quizData.questions = []; // Adaptive has no static questions
    } else {
      if (questions && Array.isArray(questions)) {
        quizData.questions = questions;
      }
    }

    // Apply security settings if provided
    if (securitySettings && typeof securitySettings === 'object') {
      quizData.securitySettings = {
        enforceSecurity: !!securitySettings.enforceSecurity,
        allowedTabSwitches: Number(securitySettings.allowedTabSwitches) || 2,
        fullScreenEnforced: !!securitySettings.fullScreenEnforced,
        cameraMonitoring: !!securitySettings.cameraMonitoring,
        violationLimits: Number(securitySettings.violationLimits) || 4,
      };
    }

    const quiz = await Quiz.create(quizData);

    res.status(201).json({ success: true, quiz });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a quiz
// @route   PUT /api/quizzes/:id
// @access  Private/Admin
const updateQuiz = async (req, res) => {
  try {
    const { title, description, isAdaptive, topic, questions, securitySettings } = req.body;
    let quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;

    // Handle switching or updating adaptive settings
    if (isAdaptive !== undefined) {
      quiz.isAdaptive = !!isAdaptive;
    }

    if (quiz.isAdaptive) {
      if (topic) {
        quiz.topic = topic.trim().toLowerCase();
      } else if (!quiz.topic) {
        return res.status(400).json({ success: false, message: 'Topic is required for adaptive quizzes' });
      }
      quiz.questions = []; // Clear static questions if adaptive
    } else {
      if (questions && Array.isArray(questions)) {
        quiz.questions = questions;
      }
      quiz.topic = undefined; // Clear topic if static
    }

    // Update security settings if provided
    if (securitySettings && typeof securitySettings === 'object') {
      quiz.securitySettings = {
        enforceSecurity: !!securitySettings.enforceSecurity,
        allowedTabSwitches: Number(securitySettings.allowedTabSwitches) ?? quiz.securitySettings?.allowedTabSwitches ?? 2,
        fullScreenEnforced: !!securitySettings.fullScreenEnforced,
        cameraMonitoring: !!securitySettings.cameraMonitoring,
        violationLimits: Number(securitySettings.violationLimits) ?? quiz.securitySettings?.violationLimits ?? 4,
      };
    }

    const updatedQuiz = await quiz.save();

    res.json({ success: true, quiz: updatedQuiz });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a quiz
// @route   DELETE /api/quizzes/:id
// @access  Private/Admin
const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    await quiz.deleteOne();

    res.json({ success: true, message: 'Quiz removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
};
