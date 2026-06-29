const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionId: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  context: {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', default: null },
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', default: null },
    topic: { type: String, default: null },
  },
  timestamp: { type: Date, default: Date.now },
});

chatMessageSchema.index({ userId: 1, sessionId: 1, timestamp: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
