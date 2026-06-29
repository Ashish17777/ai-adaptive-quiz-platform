const mongoose = require('mongoose');

const learningMetricSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  improvementRate: {
    type: Number, // percentage rate of change (e.g., +15%)
    default: 0
  },
  topicGrowthRate: {
    type: Number,
    default: 0
  },
  difficultyAdvancementRate: {
    type: Number,
    default: 0
  },
  confidenceImprovementRate: {
    type: Number,
    default: 0
  },
  velocityHistory: [{
    timestamp: { type: Date, default: Date.now },
    velocity: { type: Number, required: true }
  }],
  consistencyScore: {
    type: Number, // 0-100 score based on training consistency
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('LearningMetric', learningMetricSchema);
