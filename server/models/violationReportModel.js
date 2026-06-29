const mongoose = require('mongoose');

const violationReportSchema = new mongoose.Schema({
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
    unique: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
  },
  tabSwitchCount: {
    type: Number,
    default: 0,
  },
  focusLossCount: {
    type: Number,
    default: 0,
  },
  copyPasteCutCount: {
    type: Number,
    default: 0,
  },
  rightClickCount: {
    type: Number,
    default: 0,
  },
  screenshotCount: {
    type: Number,
    default: 0,
  },
  fullscreenExitCount: {
    type: Number,
    default: 0,
  },
  cameraViolationCount: {
    type: Number,
    default: 0,
  },
  lastViolationTime: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ViolationReport', violationReportSchema);
