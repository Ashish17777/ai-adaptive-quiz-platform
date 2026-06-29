const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  topicMastery: {
    type: Map,
    of: Number, // topic name -> accuracy percentage (0-100)
    default: {}
  },
  confidenceScore: {
    type: Number,
    default: 0
  },
  adaptiveScore: {
    type: Number,
    default: 0
  },
  averageDifficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium'
  },
  learningVelocity: {
    type: Number, // speed of accuracy improvement per quiz
    default: 0
  },
  strengths: {
    type: [String],
    default: []
  },
  weaknesses: {
    type: [String],
    default: []
  },
  examReadinessScore: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
