const mongoose = require('mongoose');

const examSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true,
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
    unique: true,
    index: true,
  },
  deviceId: {
    type: String,
    required: true,
  },
  ipAddress: {
    type: String,
  },
  loginTime: {
    type: Date,
    default: Date.now,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  allowedTabSwitches: {
    type: Number,
    default: 3,
  },
  fullScreenEnforced: {
    type: Boolean,
    default: false,
  },
  cameraMonitoring: {
    type: Boolean,
    default: false,
  },
  autoSubmitThreshold: {
    type: Number,
    default: 5,
  },
  isAutoSubmitted: {
    type: Boolean,
    default: false,
  },
  autoSubmitReason: {
    type: String,
  },
});

module.exports = mongoose.model('ExamSession', examSessionSchema);
