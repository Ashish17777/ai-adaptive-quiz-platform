const mongoose = require('mongoose');

const topicMasterySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  topic: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  totalAnswered: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 }, // percentage 0-100
  confidenceAccuracy: { type: Number, default: 0 }, // percentage 0-100
  avgDifficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium',
  },
  avgTimeTaken: { type: Number, default: 0 }, // seconds
  overconfidenceCount: { type: Number, default: 0 },
  underconfidenceCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['mastered', 'intermediate', 'weak'],
    default: 'weak',
  },
  lastUpdated: { type: Date, default: Date.now },
});

// Compound index so each user-topic pair is unique and fast to query
topicMasterySchema.index({ userId: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model('TopicMastery', topicMasterySchema);
