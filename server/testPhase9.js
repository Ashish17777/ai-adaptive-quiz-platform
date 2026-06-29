const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Disable command buffering
mongoose.set('bufferCommands', false);

// Load env variables
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const User = require('./models/userModel');
const Attempt = require('./models/attemptModel');
const Question = require('./models/questionModel');
const Quiz = require('./models/quizModel');
const ExamSession = require('./models/examSessionModel');
const SecurityLog = require('./models/securityLogModel');
const ViolationReport = require('./models/violationReportModel');

const { classifyStudent, SEGMENTS } = require('./services/segmentationEngine');
const { getDashboardDrillDown } = require('./controllers/analyticsController');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ Passed: ${message}`);
}

// In-memory mock store for fallback stubs
const store = {
  users: [],
  attempts: [],
  quizzes: [],
  questions: [],
  examSessions: [],
  securityLogs: [],
  violationReports: [],
};

function stubMongoose() {
  console.log('\n============================================================');
  console.log('ℹ️  Atlas/local MongoDB not reachable. Stubbing Mongoose...');
  console.log('============================================================\n');

  const mockQuery = (data) => {
    const qObj = {
      populate: () => qObj,
      sort: () => qObj,
      limit: () => qObj,
      lean: () => qObj,
      then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
      catch: (resolve, reject) => Promise.resolve(data).catch(resolve, reject),
    };
    return qObj;
  };

  // Stub model find, count, save etc.
  User.find = (q) => {
    let result = store.users;
    if (q && q.role) result = result.filter(u => u.role === q.role);
    return mockQuery(result);
  };
  User.countDocuments = (q) => Promise.resolve(store.users.filter(u => !q.role || u.role === q.role).length);

  Attempt.find = (q) => {
    let result = store.attempts;
    if (q && q.user) result = result.filter(a => a.user.toString() === q.user.toString());
    if (q && q.isCompleted !== undefined) result = result.filter(a => a.isCompleted === q.isCompleted);
    return mockQuery(result);
  };
  Attempt.countDocuments = (q) => {
    let result = store.attempts;
    if (q && q.quiz) result = result.filter(a => a.quiz.toString() === q.quiz.toString());
    if (q && q.isCompleted !== undefined) result = result.filter(a => a.isCompleted === q.isCompleted);
    return Promise.resolve(result.length);
  };

  Quiz.find = () => mockQuery(store.quizzes);
  Quiz.countDocuments = () => Promise.resolve(store.quizzes.length);

  Question.find = (q) => {
    let result = store.questions;
    if (q && q.generatedByAI !== undefined) result = result.filter(x => x.generatedByAI === q.generatedByAI);
    return mockQuery(result);
  };
  Question.countDocuments = (q) => {
    let result = store.questions;
    if (q && q.generatedByAI !== undefined) result = result.filter(x => x.generatedByAI === q.generatedByAI);
    return Promise.resolve(result.length);
  };

  ExamSession.find = (q) => {
    let result = store.examSessions;
    if (q && q.isActive !== undefined) result = result.filter(s => s.isActive === q.isActive);
    return mockQuery(result);
  };
  ExamSession.countDocuments = (q) => {
    let result = store.examSessions;
    if (q && q.isActive !== undefined) result = result.filter(s => s.isActive === q.isActive);
    return Promise.resolve(result.length);
  };

  SecurityLog.find = (q) => {
    let result = store.securityLogs;
    if (q && q.eventType && q.eventType.$nin) {
      result = result.filter(log => !q.eventType.$nin.includes(log.eventType));
    }
    return mockQuery(result);
  };
  SecurityLog.countDocuments = () => Promise.resolve(store.securityLogs.length);

  ViolationReport.find = (q) => {
    let result = store.violationReports;
    if (q && q.userId) result = result.filter(r => r.userId.toString() === q.userId.toString());
    return mockQuery(result);
  };
}

async function runTests() {
  console.log('=== STARTING PHASE 9 AUTOMATED TESTS ===\n');

  let dbConnected = false;
  stubMongoose();

  try {
    // ----------------------------------------------------
    // TEST 1: Student Segmentation Rules Classification
    // ----------------------------------------------------
    console.log('\nRunning TEST 1: Segmentation Rules verification...');
    
    // Stub Student A: Accuracy > 85% => High Performer
    const studentAAttempts = [{ percentage: 90, averageConfidence: 0.8, underconfidenceCount: 0 }];
    const classA = classifyStudent(studentAAttempts, null, 0);
    assert(classA.segment === SEGMENTS.HIGH_PERFORMER, 'High Performer correctly classified (>85% accuracy)');

    // Stub Student B: Accuracy < 55% => At Risk
    const studentBAttempts = [{ percentage: 50, averageConfidence: 0.6, underconfidenceCount: 0 }];
    const classB = classifyStudent(studentBAttempts, null, 0);
    assert(classB.segment === SEGMENTS.AT_RISK, 'At-Risk classified due to low accuracy (<55%)');

    // Stub Student C: High violations (>4) => At Risk
    const studentCAttempts = [{ percentage: 70, averageConfidence: 0.6, underconfidenceCount: 0 }, { percentage: 75, averageConfidence: 0.6 }];
    const classC = classifyStudent(studentCAttempts, null, 5); // 5 violations
    assert(classC.segment === SEGMENTS.AT_RISK, 'At-Risk classified due to high violations (>4)');

    // Stub Student D: Low activity (<2 attempts) => At Risk
    const studentDAttempts = [{ percentage: 75, averageConfidence: 0.6, underconfidenceCount: 0 }];
    const classD = classifyStudent(studentDAttempts, null, 0);
    assert(classD.segment === SEGMENTS.AT_RISK, 'At-Risk classified due to low activity (<2 attempts)');

    // Stub Student E: Significant improvement (velocity >= 10, attempts >= 2) => Fast Improver
    const studentEAttempts = [
      { percentage: 80, createdAt: new Date() },
      { percentage: 60, createdAt: new Date(Date.now() - 3600000) }
    ];
    const classE = classifyStudent(studentEAttempts, null, 0);
    assert(classE.segment === SEGMENTS.FAST_IMPROVER, 'Fast Improver classified due to velocity improvement (>=10%)');

    // Stub Student F: High underconfidence (avg underconfidence count >= 1.5 or total > 3) => Low Confidence
    const studentFAttempts = [
      { percentage: 70, underconfidenceCount: 2 },
      { percentage: 72, underconfidenceCount: 2 }
    ];
    const classF = classifyStudent(studentFAttempts, null, 0);
    assert(classF.segment === SEGMENTS.LOW_CONFIDENCE, 'Low Confidence classified due to high underconfidence count');

    // Stub Student G: Regular activity and stable performance => Consistent Learner
    const studentGAttempts = [
      { percentage: 75, averageConfidence: 0.7, underconfidenceCount: 0 },
      { percentage: 77, averageConfidence: 0.7, underconfidenceCount: 0 }
    ];
    const classG = classifyStudent(studentGAttempts, null, 0);
    assert(classG.segment === SEGMENTS.CONSISTENT_LEARNER, 'Consistent Learner classified as default fallback');

    // ----------------------------------------------------
    // TEST 2: Dashboard Drilldown Controller
    // ----------------------------------------------------
    console.log('\nRunning TEST 2: Dashboard Drilldown Controller checks...');
    
    // Seed some mock data in store
    const mockStudentUser = { _id: new mongoose.Types.ObjectId(), name: 'Test Student', email: 'test@student.com', role: 'student', createdAt: new Date() };
    const mockQuiz = { _id: new mongoose.Types.ObjectId(), title: 'Test Quiz', topic: 'Maths', isAdaptive: true, questions: [1, 2, 3], createdBy: mockStudentUser, createdAt: new Date() };
    const mockQuestion = { _id: new mongoose.Types.ObjectId(), questionText: 'What is 1+1?', options: ['1','2','3','4'], correctAnswer: 1, difficulty: 'easy', topic: 'arithmetic', generatedByAI: true, createdBy: mockStudentUser };
    const mockSession = { _id: new mongoose.Types.ObjectId(), userId: mockStudentUser, quizId: mockQuiz, attemptId: new mongoose.Types.ObjectId(), loginTime: new Date(), lastActive: new Date(), isActive: true, allowedTabSwitches: 3, autoSubmitThreshold: 5 };
    const mockLog = { _id: new mongoose.Types.ObjectId(), userId: mockStudentUser, quizId: mockQuiz, attemptId: new mongoose.Types.ObjectId(), eventType: 'TAB_SWITCH', timestamp: new Date(), metadata: { notes: 'Tab changed' } };
    
    store.users = [mockStudentUser];
    store.quizzes = [mockQuiz];
    store.questions = [mockQuestion];
    store.examSessions = [mockSession];
    store.securityLogs = [mockLog];

    // Mock Express Request & Response for getDashboardDrillDown
    const mockRes = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.data = data;
        return this;
      }
    };

    // Test students metric drilldown
    const reqStudents = { query: { metric: 'students' } };
    await getDashboardDrillDown(reqStudents, mockRes);
    assert(mockRes.data.success === true, 'students drilldown endpoint returned success');
    assert(mockRes.data.list.length > 0, 'students drilldown returned student objects');
    assert(mockRes.data.list[0].email === 'test@student.com', 'student object has name/email properties');

    // Test quizzes metric drilldown
    const reqQuizzes = { query: { metric: 'quizzes' } };
    await getDashboardDrillDown(reqQuizzes, mockRes);
    assert(mockRes.data.success === true, 'quizzes drilldown endpoint returned success');
    assert(mockRes.data.list[0].title === 'Test Quiz', 'quiz details mapped correctly');

    // Test active-exams drilldown
    const reqActiveExams = { query: { metric: 'active-exams' } };
    await getDashboardDrillDown(reqActiveExams, mockRes);
    assert(mockRes.data.success === true, 'active-exams drilldown returned success');
    assert(mockRes.data.list[0].studentName === 'Test Student', 'active exams populated student reference');

    // Test violations drilldown
    const reqViolations = { query: { metric: 'violations' } };
    await getDashboardDrillDown(reqViolations, mockRes);
    assert(mockRes.data.success === true, 'violations drilldown returned success');
    assert(mockRes.data.list[0].eventType === 'TAB_SWITCH', 'violations logs mapped event types');

    // Test ai-questions drilldown
    const reqAIQuestions = { query: { metric: 'ai-questions' } };
    await getDashboardDrillDown(reqAIQuestions, mockRes);
    assert(mockRes.data.success === true, 'ai-questions drilldown returned success');
    assert(mockRes.data.list[0].difficulty === 'easy', 'AI generated questions returned correct schema');

    // ----------------------------------------------------
    // TEST 3: Real-time Socket.IO Broadcast Emissions
    // ----------------------------------------------------
    console.log('\nRunning TEST 3: Socket.IO security room emissions verify...');

    // Stub Socket.IO Server & Socket
    let socketRooms = {};
    let emittedEvents = {};

    const mockIo = {
      on: function(event, callback) {
        if (event === 'connection') {
          callback(mockSocket);
        }
      },
      to: function(roomName) {
        socketRooms[roomName] = socketRooms[roomName] || [];
        return {
          emit: (event, payload) => {
            emittedEvents[event] = emittedEvents[event] || [];
            emittedEvents[event].push({ room: roomName, payload });
          }
        };
      }
    };

    const mockSocket = {
      id: 'mock_test_socket_111',
      join: (roomName) => {
        socketRooms[roomName] = socketRooms[roomName] || [];
        socketRooms[roomName].push('mock_test_socket_111');
      },
      emit: (event, payload) => {
        emittedEvents[event] = emittedEvents[event] || [];
        emittedEvents[event].push({ socketId: 'mock_test_socket_111', payload });
      },
      on: (event, callback) => {
        mockSocket[event] = callback;
      }
    };

    // Register handlers
    const socketHandler = require('./socket');
    socketHandler(mockIo);

    // Call the dynamic room joins
    mockSocket['join-attempt']({ attemptId: 'attempt_123_abc' });
    mockSocket['join-admin-security']();

    assert(socketRooms['attempt_attempt_123_abc'] !== undefined, 'Socket successfully joined attempt room');
    assert(socketRooms['admin_security'] !== undefined, 'Socket successfully joined admin_security room');

    console.log('\n=== ALL PHASE 9 VERIFICATION TESTS COMPLETED SUCCESSFULLY ===');
  } finally {
    if (dbConnected) {
      await mongoose.connection.close();
      console.log('\nDatabase connection closed.');
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ Phase 9 Tests failed:', err);
  process.exit(1);
});
