/**
 * Phase 9 — Student Segmentation Engine
 * Classifies each student into one of 5 segments based on performance thresholds.
 */

const Attempt = require('../models/attemptModel');
const StudentProfile = require('../models/studentProfileModel');
const User = require('../models/userModel');
const ViolationReport = require('../models/violationReportModel');

const SEGMENTS = {
  HIGH_PERFORMER: 'High Performer',
  FAST_IMPROVER: 'Fast Improver',
  CONSISTENT_LEARNER: 'Consistent Learner',
  LOW_CONFIDENCE: 'Low Confidence Learner',
  AT_RISK: 'At-Risk Student',
};

function calcVariance(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
}

function calcVelocity(attempts) {
  if (attempts.length < 2) return 0;
  const sorted = [...attempts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const half = Math.ceil(sorted.length / 2);
  const earlyAvg = sorted.slice(0, half).reduce((s, a) => s + a.percentage, 0) / half;
  const lateAvg = sorted.slice(half).reduce((s, a) => s + a.percentage, 0) / (sorted.length - half || 1);
  return lateAvg - earlyAvg;
}

/**
 * Classify a single student into a segment
 */
function classifyStudent(attempts, profile, totalViolations) {
  if (!attempts || !attempts.length) {
    return { segment: SEGMENTS.AT_RISK, reason: 'No quiz activity' };
  }

  const avgAccuracy = attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length;
  const avgConfidence = attempts.reduce((s, a) => s + (a.averageConfidence || 0), 0) / attempts.length;
  const velocity = calcVelocity(attempts);
  const scores = attempts.map((a) => a.percentage);
  const variance = calcVariance(scores);
  const consistency = Math.max(0, 100 - variance);

  const totalUnderconfidence = attempts.reduce((sum, a) => sum + (a.underconfidenceCount || 0), 0);
  const avgUnderconfidence = totalUnderconfidence / attempts.length;

  // 1. High Performers: Accuracy > 85%
  if (avgAccuracy > 85) {
    return { segment: SEGMENTS.HIGH_PERFORMER, avgAccuracy, velocity, consistency };
  }

  // 2. At Risk Students: Low accuracy (< 55%) OR High violation rate (> 4 total violations) OR Low engagement (attempts.length < 2)
  if (avgAccuracy < 55 || totalViolations > 4 || attempts.length < 2) {
    return { segment: SEGMENTS.AT_RISK, avgAccuracy, velocity, consistency };
  }

  // 3. Fast Improvers: Significant score improvement (velocity >= 10, attempts.length >= 2)
  if (velocity >= 10 && attempts.length >= 2) {
    return { segment: SEGMENTS.FAST_IMPROVER, avgAccuracy, velocity, consistency };
  }

  // 4. Low Confidence Learners: High underconfidence (avgUnderconfidence >= 1.5 or totalUnderconfidence > 3)
  if (avgUnderconfidence >= 1.5 || totalUnderconfidence > 3) {
    return { segment: SEGMENTS.LOW_CONFIDENCE, avgAccuracy, velocity, consistency };
  }

  // 5. Consistent Learners
  return { segment: SEGMENTS.CONSISTENT_LEARNER, avgAccuracy, velocity, consistency };
}

/**
 * Segment all students — returns grouped structure
 */
async function segmentAllStudents() {
  const students = await User.find({ role: 'student' }).lean();
  if (!students.length) return {};

  const results = [];

  for (const student of students) {
    const attempts = await Attempt.find({ user: student._id, isCompleted: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    // Fetch total violations across all attempts for this student
    const violations = await ViolationReport.find({ userId: student._id }).lean();
    const totalViolations = violations.reduce(
      (sum, v) =>
        sum +
        ((v.tabSwitchCount || 0) +
          (v.fullscreenExitCount || 0) +
          (v.copyPasteCutCount || 0) +
          (v.screenshotCount || 0) +
          (v.cameraViolationCount || 0)),
      0
    );

    const profile = await StudentProfile.findOne({ userId: student._id }).lean();
    const classification = classifyStudent(attempts, profile, totalViolations);

    results.push({
      userId: student._id,
      name: student.name,
      email: student.email,
      totalAttempts: attempts.length,
      avgAccuracy: Math.round(classification.avgAccuracy || 0),
      velocity: Math.round(classification.velocity || 0),
      consistency: Math.round(classification.consistency || 0),
      segment: classification.segment,
      reason: classification.reason,
    });
  }

  // Group by segment
  const grouped = {};
  Object.values(SEGMENTS).forEach((seg) => { grouped[seg] = []; });
  results.forEach((r) => {
    if (grouped[r.segment]) grouped[r.segment].push(r);
  });

  // Summary counts
  const summary = {};
  Object.keys(grouped).forEach((seg) => { summary[seg] = grouped[seg].length; });

  return { grouped, summary, total: results.length };
}

module.exports = { segmentAllStudents, classifyStudent, SEGMENTS };
