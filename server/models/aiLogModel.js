const mongoose = require('mongoose');

const aiLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true, // 'question_generation', 'quiz_generation', 'pdf_to_quiz', 'tutor_chat', etc.
  },
  topic: { type: String, default: '' },
  difficulty: { type: String, default: '' },
  prompt: { type: String, default: '' },
  generatedQuestions: { type: Array, default: [] },
  validationResults: {
    success: { type: Boolean, required: true },
    errors: { type: Array, default: [] }, // detailed validation error strings
  },
  generationTimeMs: { type: Number, default: 0 },
  errorMessage: { type: String, default: '' }, // details of any API failures
  success: { type: Boolean, required: true },
  timestamp: { type: Date, default: Date.now },
});

aiLogSchema.index({ timestamp: -1 });
aiLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('AILog', aiLogSchema);
