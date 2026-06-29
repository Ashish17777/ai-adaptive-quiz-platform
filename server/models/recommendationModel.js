const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recommendedQuizzes: [{
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    title: String,
    topic: String,
    difficulty: String,
    estimatedSuccessProbability: Number // float (0.0 to 1.0)
  }],
  recommendedPracticeSets: [{
    topic: String,
    reason: String
  }],
  recommendedTopics: [{
    topic: String,
    reason: String
  }],
  recommendedLessons: [{
    title: String,
    content: String,
    url: String
  }],
  recommendedExplanations: [{
    questionText: String,
    explanation: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Recommendation', recommendationSchema);
