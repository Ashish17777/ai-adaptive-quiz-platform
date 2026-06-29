const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const User = require('./models/userModel');
const Question = require('./models/questionModel');
const Quiz = require('./models/quizModel');
const PracticeSet = require('./models/practiceSetModel');
const AIUsage = require('./models/aiUsageModel');

// Import controller functions
const {
  generateQuestionsAdmin,
  generateQuizAdmin,
  generatePracticeStudent,
  generateExplanation,
  generateQuizFromPDF,
  generateQuizFromImage,
  getAIUsageStats
} = require('./controllers/aiGenerationController');

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

async function runTests() {
  console.log('=== STARTING PHASE 6 AI INTEGRATION TESTS ===');
  
  // Connect to DB
  await connectDB();
  
  let testAdmin = null;
  let testStudent = null;
  const createdQuestionIds = [];
  const createdQuizIds = [];
  const createdPracticeSetIds = [];

  try {
    // 1. Setup Test Users
    console.log('\n[1/8] Setting up mock users...');
    testAdmin = await User.create({
      name: 'Test Admin',
      email: 'testadmin_phase6@example.com',
      password: 'password123',
      role: 'admin'
    });
    console.log(`Created Test Admin: ${testAdmin.email} (${testAdmin._id})`);

    testStudent = await User.create({
      name: 'Test Student',
      email: 'teststudent_phase6@example.com',
      password: 'password123',
      role: 'student'
    });
    console.log(`Created Test Student: ${testStudent.email} (${testStudent._id})`);

    // 2. Test Question Preview Generation
    console.log('\n[2/8] Testing AI Question Preview Generation (Rule-based Fallback)...');
    const req1 = {
      body: {
        topic: 'Algebra Math',
        difficulty: 'medium',
        numberOfQuestions: 3,
        questionType: 'MCQ'
      },
      user: testAdmin
    };
    const res1 = mockResponse();
    await generateQuestionsAdmin(req1, res1);

    if (res1.statusCode !== 200 || !res1.data || !res1.data.success) {
      throw new Error(`generateQuestionsAdmin failed: status ${res1.statusCode}, data: ${JSON.stringify(res1.data)}`);
    }
    console.log('✓ Questions preview generated successfully.');
    console.log(`  Count returned: ${res1.data.questions.length}`);
    res1.data.questions.forEach((q, i) => {
      console.log(`    Q${i+1}: ${q.questionText} [Diff: ${q.difficulty}]`);
    });

    // 3. Test Quiz Generation & Database Creation
    console.log('\n[3/8] Testing Automated Quiz Creation...');
    const req2 = {
      body: {
        title: 'Integration Test Calculus Quiz',
        topic: 'Calculus',
        difficulty: 'hard',
        numberOfQuestions: 2
      },
      user: testAdmin
    };
    const res2 = mockResponse();
    await generateQuizAdmin(req2, res2);

    if (res2.statusCode !== 201 || !res2.data || !res2.data.success) {
      throw new Error(`generateQuizAdmin failed: status ${res2.statusCode}, data: ${JSON.stringify(res2.data)}`);
    }
    
    const quiz = res2.data.quiz;
    createdQuizIds.push(quiz._id);
    console.log(`✓ Quiz generated and saved: "${quiz.title}" (${quiz._id})`);
    console.log(`  Questions count saved in quiz: ${res2.data.questionsCount}`);
    
    // Verify questions are in database and marked as AI generated
    const dbQuestions = await Question.find({ _id: { $in: quiz.questions } });
    dbQuestions.forEach(q => {
      createdQuestionIds.push(q._id);
      if (!q.generatedByAI) {
        throw new Error(`Saved question ${q._id} is not marked generatedByAI: true`);
      }
    });
    console.log('✓ Verified saved questions in DB have generatedByAI: true');

    // 4. Test Mixed-Difficulty Practice Generation for Students
    console.log('\n[4/8] Testing Student Practice Set Generation...');
    const req3 = {
      body: {
        topic: 'JavaScript Programming',
        numberOfQuestions: 5,
        studentLevel: 'intermediate'
      },
      user: testStudent
    };
    const res3 = mockResponse();
    await generatePracticeStudent(req3, res3);

    if (res3.statusCode !== 200 || !res3.data || !res3.data.success) {
      throw new Error(`generatePracticeStudent failed: status ${res3.statusCode}, data: ${JSON.stringify(res3.data)}`);
    }
    
    const practiceSetId = res3.data.practiceSetId;
    createdPracticeSetIds.push(practiceSetId);
    console.log(`✓ Practice Set generated and saved: ID ${practiceSetId}`);
    console.log(`  Total practice questions: ${res3.data.totalCount}`);

    // Verify practice set and questions exist in DB
    const practiceSetObj = await PracticeSet.findById(practiceSetId);
    if (!practiceSetObj) {
      throw new Error(`PracticeSet with ID ${practiceSetId} was not found in DB`);
    }
    const practiceQList = await Question.find({ _id: { $in: practiceSetObj.questions } });
    practiceQList.forEach(q => createdQuestionIds.push(q._id));
    console.log('✓ Verified practice set in DB. Checking difficulties distribution:');
    const diffs = practiceQList.map(q => q.difficulty);
    console.log(`  Difficulties generated: ${JSON.stringify(diffs)}`);

    // 5. Test Explanation Details Generator
    console.log('\n[5/8] Testing Step-by-Step Explanation Generation...');
    const testQ = dbQuestions[0];
    const req4 = {
      body: {
        questionId: testQ._id,
        questionText: testQ.questionText,
        options: testQ.options,
        correctAnswer: testQ.correctAnswer,
        topic: testQ.topic,
        difficulty: testQ.difficulty,
        explanation: testQ.explanation
      },
      user: testStudent
    };
    const res4 = mockResponse();
    await generateExplanation(req4, res4);

    if (res4.statusCode !== 200 || !res4.data || !res4.data.success) {
      throw new Error(`generateExplanation failed: status ${res4.statusCode}, data: ${JSON.stringify(res4.data)}`);
    }
    console.log('✓ Explanation generated successfully:');
    console.log(`  Solution: ${res4.data.explanation.solution}`);
    console.log(`  Concept: ${res4.data.explanation.concept}`);

    // 6. Test PDF study notes extraction
    console.log('\n[6/8] Testing PDF notes extractor...');
    const dummyPdfBuffer = Buffer.from('Chapter 1: Algebra Fundamentals and Equation solving techniques.');
    const req5 = {
      file: {
        fieldname: 'file',
        originalname: 'algebra_notes.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: dummyPdfBuffer,
        size: dummyPdfBuffer.length
      },
      body: {
        difficulty: 'medium',
        numberOfQuestions: 2
      },
      user: testAdmin
    };
    const res5 = mockResponse();
    await generateQuizFromPDF(req5, res5);

    if (res5.statusCode !== 200 || !res5.data || !res5.data.success) {
      throw new Error(`generateQuizFromPDF failed: status ${res5.statusCode}, data: ${JSON.stringify(res5.data)}`);
    }
    console.log('✓ PDF parsed and questions generated successfully.');
    console.log(`  Extracted topic: "${res5.data.topic}"`);
    console.log(`  Keywords: ${JSON.stringify(res5.data.keywords)}`);
    console.log(`  Generated questions count: ${res5.data.questions.length}`);

    // 7. Test Image diagram context extraction
    console.log('\n[7/8] Testing Image diagram context extractor...');
    const dummyImageBuffer = Buffer.from('fake image binary content');
    const req6 = {
      file: {
        fieldname: 'file',
        originalname: 'probability_venn_diagram.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: dummyImageBuffer,
        size: dummyImageBuffer.length
      },
      body: {
        difficulty: 'hard',
        numberOfQuestions: 2
      },
      user: testAdmin
    };
    const res6 = mockResponse();
    await generateQuizFromImage(req6, res6);

    if (res6.statusCode !== 200 || !res6.data || !res6.data.success) {
      throw new Error(`generateQuizFromImage failed: status ${res6.statusCode}, data: ${JSON.stringify(res6.data)}`);
    }
    console.log('✓ Image context extracted and questions generated successfully.');
    console.log(`  Identified topic: "${res6.data.topic}"`);
    console.log(`  Diagram description: "${res6.data.description}"`);
    console.log(`  Questions count: ${res6.data.questions.length}`);

    // 8. Test AI Usage Statistics Dashboard Query
    console.log('\n[8/8] Testing AI Usage Tracking and Stats aggregation...');
    const req7 = {
      user: testAdmin
    };
    const res7 = mockResponse();
    await getAIUsageStats(req7, res7);

    if (res7.statusCode !== 200 || !res7.data || !res7.data.success) {
      throw new Error(`getAIUsageStats failed: status ${res7.statusCode}, data: ${JSON.stringify(res7.data)}`);
    }
    const { stats, recentActivity } = res7.data;
    console.log('✓ Usage Stats retrieved successfully:');
    console.log(`  Questions Generated overall counter: ${stats.questionsGenerated}`);
    console.log(`  Quizzes Generated overall counter: ${stats.quizzesGenerated}`);
    console.log(`  Practice Sets Generated: ${stats.practiceSetsGenerated}`);
    console.log(`  PDF Processed: ${stats.pdfProcessed}`);
    console.log(`  Images Processed: ${stats.imageProcessed}`);
    console.log(`  Recent Logs Count: ${recentActivity.length}`);
    
    if (recentActivity.length === 0) {
      throw new Error('AIUsage logging failed. No recent log records found.');
    }

    console.log('\n=== ALL PHASE 6 INTEGRATION TESTS PASSED ===');

  } catch (error) {
    console.error('\n❌ TEST RUN FAILED with error:');
    console.error(error);
  } finally {
    // Cleanup databases
    console.log('\n=== CLEANING UP TEST DATA ===');
    
    if (testAdmin) {
      await User.deleteOne({ _id: testAdmin._id });
      console.log('Removed test admin.');
    }
    if (testStudent) {
      await User.deleteOne({ _id: testStudent._id });
      console.log('Removed test student.');
    }
    if (createdQuestionIds.length > 0) {
      await Question.deleteMany({ _id: { $in: createdQuestionIds } });
      console.log(`Removed ${createdQuestionIds.length} generated test questions.`);
    }
    if (createdQuizIds.length > 0) {
      await Quiz.deleteMany({ _id: { $in: createdQuizIds } });
      console.log(`Removed ${createdQuizIds.length} generated test quizzes.`);
    }
    if (createdPracticeSetIds.length > 0) {
      await PracticeSet.deleteMany({ _id: { $in: createdPracticeSetIds } });
      console.log(`Removed ${createdPracticeSetIds.length} generated test practice sets.`);
    }
    
    // Cleanup generated AIUsage logs
    if (testAdmin || testStudent) {
      const deletedLogs = await AIUsage.deleteMany({
        userId: { $in: [testAdmin ? testAdmin._id : null, testStudent ? testStudent._id : null].filter(id => id !== null) }
      });
      console.log(`Removed ${deletedLogs.deletedCount} AIUsage logging records.`);
    }

    // Disconnect mongoose
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

runTests();
