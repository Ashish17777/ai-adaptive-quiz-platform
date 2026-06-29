const mongoose = require('mongoose');

const learningStepSchema = new mongoose.Schema({
  topic: { type: String, required: true, lowercase: true },
  order: { type: Number, required: true },
  status: {
    type: String,
    enum: ['completed', 'current', 'upcoming'],
    default: 'upcoming',
  },
  accuracy: { type: Number, default: 0 },
});

const learningPathSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  currentLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
  },
  steps: [learningStepSchema],
  recommendedTopics: [{ type: String, lowercase: true }],
  weakTopics: [{ type: String, lowercase: true }],
  strengths: [{ type: String }],
  generatedAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LearningPath', learningPathSchema);
