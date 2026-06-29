const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Disable mongoose command buffering to fail fast on unreachable database
mongoose.set('bufferCommands', false);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const User = require('./models/userModel');
const Question = require('./models/questionModel');
const Quiz = require('./models/quizModel');
const QuizRoom = require('./models/quizRoomModel');

const { generateQuestions, qualityControlCheck, getSimilarity } = require('./services/questionGenerator');
const { balanceOptionPositions } = require('./services/quizGenerator');
const socketHandler = require('./socket');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ Passed: ${message}`);
}

// In-Memory Mongoose Stubs Fallback
const store = {
  users: [],
  questions: [],
  quizzes: [],
  quizrooms: []
};

function stubMongoose() {
  console.log('\n============================================================');
  console.log('ℹ️  Atlas/local MongoDB not reachable. Stubbing Mongoose in-memory...');
  console.log('============================================================\n');

  const populateField = (doc, path) => {
    if (!doc) return;
    if (path.includes('quizId') && doc.quizId && (typeof doc.quizId === 'object' && doc.quizId instanceof mongoose.Types.ObjectId || typeof doc.quizId === 'string')) {
      const quizDoc = store.quizzes.find(q => q._id.toString() === doc.quizId.toString());
      if (quizDoc) doc.quizId = quizDoc;
    }
    if (path.includes('hostId') && doc.hostId && (typeof doc.hostId === 'object' && doc.hostId instanceof mongoose.Types.ObjectId || typeof doc.hostId === 'string')) {
      const hostDoc = store.users.find(u => u._id.toString() === doc.hostId.toString());
      if (hostDoc) doc.hostId = hostDoc;
    }
  };

  const applyParticipantDefaults = (participant) => {
    if (!participant) return;
    participant.violationsCount = participant.violationsCount ?? 0;
    participant.riskScore = participant.riskScore ?? 0;
    participant.riskCategory = participant.riskCategory ?? 'Low Risk';
    participant.tabSwitchCount = participant.tabSwitchCount ?? 0;
    participant.focusLossCount = participant.focusLossCount ?? 0;
    participant.copyPasteCutCount = participant.copyPasteCutCount ?? 0;
    participant.rightClickCount = participant.rightClickCount ?? 0;
    participant.screenshotCount = participant.screenshotCount ?? 0;
    participant.fullscreenExitCount = participant.fullscreenExitCount ?? 0;
    participant.cameraViolationCount = participant.cameraViolationCount ?? 0;
    participant.securityAlerts = participant.securityAlerts ?? [];
    participant.answers = participant.answers ?? [];
  };

  const mockModel = (storeArray, modelName) => {
    return {
      create: async (doc) => {
        const item = {
          _id: new mongoose.Types.ObjectId(),
          ...doc,
          save: async function() {
            // update index in store
            const idx = storeArray.findIndex(x => x._id.toString() === this._id.toString());
            if (idx !== -1) storeArray[idx] = this;
            return this;
          }
        };
        storeArray.push(item);
        return item;
      },
      insertMany: async (docs) => {
        const items = docs.map(d => ({
          _id: new mongoose.Types.ObjectId(),
          ...d,
          save: async function() {
            return this;
          }
        }));
        storeArray.push(...items);
        return items;
      },
      findOne: (query) => {
        const item = storeArray.find(x => {
          if (query.roomCode && x.roomCode === query.roomCode) return true;
          if (query._id && x._id.toString() === query._id.toString()) return true;
          return false;
        });
        if (item) {
          if (item.participants) item.participants.forEach(applyParticipantDefaults);
          item.populate = function(path, select) {
            populateField(this, path);
            return this;
          };
          item.save = async function() {
            const idx = storeArray.findIndex(x => x._id.toString() === this._id.toString());
            if (idx !== -1) storeArray[idx] = this;
            return this;
          };
        }
        const qObj = {
          populate: function(path) {
            if (item) populateField(item, path);
            return this;
          },
          select: function() { return this; },
          then: function(resolve, reject) {
            resolve(item);
          }
        };
        return qObj;
      },
      find: (query) => {
        let results = storeArray;
        if (query && query.topic) {
          results = storeArray.filter(x => x.topic === query.topic);
        }
        const qObj = {
          select: function() { return this; },
          limit: function() { return this; },
          then: function(resolve, reject) {
            resolve(results);
          }
        };
        return qObj;
      },
      findById: async (id) => {
        const item = storeArray.find(x => x._id.toString() === id.toString());
        if (item) {
          if (item.participants) item.participants.forEach(applyParticipantDefaults);
          item.save = async function() {
            const idx = storeArray.findIndex(x => x._id.toString() === this._id.toString());
            if (idx !== -1) storeArray[idx] = this;
            return this;
          };
        }
        return item;
      },
      deleteOne: async (query) => {
        return { deletedCount: 1 };
      }
    };
  };

  const userStub = mockModel(store.users, 'User');
  User.create = userStub.create;
  User.deleteOne = userStub.deleteOne;

  const questionStub = mockModel(store.questions, 'Question');
  Question.create = questionStub.create;
  Question.find = questionStub.find;
  Question.findById = questionStub.findById;
  Question.insertMany = questionStub.insertMany;

  const quizStub = mockModel(store.quizzes, 'Quiz');
  Quiz.create = quizStub.create;
  Quiz.deleteOne = quizStub.deleteOne;

  const quizRoomStub = mockModel(store.quizrooms, 'QuizRoom');
  QuizRoom.create = quizRoomStub.create;
  QuizRoom.findOne = quizRoomStub.findOne;
  QuizRoom.deleteOne = quizRoomStub.deleteOne;
  QuizRoom.populate = async (obj, paths) => {
    if (Array.isArray(paths)) {
      for (const p of paths) {
        populateField(obj, p.path);
      }
    } else if (paths && typeof paths === 'object' && paths.path) {
      populateField(obj, paths.path);
    } else if (typeof paths === 'string') {
      populateField(obj, paths);
    }
    return obj;
  };
}

async function runTests() {
  console.log('=== STARTING PHASE 8 BUG FIX & EXAM SECURITY TESTS ===');
  
  try {
    await connectDB();
  } catch (err) {
    // Caught connection error, proceed to stubbing
  }

  // Fallback to stubs if MongoDB didn't connect properly
  if (mongoose.connection.readyState !== 1) {
    stubMongoose();
  }

  let testHost = null;
  let testStudent = null;
  let testQuiz = null;
  let testRoom = null;

  try {
    // ----------------------------------------------------
    // SETUP MOCK DATA
    // ----------------------------------------------------
    console.log('\nSetting up mock DB records for tests...');
    
    testHost = await User.create({
      name: 'Host Instructor P8',
      email: 'host_p8@example.com',
      password: 'password123',
      role: 'admin',
    });

    testStudent = await User.create({
      name: 'Student Examinee P8',
      email: 'student_p8@example.com',
      password: 'password123',
      role: 'student',
    });

    testQuiz = await Quiz.create({
      title: 'Secure Multiplayer Calculus Diagnostic',
      description: 'Advanced calculus room validation.',
      isAdaptive: false,
      topic: 'calculus',
      createdBy: testHost._id,
      securitySettings: {
        enforceSecurity: true,
        allowedTabSwitches: 2,
        fullScreenEnforced: true,
        cameraMonitoring: true,
        violationLimits: 4,
      },
      questions: []
    });

    // Create room code
    const roomCode = '987654';
    testRoom = await QuizRoom.create({
      roomCode,
      quizId: testQuiz._id,
      hostId: testHost._id,
      status: 'waiting',
      participants: []
    });

    // ----------------------------------------------------
    // TEST SCENARIO 1: JACCARD SIMILARITY & QUALITY CONTROL
    // ----------------------------------------------------
    console.log('\n[TEST 1/3] Running Question Quality Control (QC) & Similarity Tests...');

    // Jaccard similarity validation
    const sim1 = getSimilarity('What is 2 + 2?', 'What is 2 + 2?');
    assert(sim1 === 1.0, 'Exact same string has similarity 1.0');

    const sim2 = getSimilarity('Calculate the limit of f(x) as x approaches 3', 'Find the limit of g(y) as y goes to 3');
    assert(sim2 > 0.3 && sim2 < 0.75, `Partially similar string similarity is: ${sim2.toFixed(2)} (within acceptable bounds)`);

    // QC rules verification
    const badQuestionShortExp = {
      questionText: 'What is the sum of angles in a triangle?',
      options: ['180', '90', '360', '270'],
      correctAnswer: 0,
      explanation: 'Option A is correct.' // Too short, fails QC
    };
    const qcResultShort = await qualityControlCheck(badQuestionShortExp, 'geometry', 'easy', []);
    assert(qcResultShort.valid === false, 'QC rejected explanation that is too short');

    const badQuestionDuplicateOptions = {
      questionText: 'Solve for x: x + 5 = 10',
      options: ['5', '5', '10', '15'], // Duplicates, fails QC
      correctAnswer: 0,
      explanation: 'Subtract 5 from both sides to get x = 5.'
    };
    const qcResultDupOpt = await qualityControlCheck(badQuestionDuplicateOptions, 'algebra', 'easy', []);
    assert(qcResultDupOpt.valid === false, 'QC rejected options containing duplicate values');

    const badQuestionTopicIrrelevant = {
      questionText: 'What is the capital of France?', // Geography, not Math
      options: ['Paris', 'London', 'Berlin', 'Rome'],
      correctAnswer: 0,
      explanation: 'Paris is the capital and most populous city of France.'
    };
    const qcResultTopic = await qualityControlCheck(badQuestionTopicIrrelevant, 'algebra', 'easy', []);
    assert(qcResultTopic.valid === false, 'QC rejected question lacking topic relevance');

    // ----------------------------------------------------
    // TEST SCENARIO 2: AI DIVERSITY ENGINE & 100 QUESTION SCALING
    // ----------------------------------------------------
    console.log('\n[TEST 2/3] Generating 100 Unique Questions & Balancing Answers...');

    const countToGenerate = 100;
    const generatedQuestions = [];

    // Topics list to generate diversity
    const topics = ['probability', 'geometry', 'statistics', 'algebra'];
    const difficulties = ['easy', 'medium', 'hard', 'expert'];

    for (let i = 0; i < countToGenerate; i++) {
      const topic = topics[i % topics.length];
      const diff = difficulties[i % difficulties.length];
      
      const qBatch = await generateQuestions({
        topic,
        difficulty: diff,
        numberOfQuestions: 1
      });
      
      if (qBatch && qBatch.length > 0) {
        generatedQuestions.push(qBatch[0]);
        await Question.create(qBatch[0]);
      }
    }

    assert(generatedQuestions.length === countToGenerate, `Successfully generated ${countToGenerate} questions`);

    // Verify Jaccard similarity between all generated pairs
    let duplicatePairsCount = 0;
    for (let i = 0; i < generatedQuestions.length; i++) {
      for (let j = i + 1; j < generatedQuestions.length; j++) {
        const sim = getSimilarity(generatedQuestions[i].questionText, generatedQuestions[j].questionText);
        if (sim > 0.75) {
          duplicatePairsCount++;
        }
      }
    }
    assert(duplicatePairsCount === 0, 'Zero duplicate question pairs detected (all Jaccard similarities <= 75%)');

    // Verify difficulty scaling is present
    const easyCount = generatedQuestions.filter(q => q.difficulty === 'easy').length;
    const expertCount = generatedQuestions.filter(q => q.difficulty === 'expert').length;
    assert(easyCount > 0 && expertCount > 0, 'Difficulty scaling verified (both easy and expert difficulties represented)');

    // Verify correct option balancing (Answer Diversity Engine)
    const balancedQuestions = balanceOptionPositions(generatedQuestions);
    const answersDistribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
    balancedQuestions.forEach(q => {
      answersDistribution[q.correctAnswer] += 1;
    });

    console.log('  Correct Answer distribution across 100 questions:', {
      'Option A (index 0)': answersDistribution[0],
      'Option B (index 1)': answersDistribution[1],
      'Option C (index 2)': answersDistribution[2],
      'Option D (index 3)': answersDistribution[3],
    });

    assert(
      answersDistribution[0] === 25 &&
      answersDistribution[1] === 25 &&
      answersDistribution[2] === 25 &&
      answersDistribution[3] === 25,
      'Answer positions balanced perfectly (Exactly 25% A, 25% B, 25% C, 25% D distribution achieved)'
    );

    // ----------------------------------------------------
    // TEST SCENARIO 3: MULTIPLAYER SOCKET SYNCHRONIZATION
    // ----------------------------------------------------
    console.log('\n[TEST 3/3] Testing Multiplayer Socket Security Synchronization...');

    // Build mock socket.io structures to map connections
    const ioCallbacks = {};
    let connectionCallback;
    const mockIO = {
      on: (event, cb) => {
        if (event === 'connection') {
          connectionCallback = cb;
        }
      },
      to: (code) => ({
        emit: (event, payload) => {
          ioCallbacks[event] = ioCallbacks[event] || [];
          ioCallbacks[event].push(payload);
        }
      })
    };

    const studentEmits = {};
    const mockStudentSocket = {
      id: 'mock_student_socket_123',
      join: (code) => {},
      emit: (event, payload) => {
        studentEmits[event] = studentEmits[event] || [];
        studentEmits[event].push(payload);
      },
      on: (event, callback) => {
        mockStudentSocket[event] = callback;
      }
    };

    const mockHostSocket = {
      id: 'mock_host_socket_456',
      join: (code) => {},
      emit: (event, payload) => {},
      on: (event, callback) => {
        mockHostSocket[event] = callback;
      }
    };

    // Register handlers
    socketHandler(mockIO);

    // Trigger connection callbacks
    if (connectionCallback) {
      connectionCallback(mockHostSocket);
      connectionCallback(mockStudentSocket);
    }

    // 1. Host Joins Room
    await mockHostSocket['join-room']({
      roomCode,
      name: testHost.name,
      userId: testHost._id,
      role: 'host'
    });

    // 2. Student Joins Room
    await mockStudentSocket['join-room']({
      roomCode,
      name: testStudent.name,
      userId: testStudent._id,
      role: 'student'
    });

    // 3. Start Quiz
    await mockHostSocket['start-quiz']({ roomCode });

    // Verify room is active in DB
    const activeRoom = await QuizRoom.findOne({ roomCode });
    assert(activeRoom.status === 'active', 'Room state set to active in database');

    // 4. Simulate a Tab Switch Violation Event from Student
    console.log('  Simulating first security violation (TAB_SWITCH)...');
    await mockStudentSocket['student-security-event']({
      roomCode,
      eventType: 'TAB_SWITCH',
      metadata: { action: 'visibility_hidden' }
    });

    // Assert that backend emitted the specific sync socket events
    assert(studentEmits['violation_detected'] !== undefined, 'Server emitted "violation_detected" event');
    assert(studentEmits['risk_score_updated'] !== undefined, 'Server emitted "risk_score_updated" event');
    assert(studentEmits['attempts_remaining_updated'] !== undefined, 'Server emitted "attempts_remaining_updated" event');

    const lastViolationData = studentEmits['violation_detected'][studentEmits['violation_detected'].length - 1];
    assert(lastViolationData.violationsCount === 1, 'Server tracked violation count as 1');
    assert(lastViolationData.securityAlerts.length === 1, 'Server recorded securityAlerts history feed');

    const lastRiskData = studentEmits['risk_score_updated'][studentEmits['risk_score_updated'].length - 1];
    assert(lastRiskData.riskScore > 0, `Cheating risk calculated and updated to ${lastRiskData.riskScore}%`);

    const lastAttemptsData = studentEmits['attempts_remaining_updated'][studentEmits['attempts_remaining_updated'].length - 1];
    assert(lastAttemptsData.attemptsRemaining === 3, `Attempts remaining correctly synchronized: ${lastAttemptsData.attemptsRemaining} remaining`);

    // 5. Emit more violations until limit is exceeded (violation limit is 4)
    console.log('  Simulating additional violations to exceed limit...');
    await mockStudentSocket['student-security-event']({ roomCode, eventType: 'FULLSCREEN_EXIT' });
    await mockStudentSocket['student-security-event']({ roomCode, eventType: 'COPY_ATTEMPT' });
    await mockStudentSocket['student-security-event']({ roomCode, eventType: 'SCREENSHOT_ATTEMPT' });

    assert(studentEmits['security-auto-submit'] !== undefined, 'Server emitted "security-auto-submit" (Auto-submit lockdown triggered)');
    assert(studentEmits['exam_terminated'] !== undefined, 'Server emitted "exam_terminated" socket event');

    const finalRoom = await QuizRoom.findOne({ roomCode });
    const finalStudent = finalRoom.participants.find(p => p.name === testStudent.name);
    assert(finalStudent.isCompleted === true, 'Student participant state set to completed in database');

    console.log('\n=== ALL PHASE 8 TESTS COMPLETED SUCCESSFULLY ===');
  } finally {
    // ----------------------------------------------------
    // CLEANUP DATABASE
    // ----------------------------------------------------
    console.log('\nCleaning up database mock records...');
    if (mongoose.connection.readyState === 1) {
      if (testRoom) await QuizRoom.deleteOne({ _id: testRoom._id });
      if (testQuiz) await Quiz.deleteOne({ _id: testQuiz._id });
      if (testHost) await User.deleteOne({ _id: testHost._id });
      if (testStudent) await User.deleteOne({ _id: testStudent._id });
      await mongoose.connection.close();
      console.log('Database connection closed.');
    } else {
      console.log('In-memory database simulation complete.');
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
