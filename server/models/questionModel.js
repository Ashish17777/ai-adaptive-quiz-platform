const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'Please add the question text'],
    trim: true,
  },
  options: {
    type: [String],
    validate: {
      validator: function (val) {
        return val.length === 4;
      },
      message: 'A question must have exactly 4 options',
    },
    required: [true, 'Please add 4 options'],
  },
  correctAnswer: {
    type: Number,
    required: [true, 'Please specify the correct option index (0-3)'],
    min: [0, 'Correct answer index must be between 0 and 3'],
    max: [3, 'Correct answer index must be between 0 and 3'],
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'expert'],
    default: 'medium',
    required: true,
  },
  topic: {
    type: String,
    required: [true, 'Please specify the topic/category of the question'],
    trim: true,
    lowercase: true,
  },
  explanation: {
    type: String,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  generatedByAI: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Question', questionSchema);
