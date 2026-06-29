const mongoose = require('mongoose');

const practiceSetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  weakTopics: [{ type: String, lowercase: true }],
  reviewTopics: [{ type: String, lowercase: true }],
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
  }],
  answers: [{ type: Number, default: -1 }],
  responses: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    selectedAnswer: Number,
    correctAnswer: Number,
    isCorrect: Boolean,
    confidenceLevel: { type: String, enum: ['low', 'medium', 'high'] },
    timeTaken: { type: Number, default: 0 },
    topic: String,
    difficulty: String,
  }],
  score: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 10 },
  percentage: { type: Number, default: 0 },
  confidenceScore: { type: Number, default: 0 },
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

module.exports = mongoose.model('PracticeSet', practiceSetSchema);
