const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a quiz title'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isAdaptive: {
    type: Boolean,
    default: false,
  },
  topic: {
    type: String,
    trim: true,
    lowercase: true,
    // Required if the quiz is adaptive
    required: [
      function () { return this.isAdaptive; },
      'Topic is required for adaptive quizzes',
    ],
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    // In static quizzes, questions are pre-defined. In adaptive quizzes, they are pulled from the topic bank.
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  securitySettings: {
    enforceSecurity: {
      type: Boolean,
      default: false,
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
    violationLimits: {
      type: Number,
      default: 5,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Quiz', quizSchema);
