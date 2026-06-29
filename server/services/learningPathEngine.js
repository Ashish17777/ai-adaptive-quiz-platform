/**
 * Learning Path Engine
 * Builds a sequential, personalized learning roadmap based on topic mastery.
 * Uses a topic dependency graph — no API key required.
 */

/**
 * Topic dependency graph: topic → prerequisite topics
 * Extend this map to add more subject relationships.
 */
const TOPIC_DEPENDENCIES = {
  // Mathematics progression
  'arithmetic': [],
  'algebra': ['arithmetic'],
  'geometry': ['arithmetic'],
  'functions': ['algebra'],
  'trigonometry': ['geometry', 'functions'],
  'statistics': ['arithmetic', 'algebra'],
  'probability': ['statistics'],
  'calculus': ['functions', 'trigonometry'],
  'linear algebra': ['algebra'],
  'data interpretation': ['statistics', 'probability'],
  'advanced algebra': ['algebra', 'functions'],
  'number theory': ['arithmetic', 'algebra'],

  // Science
  'physics': ['arithmetic', 'algebra'],
  'chemistry': ['arithmetic'],
  'biology': [],
  'mechanics': ['physics'],
  'thermodynamics': ['physics'],

  // General / SAT
  'vocabulary': [],
  'reading comprehension': ['vocabulary'],
  'critical reasoning': ['reading comprehension'],
  'essay writing': ['reading comprehension'],
};

const TOPIC_ORDER = [
  'arithmetic', 'vocabulary', 'biology', 'chemistry',
  'algebra', 'geometry', 'reading comprehension',
  'functions', 'statistics', 'physics',
  'trigonometry', 'probability', 'critical reasoning',
  'linear algebra', 'mechanics', 'data interpretation',
  'advanced algebra', 'number theory', 'thermodynamics',
  'calculus', 'essay writing',
];

/**
 * Get a sorted path of topics from weakest to strongest prerequisite order.
 * @param {Array} topicMasteryRecords - Array of { topic, accuracy, status }
 * @param {Array} allTopicsInBank - All topics available in the question bank
 * @returns {Object} Learning path steps and metadata
 */
function buildLearningPath(topicMasteryRecords = [], allTopicsInBank = []) {
  // Build a lookup of mastery by topic
  const masteryMap = {};
  topicMasteryRecords.forEach((r) => {
    masteryMap[r.topic] = r;
  });

  const studiedTopics = new Set(topicMasteryRecords.map(r => r.topic));
  const bankTopics = new Set(allTopicsInBank.map(t => t.toLowerCase()));

  // Combine studied topics + available topics in bank for the path
  const allRelevantTopics = new Set([...studiedTopics, ...bankTopics]);

  // Determine overall level
  let masteredCount = 0;
  let intermediateCount = 0;
  topicMasteryRecords.forEach(r => {
    if (r.status === 'mastered') masteredCount++;
    else if (r.status === 'intermediate') intermediateCount++;
  });

  let currentLevel = 'beginner';
  if (masteredCount >= 3 || (masteredCount >= 2 && intermediateCount >= 2)) {
    currentLevel = 'advanced';
  } else if (masteredCount >= 1 || intermediateCount >= 2) {
    currentLevel = 'intermediate';
  }

  // Sort topics by predefined order, prioritize topics in bank
  const orderedTopics = [];

  // First add topics from predefined order that are in the bank or studied
  TOPIC_ORDER.forEach(t => {
    if (allRelevantTopics.has(t)) {
      orderedTopics.push(t);
    }
  });

  // Add any remaining studied/bank topics not in predefined list
  allRelevantTopics.forEach(t => {
    if (!orderedTopics.includes(t)) {
      orderedTopics.push(t);
    }
  });

  // Build path steps with status
  const steps = orderedTopics.slice(0, 12).map((topic, idx) => {
    const mastery = masteryMap[topic];
    let status = 'upcoming';

    if (mastery) {
      if (mastery.status === 'mastered') status = 'completed';
      else status = 'current'; // studied but not mastered = work in progress
    } else if (idx === 0 || (orderedTopics[idx - 1] && masteryMap[orderedTopics[idx - 1]]?.status === 'mastered')) {
      status = 'current'; // first unstudied topic after mastered ones
    }

    return {
      topic,
      order: idx + 1,
      status,
      accuracy: mastery?.accuracy || 0,
    };
  });

  // Ensure at least one 'current' step exists
  const hasCurrentStep = steps.some(s => s.status === 'current');
  if (!hasCurrentStep && steps.length > 0) {
    const firstNonCompleted = steps.find(s => s.status !== 'completed');
    if (firstNonCompleted) firstNonCompleted.status = 'current';
  }

  const weakTopics = topicMasteryRecords
    .filter(r => r.status === 'weak')
    .map(r => r.topic);

  const recommendedTopics = topicMasteryRecords
    .filter(r => r.status === 'weak' || r.status === 'intermediate')
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4)
    .map(r => r.topic);

  const strengths = topicMasteryRecords
    .filter(r => r.status === 'mastered')
    .map(r => r.topic);

  return {
    currentLevel,
    steps,
    weakTopics,
    recommendedTopics,
    strengths,
  };
}

module.exports = { buildLearningPath, TOPIC_DEPENDENCIES, TOPIC_ORDER };
