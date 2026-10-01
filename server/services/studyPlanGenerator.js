const StudyPlan = require('../models/studyPlanModel');
const StudentProfile = require('../models/studentProfileModel');
const TopicMastery = require('../models/topicMasteryModel');

/**
 * Study Plan Generator Service
 * Dynamically designs and adjusts a 4-week schedule with structured review tasks.
 * Focuses 70% on weaknesses, 20% on moderate areas, and 10% on strong/review topics.
 */

async function generateStudyPlan(userId) {
  try {
    const profile = await StudentProfile.findOne({ userId });
    const masteries = await TopicMastery.find({ userId });

    // Don't generate a plan if there is no real data to base it on
    if (masteries.length === 0) return null;

    // Classify topics
    const weakTopics = [];
    const moderateTopics = [];
    const strongTopics = [];

    masteries.forEach((m) => {
      const topic = m.topic;
      const acc = m.accuracy || 0;
      if (acc >= 85) strongTopics.push(topic);
      else if (acc >= 60) moderateTopics.push(topic);
      else weakTopics.push(topic);
    });

    // Need at least one weak or moderate topic to build a meaningful plan
    const weak = weakTopics.length > 0 ? weakTopics : moderateTopics;
    const moderate = moderateTopics.length > 0 ? moderateTopics : weakTopics;
    const strong = strongTopics;

    if (weak.length === 0 && moderate.length === 0) return null;

    const weeks = [];

    // Week 1: Core focus on primary weakness
    const w1Topic = weak[0];
    weeks.push({
      weekNumber: 1,
      topic: w1Topic,
      difficulty: 'easy',
      tasks: [
        { taskText: `Review fundamental formulas for ${w1Topic}`, isCompleted: false },
        { taskText: `Complete a targeted practice set on ${w1Topic}`, isCompleted: false },
        { taskText: `Discuss incorrect questions on ${w1Topic} with the AI Tutor`, isCompleted: false }
      ]
    });

    // Week 2: Address secondary weakness or primary moderate topic
    const w2Topic = weak[1] || moderate[0] || defaults[1];
    weeks.push({
      weekNumber: 2,
      topic: w2Topic,
      difficulty: 'medium',
      tasks: [
        { taskText: `Analyze diagram and graph contexts for ${w2Topic}`, isCompleted: false },
        { taskText: `Run an adaptive multiplayer quiz covering ${w2Topic}`, isCompleted: false },
        { taskText: `Achieve at least 70% accuracy on intermediate ${w2Topic}`, isCompleted: false }
      ]
    });

    // Week 3: Level up moderate topics
    const w3Topic = moderate[1] || moderate[0] || defaults[2];
    weeks.push({
      weekNumber: 3,
      topic: w3Topic,
      difficulty: 'hard',
      tasks: [
        { taskText: `Take a mixed-difficulty practice drill on ${w3Topic}`, isCompleted: false },
        { taskText: `Review advanced explanation break downs for ${w3Topic}`, isCompleted: false }
      ]
    });

    // Week 4: Reinforce strong topics & do comprehensive practice
    const w4Topic = strong[0] || defaults[3];
    weeks.push({
      weekNumber: 4,
      topic: w4Topic,
      difficulty: 'expert',
      tasks: [
        { taskText: `Maintain expert speed and high confidence on ${w4Topic}`, isCompleted: false },
        { taskText: `Complete a comprehensive evaluation across all active subjects`, isCompleted: false }
      ]
    });

    const studyPlan = await StudyPlan.findOneAndUpdate(
      { userId, active: true },
      {
        userId,
        title: 'Dynamic AI Study Roadmap',
        weeks,
        active: true,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    return studyPlan;
  } catch (err) {
    console.error('[StudyPlanGenerator] Generation failed:', err.message);
    return null;
  }
}

module.exports = {
  generateStudyPlan
};
