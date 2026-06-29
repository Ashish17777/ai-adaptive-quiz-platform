const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema({
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
  eventType: {
    type: String,
    enum: [
      'TAB_SWITCH',
      'FOCUS_LOSS',
      'COPY_ATTEMPT',
      'PASTE_ATTEMPT',
      'CUT_ATTEMPT',
      'RIGHT_CLICK_ATTEMPT',
      'SCREENSHOT_ATTEMPT',
      'FULLSCREEN_EXIT',
      'SESSION_TIMEOUT',
      'CAMERA_PERMISSION_DENIED',
      'CAMERA_PERMISSION_GRANTED',
      'CAMERA_DISCONNECT',
      'MULTIPLE_FACES_DETECTED',
      'FACE_NOT_DETECTED',
      'PROCTOR_SNAP',
      'SECURITY_HEARTBEAT',
      'IDLE_DETECTED',
      'AUTO_SUBMISSION',
    ],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
});

module.exports = mongoose.model('SecurityLog', securityLogSchema);
