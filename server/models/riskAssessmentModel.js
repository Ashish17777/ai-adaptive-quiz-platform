const mongoose = require('mongoose');

const riskAssessmentSchema = new mongoose.Schema({
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
    unique: true,
  },
  sessionId: {
    type: String,
    required: true,
  },
  riskScore: {
    type: Number,
    required: true,
  },
  riskCategory: {
    type: String,
    enum: ['Low Risk', 'Medium Risk', 'High Risk'],
    required: true,
  },
  riskFactors: [
    {
      factor: { type: String, required: true },
      weight: { type: Number, required: true },
    },
  ],
  calculatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('RiskAssessment', riskAssessmentSchema);
