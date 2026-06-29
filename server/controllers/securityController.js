const ExamSession = require('../models/examSessionModel');
const SecurityLog = require('../models/securityLogModel');
const ViolationReport = require('../models/violationReportModel');
const ProctoringEvent = require('../models/proctoringEventModel');
const RiskAssessment = require('../models/riskAssessmentModel');
const Attempt = require('../models/attemptModel');
const { logSecurityEvent, autoSubmitQuizAttempt, decryptPayload } = require('../services/securityEngine');

/**
 * Log a security violation or event
 * POST /api/security/log-event
 */
const logEvent = async (req, res) => {
  try {
    let body = req.body;

    // Check if payload is encrypted/obfuscated
    if (req.body.payload) {
      const decrypted = decryptPayload(req.body.payload);
      if (decrypted) {
        body = JSON.parse(decrypted);
      } else {
        return res.status(400).json({ success: false, message: 'Invalid payload signature' });
      }
    }

    const { attemptId, eventType, metadata = {} } = body;
    if (!attemptId || !eventType) {
      return res.status(400).json({ success: false, message: 'Please provide attemptId and eventType' });
    }

    // Capture client IP defensively
    metadata.ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']) || '127.0.0.1';
    metadata.deviceId = (req.headers && req.headers['user-agent']) || 'unknown_agent';

    const result = await logSecurityEvent({
      userId: req.user._id,
      attemptId,
      eventType,
      metadata,
    });

    // Handle Proctoring Camera Snapshots
    if (['FACE_NOT_DETECTED', 'MULTIPLE_FACES_DETECTED', 'CAMERA_DISCONNECT', 'PROCTOR_SNAP'].includes(eventType)) {
      await ProctoringEvent.create({
        userId: req.user._id,
        quizId: metadata.quizId || null,
        attemptId,
        sessionId: result.violations.sessionId,
        snapshotUrl: metadata.snapshotUrl || 'local_stream',
        faceDetected: eventType !== 'FACE_NOT_DETECTED',
        multipleFacesDetected: eventType === 'MULTIPLE_FACES_DETECTED',
        notes: metadata.notes || `Logged event: ${eventType}`,
      });
    }

    // Handle Auto Submission threshold trigger
    if (result.shouldSubmit) {
      const updatedAttempt = await autoSubmitQuizAttempt(attemptId, result.submitReason);

      const io = req.app.get('io');
      if (io) {
        const attemptRoom = `attempt_${attemptId}`;
        const maxViolations = result.maxViolations || 5;
        const totalViolations = result.violations.tabSwitchCount +
                                result.violations.fullscreenExitCount +
                                result.violations.copyPasteCutCount +
                                result.violations.screenshotCount +
                                result.violations.cameraViolationCount;

        io.to(attemptRoom).emit('violation_detected', {
          eventType,
          violationsCount: totalViolations,
          maxViolations,
          securityAlerts: [],
        });
        io.to(attemptRoom).emit('risk_score_updated', {
          riskScore: result.riskScore,
          riskCategory: result.riskCategory,
        });
        io.to(attemptRoom).emit('attempts_remaining_updated', {
          attemptsRemaining: 0,
        });
        io.to(attemptRoom).emit('security-auto-submit', {
          reason: result.submitReason,
        });
        io.to(attemptRoom).emit('exam_terminated', {
          reason: result.submitReason,
        });

        // Admin audit logs sync
        io.to('admin_security').emit('security_status_updated', {
          _id: new (require('mongoose').Types.ObjectId)(),
          userId: { _id: req.user._id, name: req.user.name, email: req.user.email },
          quizId: { _id: attempt.quiz._id, title: attempt.quiz.title },
          eventType,
          timestamp: new Date().toISOString(),
          metadata: { ...metadata, notes: result.submitReason || `Logged event: ${eventType}` },
          riskScore: result.riskScore,
          riskCategory: result.riskCategory,
          violationsCount: totalViolations,
        });
      }

      return res.json({
        success: true,
        autoSubmitted: true,
        reason: result.submitReason,
        attempt: updatedAttempt,
        riskScore: result.riskScore,
        riskCategory: result.riskCategory,
        violations: result.violations,
      });
    }

    const io = req.app.get('io');
    if (io) {
      const attemptRoom = `attempt_${attemptId}`;
      const maxViolations = result.maxViolations || 5;
      const totalViolations = result.violations.tabSwitchCount +
                              result.violations.fullscreenExitCount +
                              result.violations.copyPasteCutCount +
                              result.violations.screenshotCount +
                              result.violations.cameraViolationCount;
      const attemptsRemaining = Math.max(0, maxViolations - totalViolations);

      io.to(attemptRoom).emit('violation_detected', {
        eventType,
        violationsCount: totalViolations,
        maxViolations,
        securityAlerts: [],
      });
      io.to(attemptRoom).emit('risk_score_updated', {
        riskScore: result.riskScore,
        riskCategory: result.riskCategory,
      });
      io.to(attemptRoom).emit('attempts_remaining_updated', {
        attemptsRemaining,
      });

      // Admin audit logs sync
      io.to('admin_security').emit('security_status_updated', {
        _id: new (require('mongoose').Types.ObjectId)(),
        userId: { _id: req.user._id, name: req.user.name, email: req.user.email },
        quizId: { _id: attempt.quiz._id, title: attempt.quiz.title },
        eventType,
        timestamp: new Date().toISOString(),
        metadata: { ...metadata, notes: `Logged event: ${eventType}` },
        riskScore: result.riskScore,
        riskCategory: result.riskCategory,
        violationsCount: totalViolations,
      });
    }

    res.json({
      success: true,
      autoSubmitted: false,
      riskScore: result.riskScore,
      riskCategory: result.riskCategory,
      violations: result.violations,
    });
  } catch (error) {
    console.error('Error logging event:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get active exam session
 * GET /api/security/session/:id
 */
const getSession = async (req, res) => {
  try {
    const session = await ExamSession.findOne({
      $or: [{ attemptId: req.params.id }, { sessionId: req.params.id }],
    }).populate('userId', 'name email');

    if (!session) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }

    // Update heartbeat
    if (session.isActive) {
      session.lastActive = new Date();
      await session.save();
    }

    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch violation reports and assessments
 * GET /api/security/report/:id
 */
const getReport = async (req, res) => {
  try {
    const attemptId = req.params.id;

    const [violationReport, riskAssessment, logs, proctoringEvents] = await Promise.all([
      ViolationReport.findOne({ attemptId }),
      RiskAssessment.findOne({ attemptId }),
      SecurityLog.find({ attemptId }).sort({ timestamp: 1 }),
      ProctoringEvent.find({ attemptId }).sort({ timestamp: 1 }),
    ]);

    if (!violationReport) {
      return res.status(404).json({ success: false, message: 'No security records found for this attempt' });
    }

    res.json({
      success: true,
      report: {
        violations: violationReport,
        risk: riskAssessment || { riskScore: 0, riskCategory: 'Low Risk', riskFactors: [] },
        logs,
        proctoringEvents,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch risk score summary for user
 * GET /api/security/risk-score/:userId
 */
const getRiskScore = async (req, res) => {
  try {
    const assessments = await RiskAssessment.find({ userId: req.params.userId })
      .populate('quizId', 'title topic')
      .sort({ calculatedAt: -1 });

    const latestAssessment = assessments[0] || null;

    res.json({
      success: true,
      latestRiskScore: latestAssessment ? latestAssessment.riskScore : 0,
      latestRiskCategory: latestAssessment ? latestAssessment.riskCategory : 'Low Risk',
      history: assessments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Secure auto submission trigger
 * POST /api/security/auto-submit
 */
const autoSubmit = async (req, res) => {
  try {
    const { attemptId, reason } = req.body;
    if (!attemptId) {
      return res.status(400).json({ success: false, message: 'Please provide attemptId' });
    }

    const attempt = await autoSubmitQuizAttempt(attemptId, reason || 'Manual Admin / Timer Auto Submission');
    res.json({ success: true, message: 'Attempt auto-submitted successfully', attempt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch platform-wide cohort security analytics (Admin Dashboard)
 * GET /api/security/analytics
 */
const getCohortSecurityAnalytics = async (req, res) => {
  try {
    const totalSessions = await ExamSession.countDocuments();
    const highRiskAttempts = await RiskAssessment.countDocuments({ riskCategory: 'High Risk' });
    const mediumRiskAttempts = await RiskAssessment.countDocuments({ riskCategory: 'Medium Risk' });
    const lowRiskAttempts = await RiskAssessment.countDocuments({ riskCategory: 'Low Risk' });

    // Aggregate total violations
    const violationsAggregate = await ViolationReport.aggregate([
      {
        $group: {
          _id: null,
          totalTabSwitches: { $sum: '$tabSwitchCount' },
          totalFocusLoss: { $sum: '$focusLossCount' },
          totalCopyPaste: { $sum: '$copyPasteCutCount' },
          totalRightClicks: { $sum: '$rightClickCount' },
          totalScreenshots: { $sum: '$screenshotCount' },
          totalFullscreenExits: { $sum: '$fullscreenExitCount' },
          totalCameraViolations: { $sum: '$cameraViolationCount' },
        },
      },
    ]);

    const aggregates = violationsAggregate[0] || {
      totalTabSwitches: 0,
      totalFocusLoss: 0,
      totalCopyPaste: 0,
      totalRightClicks: 0,
      totalScreenshots: 0,
      totalFullscreenExits: 0,
      totalCameraViolations: 0,
    };

    // Find suspicious students (risk > 70)
    const suspiciousList = await RiskAssessment.find({ riskScore: { $gt: 50 } })
      .populate('userId', 'name email')
      .populate('quizId', 'title')
      .sort({ riskScore: -1 })
      .limit(10);

    // Get chronological timeline of recent violations
    const recentIncidents = await SecurityLog.find({ eventType: { $ne: 'SESSION_TIMEOUT' } })
      .populate('userId', 'name email')
      .populate('quizId', 'title')
      .sort({ timestamp: -1 })
      .limit(20);

    res.json({
      success: true,
      summary: {
        totalSessions,
        riskDistribution: {
          low: lowRiskAttempts,
          medium: mediumRiskAttempts,
          high: highRiskAttempts,
        },
        violations: aggregates,
      },
      suspiciousList,
      recentIncidents,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 7-day violation & risk trends for admin dashboard
 * GET /api/security/analytics/trends
 */
const getAnalyticsTrends = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Daily violation counts grouped by date
    const dailyViolations = await SecurityLog.aggregate([
      {
        $match: {
          timestamp: { $gte: since },
          eventType: {
            $nin: ['SECURITY_HEARTBEAT', 'PROCTOR_SNAP', 'CAMERA_PERMISSION_GRANTED'],
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          total: { $sum: 1 },
          tabSwitches: {
            $sum: { $cond: [{ $eq: ['$eventType', 'TAB_SWITCH'] }, 1, 0] },
          },
          focusLoss: {
            $sum: { $cond: [{ $eq: ['$eventType', 'FOCUS_LOSS'] }, 1, 0] },
          },
          fullscreenExits: {
            $sum: { $cond: [{ $eq: ['$eventType', 'FULLSCREEN_EXIT'] }, 1, 0] },
          },
          copyPaste: {
            $sum: {
              $cond: [
                { $in: ['$eventType', ['COPY_ATTEMPT', 'PASTE_ATTEMPT', 'CUT_ATTEMPT']] },
                1, 0,
              ],
            },
          },
          cameraEvents: {
            $sum: {
              $cond: [
                { $in: ['$eventType', ['FACE_NOT_DETECTED', 'MULTIPLE_FACES_DETECTED']] },
                1, 0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Daily average risk scores
    const dailyRisk = await RiskAssessment.aggregate([
      { $match: { calculatedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$calculatedAt' } },
          avgRisk: { $avg: '$riskScore' },
          maxRisk: { $max: '$riskScore' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill in missing days with zero values
    const dateMap = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dateMap[key] = {
        date: key,
        total: 0,
        tabSwitches: 0,
        focusLoss: 0,
        fullscreenExits: 0,
        copyPaste: 0,
        cameraEvents: 0,
        avgRisk: 0,
        maxRisk: 0,
      };
    }
    dailyViolations.forEach((d) => {
      if (dateMap[d._id]) Object.assign(dateMap[d._id], d, { date: d._id });
    });
    dailyRisk.forEach((d) => {
      if (dateMap[d._id]) {
        dateMap[d._id].avgRisk = Math.round(d.avgRisk);
        dateMap[d._id].maxRisk = d.maxRisk;
      }
    });

    // Hourly distribution for heatmap (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const hourlyHeatmap = await SecurityLog.aggregate([
      {
        $match: {
          timestamp: { $gte: thirtyDaysAgo },
          eventType: { $nin: ['SECURITY_HEARTBEAT', 'PROCTOR_SNAP', 'CAMERA_PERMISSION_GRANTED'] },
        },
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$timestamp' },
            eventType: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.hour': 1 } },
    ]);

    res.json({
      success: true,
      trends: Object.values(dateMap),
      hourlyHeatmap,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Per-student security report (admin drill-down)
 * GET /api/security/student-report/:userId
 */
const getStudentSecurityReport = async (req, res) => {
  try {
    const { userId } = req.params;

    // All risk assessments for this student
    const assessments = await RiskAssessment.find({ userId })
      .populate('quizId', 'title')
      .populate('attemptId', 'percentage isCompleted createdAt')
      .sort({ calculatedAt: -1 });

    // All violation reports for this student
    const violations = await ViolationReport.find({ userId })
      .populate('quizId', 'title')
      .sort({ createdAt: -1 });

    // Recent security log events
    const recentLogs = await SecurityLog.find({ userId })
      .populate('quizId', 'title')
      .sort({ timestamp: -1 })
      .limit(50);

    // Aggregate totals across all attempts
    const totalViolationAgg = await ViolationReport.aggregate([
      { $match: { userId: new (require('mongoose').Types.ObjectId)(userId) } },
      {
        $group: {
          _id: null,
          tabSwitches: { $sum: '$tabSwitchCount' },
          focusLoss: { $sum: '$focusLossCount' },
          copyPaste: { $sum: '$copyPasteCutCount' },
          screenshots: { $sum: '$screenshotCount' },
          fullscreenExits: { $sum: '$fullscreenExitCount' },
          cameraViolations: { $sum: '$cameraViolationCount' },
          examCount: { $sum: 1 },
        },
      },
    ]);

    const averageRisk =
      assessments.length > 0
        ? Math.round(assessments.reduce((s, a) => s + a.riskScore, 0) / assessments.length)
        : 0;
    const highRiskExams = assessments.filter((a) => a.riskCategory === 'High Risk').length;

    res.json({
      success: true,
      report: {
        assessments,
        violations,
        recentLogs,
        summary: {
          totalExams: assessments.length,
          averageRisk,
          highRiskExams,
          ...(totalViolationAgg[0] || {}),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  logEvent,
  getSession,
  getReport,
  getRiskScore,
  autoSubmit,
  getCohortSecurityAnalytics,
  getAnalyticsTrends,
  getStudentSecurityReport,
};
