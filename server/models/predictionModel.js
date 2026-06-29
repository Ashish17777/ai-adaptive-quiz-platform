const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  predictedScore: {
    type: Number, // predicted performance (0-100)
    default: 0
  },
  predictedDifficultyLevel: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium'
  },
  predictedTopicMastery: [{
    topic: String,
    predictedScore: Number
  }],
  readinessLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'exam_ready'],
    default: 'beginner'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Prediction', predictionSchema);
