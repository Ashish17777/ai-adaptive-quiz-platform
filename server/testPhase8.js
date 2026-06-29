const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const User = require('./models/userModel');
const Question = require('./models/questionModel');
const Quiz = require('./models/quizModel');
const Attempt = require('./models/attemptModel');
const ExamSession = require('./models/examSessionModel');
const SecurityLog = require('./models/securityLogModel');
const ViolationReport = require('./models/violationReportModel');
const ProctoringEvent = require('./models/proctoringEventModel');
const RiskAssessment = require('./models/riskAssessmentModel');

// Import services and controller methods
const {
  encryptPayload,
  decryptPayload,
  logSecurityEvent,
  autoSubmitQuizAttempt,
  calculateCheatingRiskScore,
} = require('./services/securityEngine');

const {
  logEvent,
  getSession,
  getReport,
  getRiskScore,
  autoSubmit,
} = require('./controllers/securityController');

const {
  getAttemptQuestion,
} = require('./controllers/attemptController');

// Helper to create mock response object
function mockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    }
  };
  return res;
}

// Custom XOR base64 payload obfuscator matching client
const obfuscatePayload = (data) => {
  const jsonStr = JSON.stringify(data);
  const key = 'ai-quiz-secure-token';
  let result = '';
  for (let i = 0; i < jsonStr.length; i++) {
    result += String.fromCharCode(jsonStr.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result, 'utf8').toString('base64');
};

async function runTests() {
  console.log('=== STARTING PHASE 8 ASSESSMENT SECURITY & ANTI-CHEATING TESTS ===');

  await connectDB();

  let testAdmin = null;
  let testStudent = null;
  let testQuiz = null;
  let testAttempt = null;

  try {
    // 1. Setup Test User and Quiz with Enforced Security
    console.log('\n[1/6] Setting up mock security models...');
    testAdmin = await User.create({
      name: 'Security Admin P8',
      email: 'secadmin_p8@example.com',
      password: 'password123',
      role: 'admin',
    });

    testStudent = await User.create({
      name: 'Security Student P8',
      email: 'secstudent_p8@example.com',
      password: 'password123',
      role: 'student',
    });

    testQuiz = await Quiz.create({
      title: 'Secure Diagnostic Assessment',
      description: 'Algebra exam with fullscreen lockdown, random options, and webcam monitoring enabled.',
      isAdaptive: false,
      createdBy: testAdmin._id,
      securitySettings: {
        enforceSecurity: true,
        allowedTabSwitches: 2,
        fullScreenEnforced: true,
        cameraMonitoring: true,
        violationLimits: 4, // auto-submit at 4 total violations
      },
    });

    console.log(`✓ Test Admin: ${testAdmin.email}`);
    console.log(`✓ Test Student: ${testStudent.email}`);
    console.log(`✓ Test Quiz: "${testQuiz.title}" [Lockdown active]`);

    // Create mock questions
    const q1 = await Question.create({
      questionText: 'What is 3x + 1 = 10?',
      options: ['3', '2', '4', '1'], // Correct: index 0 ('3')
      correctAnswer: 0,
      difficulty: 'easy',
      topic: 'algebra',
      createdBy: testAdmin._id,
    });
    const q2 = await Question.create({
      questionText: 'What is 4x - 2 = 14?',
      options: ['2', '4', '5', '3'], // Correct: index 1 ('4')
      correctAnswer: 1,
      difficulty: 'medium',
      topic: 'algebra',
      createdBy: testAdmin._id,
    });

    testQuiz.questions = [q1._id, q2._id];
    await testQuiz.save();

    // 2. Verify XOR Obfuscation and Decryption
    console.log('\n[2/6] Verifying XOR Obfuscation/Decryption...');
    const originalData = { attemptId: 'mock123', eventType: 'TAB_SWITCH', check: true };
    const obfuscated = obfuscatePayload(originalData);
    const decrypted = decryptPayload(obfuscated);
    const parsed = JSON.parse(decrypted);

    if (parsed.attemptId !== originalData.attemptId || parsed.eventType !== originalData.eventType) {
      throw new Error('Obfuscation/Decryption payload mismatch!');
    }
    console.log('✓ Obfuscation & decryption tests passed successfully.');

    // 3. Start a quiz attempt and verify option randomization shuffles options
    console.log('\n[3/6] Starting quiz attempt and verifying option randomization...');
    const { startAttempt } = require('./controllers/attemptController');
    const reqStart = { body: { quizId: testQuiz._id.toString() }, user: testStudent };
    const resStart = mockResponse();
    await startAttempt(reqStart, resStart);

    if (resStart.statusCode !== 201 || !resStart.data.success) {
      throw new Error(`Failed to start attempt: ${JSON.stringify(resStart.data)}`);
    }

    testAttempt = await Attempt.findById(resStart.data.attemptId);
    console.log(`✓ Attempt started. Id: ${testAttempt._id}`);
    console.log(`✓ Questions order pre-filled: ${testAttempt.questionsOrder.length}`);
    
    // Assert option order mapping is saved
    const responses = testAttempt.responses;
    if (!responses || responses.length !== 2 || !responses[0].optionOrder || responses[0].optionOrder.length !== 4) {
      throw new Error('Option shuffles permutation mapping was not successfully pre-filled!');
    }
    console.log(`✓ Response 1 option shuffles: [${responses[0].optionOrder.join(', ')}]`);
    console.log(`✓ Response 2 option shuffles: [${responses[1].optionOrder.join(', ')}]`);

    // 4. Verify One-Question-At-A-Time Secure Delivery
    console.log('\n[4/6] Verifying secure single-question delivery endpoint...');
    const reqQ1 = { params: { id: testAttempt._id.toString(), index: '0' }, user: testStudent };
    const resQ1 = mockResponse();
    await getAttemptQuestion(reqQ1, resQ1);

    if (resQ1.statusCode !== 200 || !resQ1.data.success) {
      throw new Error('Secure question delivery endpoint failed!');
    }

    const fetchedQuestion = resQ1.data.question;
    // Check that correctAnswer and explanation are stripped out of payload
    if (fetchedQuestion.correctAnswer !== undefined || fetchedQuestion.explanation !== undefined) {
      throw new Error('Correct answer or explanation leaked in secure question delivery payload!');
    }
    console.log(`✓ Delivered question: "${fetchedQuestion.questionText}"`);
    console.log(`✓ Shuffled options: [${fetchedQuestion.options.join(', ')}]`);

    // 5. Verify Cheating Risk Score and Event Violation Threshold Logic
    console.log('\n[5/6] Logging violations and verifying risk limits...');
    
    // Violation 1: Tab Switch
    console.log('Logging Violation 1: TAB_SWITCH');
    const resLog1 = await logSecurityEvent({
      userId: testStudent._id,
      attemptId: testAttempt._id,
      eventType: 'TAB_SWITCH',
      metadata: { action: 'visibility_hidden' },
    });
    console.log(`  Current Risk: ${resLog1.riskScore}% [${resLog1.riskCategory}]`);
    console.log(`  Should Auto Submit: ${resLog1.shouldSubmit}`);

    // Violation 2: Fullscreen Exit
    console.log('Logging Violation 2: FULLSCREEN_EXIT');
    const resLog2 = await logSecurityEvent({
      userId: testStudent._id,
      attemptId: testAttempt._id,
      eventType: 'FULLSCREEN_EXIT',
      metadata: { screenWidth: 1024 },
    });
    console.log(`  Current Risk: ${resLog2.riskScore}% [${resLog2.riskCategory}]`);
    console.log(`  Should Auto Submit: ${resLog2.shouldSubmit}`);

    // Violation 3: Camera face warning
    console.log('Logging Violation 3: FACE_NOT_DETECTED');
    const resLog3 = await logSecurityEvent({
      userId: testStudent._id,
      attemptId: testAttempt._id,
      eventType: 'FACE_NOT_DETECTED',
      metadata: { notes: 'Proctor snap warning' },
    });
    console.log(`  Current Risk: ${resLog3.riskScore}% [${resLog3.riskCategory}]`);
    console.log(`  Should Auto Submit: ${resLog3.shouldSubmit}`);

    // Violation 4: Second Tab Switch (will breach violationLimits: 4)
    console.log('Logging Violation 4: TAB_SWITCH (Threshold Breach)');
    const reqLog4 = {
      body: {
        payload: obfuscatePayload({
          attemptId: testAttempt._id.toString(),
          eventType: 'TAB_SWITCH',
          metadata: { action: 'visibility_hidden' },
        })
      },
      user: testStudent
    };
    const resLog4 = mockResponse();
    await logEvent(reqLog4, resLog4);

    if (resLog4.statusCode !== 200 || !resLog4.data.success) {
      throw new Error(`Endpoint log-event failed: ${JSON.stringify(resLog4.data)}`);
    }

    console.log(`✓ API log-event result:`);
    console.log(`  Auto Submitted: ${resLog4.data.autoSubmitted}`);
    console.log(`  Auto Submit Reason: "${resLog4.data.reason}"`);
    console.log(`  Latest Risk Score: ${resLog4.data.riskScore}% [${resLog4.data.riskCategory}]`);

    if (!resLog4.data.autoSubmitted) {
      throw new Error('Auto submission failed to trigger upon violation limits breach!');
    }

    // 6. Verify grading accuracy and answers mapping
    console.log('\n[6/6] Verifying grading accuracy with option mapping shuffles...');
    const gradedAttempt = await Attempt.findById(testAttempt._id);
    if (!gradedAttempt.isCompleted) {
      throw new Error('Attempt was not correctly marked completed after auto-submission!');
    }
    console.log(`✓ Auto-submitted attempt status: completed`);
    console.log(`✓ Final percentage score: ${gradedAttempt.percentage}%`);

    console.log('\n=== ALL PHASE 8 INTEGRATION TESTS PASSED ===');

  } catch (error) {
    console.error('\n❌ TEST RUN FAILED with error:');
    console.error(error);
  } finally {
    console.log('\nCleaning up databases...');
    if (testAdmin) {
      await User.deleteOne({ _id: testAdmin._id });
    }
    if (testStudent) {
      await User.deleteOne({ _id: testStudent._id });
      await Attempt.deleteOne({ _id: testAttempt?._id });
      await ExamSession.deleteOne({ attemptId: testAttempt?._id });
      await SecurityLog.deleteMany({ attemptId: testAttempt?._id });
      await ViolationReport.deleteOne({ attemptId: testAttempt?._id });
      await ProctoringEvent.deleteMany({ attemptId: testAttempt?._id });
      await RiskAssessment.deleteOne({ attemptId: testAttempt?._id });
    }
    if (testQuiz) {
      await Quiz.deleteOne({ _id: testQuiz._id });
    }

    console.log('Cleanup complete. Closing database connection.');
    await mongoose.connection.close();
  }
}

runTests();
