const mongoose = require('mongoose');

const aiReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attempt',
    required: true,
    unique: true,
  },
  // Overall narrative
  summary: { type: String, default: '' },
  learningLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
  },
  // Aggregated metrics
  accuracy: { type: Number, default: 0 },
  confidenceAccuracy: { type: Number, default: 0 },
  adaptiveScore: { type: Number, default: 0 },
  difficultyReached: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium',
  },
  // AI analysis
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  suggestedTopics: [{ type: String }],
  studyRecommendations: [{ type: String }],
  // Topic breakdown
  topicBreakdown: [{
    topic: String,
    accuracy: Number,
    status: { type: String, enum: ['mastered', 'intermediate', 'weak'] },
    questionsCount: Number,
  }],
  generatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AIReport', aiReportSchema);
