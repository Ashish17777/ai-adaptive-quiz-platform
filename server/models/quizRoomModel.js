const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  socketId: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // Allow guest users who aren't logged in
  },
  name: {
    type: String,
    required: [true, 'Please provide a display name'],
    trim: true,
  },
  score: {
    type: Number,
    default: 0,
  },
  currentDifficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium',
  },
  correctStreak: {
    type: Number,
    default: 0,
  },
  wrongStreak: {
    type: Number,
    default: 0,
  },
  questionsAnswered: {
    type: Number,
    default: 0,
  },
  adaptiveScore: {
    type: Number,
    default: 0,
  },
  confidenceScore: {
    type: Number,
    default: 0,
  },
  overconfidenceCount: {
    type: Number,
    default: 0,
  },
  underconfidenceCount: {
    type: Number,
    default: 0,
  },
  confidenceAccuracyIndex: {
    type: Number,
    default: 0,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  violationsCount: {
    type: Number,
    default: 0,
  },
  riskScore: {
    type: Number,
    default: 0,
  },
  riskCategory: {
    type: String,
    default: 'Low Risk',
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
  securityAlerts: [
    {
      eventType: String,
      message: String,
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  answers: [
    {
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
      answerIndex: Number,
      correctAnswer: Number,
      isCorrect: Boolean,
      confidenceLevel: {
        type: String,
        enum: ['low', 'medium', 'high'],
      },
      timeTaken: {
        type: Number,
        default: 0,
      },
      difficulty: String,
      topic: String,
      scoreAdded: Number,
      answeredAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

const quizRoomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 6,
    maxlength: 6,
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed'],
    default: 'waiting',
  },
  currentQuestion: {
    type: Number,
    default: -1, // -1 represents the lobby wait state
  },
  participants: [participantSchema],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // Automaticaly delete rooms after 24 hours
  },
});

module.exports = mongoose.model('QuizRoom', quizRoomSchema);
