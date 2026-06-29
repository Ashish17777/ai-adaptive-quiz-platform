const mongoose = require('mongoose');

const masteryTrackingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  topic: {
    type: String,
    required: true,
    index: true
  },
  accuracyHistory: [{
    timestamp: { type: Date, default: Date.now },
    accuracy: { type: Number, required: true }
  }],
  difficultyHistory: [{
    timestamp: { type: Date, default: Date.now },
    difficulty: { type: String, required: true }
  }],
  confidenceHistory: [{
    timestamp: { type: Date, default: Date.now },
    confidence: { type: Number, required: true } // score 0-100 representing accuracy/alignment
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MasteryTracking', masteryTrackingSchema);
