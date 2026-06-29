const mongoose = require('mongoose');

const proctoringEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attempt',
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
  },
  snapshotUrl: {
    type: String,
  },
  faceDetected: {
    type: Boolean,
    default: true,
  },
  multipleFacesDetected: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
  },
});

module.exports = mongoose.model('ProctoringEvent', proctoringEventSchema);
