const mongoose = require('mongoose');

const aiUsageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: [
      'question_generation',
      'quiz_generation',
      'practice_generation',
      'pdf_extraction',
      'image_extraction'
    ],
    required: true,
  },
  count: {
    type: Number,
    default: 1,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

aiUsageSchema.index({ userId: 1, action: 1, timestamp: 1 });

module.exports = mongoose.model('AIUsage', aiUsageSchema);
