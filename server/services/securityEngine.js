const crypto = require('crypto');
const mongoose = require('mongoose');
const ExamSession = require('../models/examSessionModel');
const SecurityLog = require('../models/securityLogModel');
const ViolationReport = require('../models/violationReportModel');
const RiskAssessment = require('../models/riskAssessmentModel');
const Attempt = require('../models/attemptModel');
const Question = require('../models/questionModel');

// AES Encryption Constants
const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.SESSION_ENCRYPTION_KEY || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'; // 32 bytes
const IV_LENGTH = 16;

/**
 * Encrypts a string payload using AES-256-CBC
 */
function encryptPayload(text) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption error:', err);
    return text;
  }
}

/**
 * Decrypts an AES-256-CBC encrypted payload
 */
function decryptPayload(text) {
  try {
    // 1. Try custom XOR decryption
    const raw = Buffer.from(text, 'base64').toString('utf8');
    const key = "ai-quiz-secure-token";
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      result += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    // Verify it is JSON
    JSON.parse(result);
    return result;
  } catch (err) {
    // 2. Fall back to standard AES
    try {
      const textParts = text.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedText = Buffer.from(textParts.join(':'), 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (aesErr) {
      console.error('Decryption error (XOR & AES failed):', aesErr);
      return null;
    }
  }
}

/**
 * Calculates a cheating risk score (0-100) based on violation events.
 */
function calculateCheatingRiskScore(report) {
  let riskScore = 0;
  const factors = [];

  if (report.tabSwitchCount > 0) {
    const w = Math.min(report.tabSwitchCount * 15, 30);
    riskScore += w;
    factors.push({ factor: 'Tab Switches', weight: w });
  }
  if (report.focusLossCount > 0) {
    const w = Math.min(report.focusLossCount * 10, 20);
    riskScore += w;
    factors.push({ factor: 'Focus Loss', weight: w });
  }
  if (report.copyPasteCutCount > 0) {
    const w = Math.min(report.copyPasteCutCount * 15, 25);
    riskScore += w;
    factors.push({ factor: 'Copy/Paste/Cut Attempts', weight: w });
  }
  if (report.rightClickCount > 0) {
    const w = Math.min(report.rightClickCount * 10, 15);
    riskScore += w;
    factors.push({ factor: 'Right Click Attempts', weight: w });
  }
  if (report.screenshotCount > 0) {
    const w = Math.min(report.screenshotCount * 25, 50);
    riskScore += w;
    factors.push({ factor: 'Screenshot Attempts', weight: w });
  }
  if (report.fullscreenExitCount > 0) {
    const w = Math.min(report.fullscreenExitCount * 30, 60);
    riskScore += w;
    factors.push({ factor: 'Fullscreen Exits', weight: w });
  }
  if (report.cameraViolationCount > 0) {
    const w = Math.min(report.cameraViolationCount * 35, 70);
    riskScore += w;
    factors.push({ factor: 'Camera Face Detection Violations', weight: w });
  }

  riskScore = Math.min(riskScore, 100);
  let riskCategory = 'Low Risk';
  if (riskScore > 70) {
    riskCategory = 'High Risk';
  } else if (riskScore > 35) {
    riskCategory = 'Medium Risk';
  }

  return { riskScore, riskCategory, riskFactors: factors };
}

/**
 * Registers an integrity event, updates metrics, and checks threshold logic.
 */
async function logSecurityEvent({ userId, attemptId, eventType, metadata = {} }) {
  const attempt = await Attempt.findById(attemptId).populate('quiz');
  if (!attempt) throw new Error('Attempt not found');

  // Find or Create ExamSession
  let session = await ExamSession.findOne({ attemptId, isActive: true });
  if (!session) {
    session = await ExamSession.create({
      userId,
      quizId: attempt.quiz._id,
      attemptId,
      sessionId: 'sess_' + attemptId + '_' + Date.now(),
      deviceId: metadata.deviceId || 'unknown_device',
      ipAddress: metadata.ipAddress || '127.0.0.1',
      allowedTabSwitches: attempt.quiz.securitySettings?.allowedTabSwitches ?? 3,
      fullScreenEnforced: attempt.quiz.securitySettings?.fullScreenEnforced ?? false,
      cameraMonitoring: attempt.quiz.securitySettings?.cameraMonitoring ?? false,
      autoSubmitThreshold: attempt.quiz.securitySettings?.violationLimits ?? 5,
    });
  }

  session.lastActive = new Date();
  await session.save();

  // Log to audit log
  await SecurityLog.create({
    userId,
    quizId: attempt.quiz._id,
    attemptId,
    sessionId: session.sessionId,
    eventType,
    metadata,
  });

  // Find or Create ViolationReport
  let report = await ViolationReport.findOne({ attemptId });
  if (!report) {
    report = await ViolationReport.create({
      userId,
      quizId: attempt.quiz._id,
      attemptId,
      sessionId: session.sessionId,
    });
  }

  let shouldSubmit = false;
  let submitReason = '';

  if (eventType === 'TAB_SWITCH') {
    report.tabSwitchCount += 1;
    if (report.tabSwitchCount > session.allowedTabSwitches) {
      shouldSubmit = true;
      submitReason = `Exceeded allowed tab switches (${report.tabSwitchCount}/${session.allowedTabSwitches})`;
    }
  } else if (eventType === 'FOCUS_LOSS') {
    report.focusLossCount += 1;
  } else if (eventType === 'COPY_ATTEMPT' || eventType === 'PASTE_ATTEMPT' || eventType === 'CUT_ATTEMPT') {
    report.copyPasteCutCount += 1;
  } else if (eventType === 'RIGHT_CLICK_ATTEMPT') {
    report.rightClickCount += 1;
  } else if (eventType === 'SCREENSHOT_ATTEMPT') {
    report.screenshotCount += 1;
  } else if (eventType === 'FULLSCREEN_EXIT') {
    report.fullscreenExitCount += 1;
    if (session.fullScreenEnforced && report.fullscreenExitCount > 1) {
      shouldSubmit = true;
      submitReason = 'Exited full screen mode in an enforced lockdown';
    }
  } else if (['FACE_NOT_DETECTED', 'MULTIPLE_FACES_DETECTED', 'CAMERA_DISCONNECT', 'CAMERA_PERMISSION_DENIED'].includes(eventType)) {
    report.cameraViolationCount += 1;
  } else if (['SECURITY_HEARTBEAT', 'PROCTOR_SNAP', 'CAMERA_PERMISSION_GRANTED', 'IDLE_DETECTED'].includes(eventType)) {
    // Non-violation monitoring events — only update heartbeat, skip violation counter
    await report.save();
    const { riskScore, riskCategory, riskFactors } = calculateCheatingRiskScore(report);
    await RiskAssessment.findOneAndUpdate(
      { attemptId },
      { userId, quizId: attempt.quiz._id, attemptId, sessionId: session.sessionId, riskScore, riskCategory, riskFactors, calculatedAt: new Date() },
      { upsert: true, new: true }
    );
    return { shouldSubmit: false, riskScore, riskCategory, violations: report, maxViolations: session.autoSubmitThreshold };
  }

  report.lastViolationTime = new Date();
  await report.save();

  // Recalculate Risk Score
  const { riskScore, riskCategory, riskFactors } = calculateCheatingRiskScore(report);
  await RiskAssessment.findOneAndUpdate(
    { attemptId },
    {
      userId,
      quizId: attempt.quiz._id,
      attemptId,
      sessionId: session.sessionId,
      riskScore,
      riskCategory,
      riskFactors,
      calculatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // Auto Submission Check
  const totalViolations =
    report.tabSwitchCount +
    report.fullscreenExitCount +
    report.copyPasteCutCount +
    report.screenshotCount +
    report.cameraViolationCount;

  if (totalViolations >= session.autoSubmitThreshold) {
    shouldSubmit = true;
    submitReason = `Exceeded overall violation threshold (${totalViolations}/${session.autoSubmitThreshold})`;
  }

  return {
    shouldSubmit,
    submitReason,
    riskScore,
    riskCategory,
    violations: report,
    maxViolations: session.autoSubmitThreshold,
  };
}

/**
 * Auto-submits a quiz attempt due to expiration or violation limits.
 */
async function autoSubmitQuizAttempt(attemptId, reason) {
  const attempt = await Attempt.findById(attemptId);
  if (!attempt) throw new Error('Attempt not found');
  if (attempt.isCompleted) return attempt;

  attempt.isCompleted = true;

  // Grade what is answered, set rest to unanswered (-1)
  const questions = await Question.find({ _id: { $in: attempt.questionsOrder } });
  const questionMap = {};
  questions.forEach((q) => {
    questionMap[q._id.toString()] = q;
  });

  const answersCount = attempt.answers.length;
  const questionsCount = attempt.questionsOrder.length;

  for (let i = answersCount; i < questionsCount; i++) {
    attempt.answers.push(-1);
  }

  const finalResponses = [];
  attempt.questionsOrder.forEach((qId, idx) => {
    const question = questionMap[qId.toString()];
    if (!question) return;

    let existingResp = attempt.responses[idx];
    if (existingResp && existingResp.selectedAnswer !== undefined) {
      existingResp.isCorrect = question.correctAnswer === existingResp.selectedAnswer;
      finalResponses.push(existingResp);
    } else {
      const studentAnswer = attempt.answers[idx] !== undefined ? attempt.answers[idx] : -1;
      const isCorrect = studentAnswer !== -1 && question.correctAnswer === studentAnswer;
      finalResponses.push({
        questionId: question._id,
        selectedAnswer: studentAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        confidenceLevel: 'medium',
        timeTaken: 0,
        difficulty: question.difficulty,
        topic: question.topic,
        optionOrder: existingResp?.optionOrder || [0, 1, 2, 3],
      });
    }
  });

  attempt.responses = finalResponses;

  let scoreCount = 0;
  attempt.responses.forEach((r) => {
    if (r.isCorrect) scoreCount++;
  });

  attempt.score = scoreCount;
  attempt.totalQuestions = attempt.questionsOrder.length;
  attempt.percentage = attempt.totalQuestions > 0 ? Math.round((scoreCount / attempt.totalQuestions) * 100) : 0;

  await ExamSession.updateOne(
    { attemptId, isActive: true },
    { isActive: false, isAutoSubmitted: true, autoSubmitReason: reason }
  );

  await attempt.save();

  // Trigger post quiz AI
  try {
    const { triggerPostQuizAI } = require('../controllers/aiController');
    if (triggerPostQuizAI) {
      triggerPostQuizAI(attempt.user, attempt._id).catch((err) => {
        console.error('Error triggering post-quiz AI after auto-submit:', err);
      });
    }
  } catch (err) {
    console.error('triggerPostQuizAI import error:', err);
  }

  return attempt;
}

module.exports = {
  encryptPayload,
  decryptPayload,
  calculateCheatingRiskScore,
  logSecurityEvent,
  autoSubmitQuizAttempt,
};
