const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
  isAdaptive: {
    type: Boolean,
    default: false,
  },
  // Keeps track of the questions answered/presented in order
  questionsOrder: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  }],
  // Answers matched index-for-index with questionsOrder
  answers: [{
    type: Number, // selected option index (0-3)
  }],
  responses: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    selectedAnswer: Number, // selected option index (0-3)
    correctAnswer: Number,  // correct option index (0-3)
    isCorrect: Boolean,
    confidenceLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
    },
    timeTaken: {
      type: Number, // seconds
      default: 0,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'expert'],
    },
    topic: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    optionOrder: [{
      type: Number, // stores randomized option order mapping, e.g. [2, 0, 1, 3]
    }],
  }],
  score: {
    type: Number,
    default: 0,
  },
  confidenceScore: {
    type: Number,
    default: 0,
  },
  overconfidenceCount: {
    type: Number,
    default: 0,
  },
  underconfidenceCount: {
    type: Number,
    default: 0,
  },
  confidenceAccuracyIndex: {
    type: Number,
    default: 0,
  },
  averageConfidence: {
    type: Number,
    default: 0,
  },
  totalQuestions: {
    type: Number,
    default: 0,
  },
  percentage: {
    type: Number,
    default: 0,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  currentDifficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Attempt', attemptSchema);
