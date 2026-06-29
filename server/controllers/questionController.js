const Question = require('../models/questionModel');

// @desc    Get all questions (with filters)
// @route   GET /api/questions
// @access  Private
const getQuestions = async (req, res) => {
  try {
    const { difficulty, topic, search } = req.query;
    let query = {};

    // Apply difficulty filter
    if (difficulty) {
      query.difficulty = difficulty;
    }

    // Apply topic filter (case-insensitive search / exact matching)
    if (topic) {
      query.topic = topic.trim().toLowerCase();
    }

    // Apply text search on question text
    if (search) {
      query.questionText = { $regex: search, $options: 'i' };
    }

    const questions = await Question.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: questions.length, questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single question
// @route   GET /api/questions/:id
// @access  Private
const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id).populate('createdBy', 'name email');

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    res.json({ success: true, question });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new question
// @route   POST /api/questions
// @access  Private/Admin
const createQuestion = async (req, res) => {
  try {
    const { questionText, options, correctAnswer, difficulty, topic } = req.body;

    if (!questionText || !options || correctAnswer === undefined || !difficulty || !topic) {
      return res.status(400).json({ success: false, message: 'Please add all required fields' });
    }

    if (!Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ success: false, message: 'Options must be an array of exactly 4 items' });
    }

    const question = await Question.create({
      questionText,
      options,
      correctAnswer: Number(correctAnswer),
      difficulty,
      topic: topic.trim().toLowerCase(),
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, question });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a question
// @route   PUT /api/questions/:id
// @access  Private/Admin
const updateQuestion = async (req, res) => {
  try {
    const { questionText, options, correctAnswer, difficulty, topic } = req.body;
    let question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    // Update fields
    if (questionText) question.questionText = questionText;
    if (options) {
      if (!Array.isArray(options) || options.length !== 4) {
        return res.status(400).json({ success: false, message: 'Options must be an array of exactly 4 items' });
      }
      question.options = options;
    }
    if (correctAnswer !== undefined) question.correctAnswer = Number(correctAnswer);
    if (difficulty) question.difficulty = difficulty;
    if (topic) question.topic = topic.trim().toLowerCase();

    const updatedQuestion = await question.save();

    res.json({ success: true, question: updatedQuestion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a question
// @route   DELETE /api/questions/:id
// @access  Private/Admin
const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    await question.deleteOne();

    res.json({ success: true, message: 'Question removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
