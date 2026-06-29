const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env
dotenv.config();

const connectDB = require('./config/db');
const User = require('./models/userModel');
const Attempt = require('./models/attemptModel');
const AILog = require('./models/aiLogModel');
const { getStudentPDFReport, getQuizPDFReport, getClassPDFReport } = require('./controllers/reportController');

// Writable stream wrapper to mock Express response object
class MockResponse extends fs.WriteStream {
  constructor(filePath, callback) {
    super(filePath);
    this.statusCode = 200;
    this.headers = {};
    this.callback = callback;
    
    this.on('finish', () => {
      if (this.callback) this.callback(null, filePath);
    });
    this.on('error', (err) => {
      if (this.callback) this.callback(err, filePath);
    });
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  setHeader(name, value) {
    this.headers[name] = value;
    return this;
  }

  json(data) {
    console.log('[JSON Response]:', JSON.stringify(data, null, 2));
    if (this.callback) this.callback(new Error(data.message || 'JSON error response'), null);
    this.end();
  }
}

async function runTests() {
  console.log('--- STARTING PDF EXPORT PIPELINE INTEGRATION TESTS ---');
  
  // 1. Connect to DB
  await connectDB();
  
  try {
    // 2. Fetch seed users
    const adminUser = await User.findOne({ role: 'admin' });
    const studentUser = await User.findOne({ role: 'student' });
    
    if (!adminUser || !studentUser) {
      throw new Error('Seed users not found. Make sure server/seedPhase9.js has been run.');
    }
    
    console.log(`Found Admin User: ${adminUser.name} (${adminUser.email})`);
    console.log(`Found Student User: ${studentUser.name} (${studentUser.email})`);
    
    // Fetch a completed attempt for the student
    const attempt = await Attempt.findOne({ user: studentUser._id, isCompleted: true });
    if (!attempt) {
      console.warn('⚠️ No completed quiz attempts found for this student. Generating mock quiz attempt...');
      // Creating a mock attempt to test with actual data
      const Quiz = require('./models/quizModel');
      const Question = require('./models/questionModel');
      let quiz = await Quiz.findOne();
      if (!quiz) {
        quiz = await Quiz.create({
          title: 'General Algebra Evaluation',
          description: 'Basic mathematics evaluation',
          isAdaptive: true,
          topic: 'Algebra',
          questions: []
        });
      }
      let q = await Question.findOne({ topic: 'Algebra' });
      if (!q) {
        q = await Question.create({
          questionText: 'Solve for x: 2x + 5 = 15',
          options: ['x = 5', 'x = 10', 'x = 2', 'x = 15'],
          correctAnswer: 0,
          difficulty: 'easy',
          topic: 'Algebra',
          explanation: 'Subtract 5 then divide by 2.'
        });
      }
      
      const newAttempt = await Attempt.create({
        user: studentUser._id,
        quiz: quiz._id,
        isAdaptive: true,
        score: 1,
        totalQuestions: 1,
        percentage: 100,
        confidenceScore: 3,
        averageConfidence: 100,
        confidenceAccuracyIndex: 100,
        overconfidenceCount: 0,
        underconfidenceCount: 0,
        isCompleted: true,
        currentDifficulty: 'easy',
        questionsOrder: [q._id],
        answers: [0],
        responses: [{
          questionId: q._id,
          selectedAnswer: 0,
          correctAnswer: 0,
          isCorrect: true,
          confidenceLevel: 'high',
          timeTaken: 12,
          difficulty: 'easy',
          topic: 'Algebra'
        }]
      });
      console.log(`Mock attempt created: ${newAttempt._id}`);
    }
    
    const activeAttempt = await Attempt.findOne({ user: studentUser._id, isCompleted: true });
    console.log(`Using Attempt ID: ${activeAttempt._id}`);

    // Create test output directory
    const testDir = path.join(__dirname, 'test_output');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }

    // AILog initial count
    const initialLogsCount = await AILog.countDocuments({ action: 'pdf_report_export' });
    console.log(`Initial PDF export logs count in DB: ${initialLogsCount}`);

    // Define test cases
    const testCases = [
      {
        name: 'Student Performance Report PDF',
        filePath: path.join(testDir, 'student_report_test.pdf'),
        controller: getStudentPDFReport,
        req: {
          user: studentUser,
          params: { id: studentUser._id.toString() }
        }
      },
      {
        name: 'Quiz Evaluation Report PDF',
        filePath: path.join(testDir, 'quiz_report_test.pdf'),
        controller: getQuizPDFReport,
        req: {
          user: studentUser,
          params: { id: activeAttempt._id.toString() }
        }
      },
      {
        name: 'Class Performance & Analytics Report PDF',
        filePath: path.join(testDir, 'class_report_test.pdf'),
        controller: getClassPDFReport,
        req: {
          user: adminUser,
          params: { id: 'all' }
        }
      }
    ];

    for (const tc of testCases) {
      console.log(`\nRunning Test: [${tc.name}]`);
      
      await new Promise((resolve, reject) => {
        const res = new MockResponse(tc.filePath, (err, fPath) => {
          if (err) {
            console.error(`✗ Test Failed: ${tc.name} encountered error:`, err.message);
            reject(err);
          } else {
            // Verify file size and content magic bytes
            const stats = fs.statSync(fPath);
            const content = fs.readFileSync(fPath);
            const isPdf = content.toString('utf8', 0, 4) === '%PDF';
            
            console.log(`✓ Response status: ${res.statusCode}`);
            console.log(`✓ Content-Disposition: ${res.headers['Content-Disposition']}`);
            console.log(`✓ File written to: ${fPath}`);
            console.log(`✓ File size: ${stats.size} bytes`);
            console.log(`✓ Magic bytes check (%PDF): ${isPdf ? 'PASSED' : 'FAILED'}`);
            
            if (stats.size > 0 && isPdf) {
              console.log(`✓ Test Passed: [${tc.name}]`);
              resolve();
            } else {
              reject(new Error(`PDF file size is zero or invalid headers for ${tc.name}`));
            }
          }
        });
        
        tc.controller(tc.req, res).catch(err => {
          console.error(`✗ Controller threw unexpected error:`, err.message);
          reject(err);
        });
      });
    }

    // Wait 500ms for database writes to finalize
    await new Promise(r => setTimeout(r, 500));

    // Verify AILogs creation
    const finalLogs = await AILog.find({ action: 'pdf_report_export' }).lean();
    console.log(`\nFinal PDF export logs count in DB: ${finalLogs.length}`);
    console.log('Logged topics in database:');
    finalLogs.forEach(l => console.log(`- ${l.topic} (Success: ${l.success}, Duration: ${l.generationTimeMs}ms)`));
    
    const newLogsCreated = finalLogs.length - initialLogsCount;
    console.log(`New logs created during this run: ${newLogsCreated}`);
    
    if (newLogsCreated >= 3) {
      console.log('✓ Database Logging Test: PASSED');
    } else {
      throw new Error(`AILog export records were not correctly written to the database. Expected 3, got ${newLogsCreated}.`);
    }

    console.log('\n======================================================');
    console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('======================================================\n');
    
  } catch (error) {
    console.error('\n======================================================');
    console.error('✗ PIPELINE INTEGRATION TEST FAILED:', error.message);
    console.error('======================================================\n');
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

runTests();
