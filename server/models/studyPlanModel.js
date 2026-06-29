const mongoose = require('mongoose');

const studyPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'Dynamic AI Study Roadmap'
  },
  weeks: [{
    weekNumber: { type: Number, required: true },
    topic: { type: String, required: true },
    difficulty: { type: String, default: 'medium' },
    tasks: [{
      taskText: { type: String, required: true },
      isCompleted: { type: Boolean, default: false }
    }]
  }],
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
