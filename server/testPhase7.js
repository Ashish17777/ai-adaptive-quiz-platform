const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const User = require('./models/userModel');
const Question = require('./models/questionModel');
const Quiz = require('./models/quizModel');
const Attempt = require('./models/attemptModel');
const StudentProfile = require('./models/studentProfileModel');
const Recommendation = require('./models/recommendationModel');
const Prediction = require('./models/predictionModel');
const StudyPlan = require('./models/studyPlanModel');
const MasteryTracking = require('./models/masteryTrackingModel');
const LearningMetric = require('./models/learningMetricModel');

// Import controller functions
const {
  getRecommendations,
  getPredictions,
  getStudyPlan,
  getReadiness,
  getSkillProfile,
  getCohortPredictions
} = require('./controllers/aiAnalyticsController');

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
  console.log('=== STARTING PHASE 7 AI PREDICTIVE ANALYTICS & RECOMMENDATION TESTS ===');
  
  // Connect to DB
  await connectDB();
  
  let testAdmin = null;
  let testStudent = null;
  let testQuiz = null;
  let testAttempt1 = null;
  let testAttempt2 = null;

  try {
    // 1. Setup Test Users
    console.log('\n[1/6] Setting up mock users and quizzes...');
    testAdmin = await User.create({
      name: 'Test Admin P7',
      email: 'testadmin_p7@example.com',
      password: 'password123',
      role: 'admin'
    });
    console.log(`Created Test Admin: ${testAdmin.email}`);

    testStudent = await User.create({
      name: 'Test Student P7',
      email: 'teststudent_p7@example.com',
      password: 'password123',
      role: 'student'
    });
    console.log(`Created Test Student: ${testStudent.email}`);

    // Create a mock quiz to attempt
    testQuiz = await Quiz.create({
      title: 'Mock Algebra Diagnostic Quiz',
      description: 'Algebra diagnostic assessment for testing Phase 7 analytics.',
      isAdaptive: true,
      topic: 'algebra',
      createdBy: testAdmin._id
    });
    console.log(`Created Test Quiz: "${testQuiz.title}"`);

    // Create mock questions to reference
    const q1 = await Question.create({
      questionText: 'What is 2x + 5 = 15?',
      options: ['5', '10', '7', '12'],
      correctAnswer: 0,
      difficulty: 'easy',
      topic: 'algebra',
      createdBy: testAdmin._id
    });
    const q2 = await Question.create({
      questionText: 'What is 3x - 4 = 11?',
      options: ['5', '3', '4', '2'],
      correctAnswer: 0,
      difficulty: 'medium',
      topic: 'algebra',
      createdBy: testAdmin._id
    });

    // 2. Create attempts to mock student progress history
    console.log('\n[2/6] Seeding student quiz attempts...');
    
    // Attempt 1: Low Score (50%)
    testAttempt1 = await Attempt.create({
      user: testStudent._id,
      quiz: testQuiz._id,
      isAdaptive: true,
      questionsOrder: [q1._id, q2._id],
      answers: [0, 1], // Q1 correct, Q2 incorrect
      responses: [
        {
          questionId: q1._id,
          selectedAnswer: 0,
          correctAnswer: 0,
          isCorrect: true,
          confidenceLevel: 'high',
          timeTaken: 12,
          difficulty: 'easy',
          topic: 'algebra'
        },
        {
          questionId: q2._id,
          selectedAnswer: 1,
          correctAnswer: 0,
          isCorrect: false,
          confidenceLevel: 'low',
          timeTaken: 25,
          difficulty: 'medium',
          topic: 'algebra'
        }
      ],
      score: 1,
      totalQuestions: 2,
      percentage: 50,
      confidenceScore: 130, // 150 - 20 (high correct, low incorrect)
      confidenceAccuracyIndex: 100, // Q1 matched (correct + high), Q2 matched (incorrect + low)
      averageConfidence: 67, // (3 + 1) / 6
      isCompleted: true,
      currentDifficulty: 'medium',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
    });

    // Attempt 2: High Score (100%) - simulating learning velocity growth
    testAttempt2 = await Attempt.create({
      user: testStudent._id,
      quiz: testQuiz._id,
      isAdaptive: true,
      questionsOrder: [q1._id, q2._id],
      answers: [0, 0], // Q1 correct, Q2 correct
      responses: [
        {
          questionId: q1._id,
          selectedAnswer: 0,
          correctAnswer: 0,
          isCorrect: true,
          confidenceLevel: 'high',
          timeTaken: 10,
          difficulty: 'easy',
          topic: 'algebra'
        },
        {
          questionId: q2._id,
          selectedAnswer: 0,
          correctAnswer: 0,
          isCorrect: true,
          confidenceLevel: 'high',
          timeTaken: 15,
          difficulty: 'medium',
          topic: 'algebra'
        }
      ],
      score: 2,
      totalQuestions: 2,
      percentage: 100,
      confidenceScore: 300, // 150 + 150
      confidenceAccuracyIndex: 100,
      averageConfidence: 100,
      isCompleted: true,
      currentDifficulty: 'hard',
      createdAt: new Date()
    });
    
    console.log(`Seeded Attempt 1: ${testAttempt1.percentage}% (Confidence Accuracy: ${testAttempt1.confidenceAccuracyIndex}%)`);
    console.log(`Seeded Attempt 2: ${testAttempt2.percentage}% (Confidence Accuracy: ${testAttempt2.confidenceAccuracyIndex}%)`);

    // 3. Trigger Skill Analyzer calculations manually
    console.log('\n[3/6] Running Skill Profile analysis pipelines...');
    
    // Simulate what triggerPostQuizAI does on attempt completion
    const { updateStudentSkillProfile } = require('./services/skillAnalyzer');
    const { generatePredictions } = require('./services/predictionEngine');
    const { generateStudyPlan } = require('./services/studyPlanGenerator');
    const { generateSmartRecommendations } = require('./services/recommendationEngine');

    // Run the pipeline
    const profile = await updateStudentSkillProfile(testStudent._id, testAttempt2._id);
    const predictionsDoc = await generatePredictions(testStudent._id);
    const studyPlanDoc = await generateStudyPlan(testStudent._id);
    const recommendationsDoc = await generateSmartRecommendations(testStudent._id);

    if (!profile) throw new Error('Skill Profile calculation returned null.');
    if (!predictionsDoc) throw new Error('Predictions calculation returned null.');
    if (!studyPlanDoc) throw new Error('Study Plan generation returned null.');
    if (!recommendationsDoc) throw new Error('Recommendations generation returned null.');

    console.log('✓ Student Skill Profile updated successfully:');
    console.log(`  Adaptive Score: ${profile.adaptiveScore}`);
    console.log(`  Average Difficulty: ${profile.averageDifficulty}`);
    console.log(`  Learning Velocity: +${profile.learningVelocity}% accuracy gain/quiz`);
    console.log(`  Exam Readiness Score: ${profile.examReadinessScore}/100`);

    console.log('✓ Performance Predictions updated successfully:');
    console.log(`  Predicted Score: ${predictionsDoc.predictedScore}%`);
    console.log(`  Predicted Difficulty Level: ${predictionsDoc.predictedDifficultyLevel}`);
    console.log(`  Readiness Level: ${predictionsDoc.readinessLevel}`);

    console.log('✓ Study Planner generated successfully:');
    console.log(`  Study Plan Title: "${studyPlanDoc.title}"`);
    console.log(`  Weeks planned: ${studyPlanDoc.weeks.length}`);

    // 4. Test Student API Endpoints
    console.log('\n[4/6] Verifying Student API responses...');
    
    // GET /api/skill-profile/:userId
    const reqProfile = { params: { userId: testStudent._id.toString() }, user: testStudent };
    const resProfile = mockResponse();
    await getSkillProfile(reqProfile, resProfile);
    if (resProfile.statusCode !== 200 || !resProfile.data.success) {
      throw new Error(`getSkillProfile failed: status ${resProfile.statusCode}`);
    }
    console.log('✓ GET /api/skill-profile/:userId returned 200 Success.');
    console.log(`  Reminders count: ${resProfile.data.reminders.length}`);
    resProfile.data.reminders.forEach((r, i) => console.log(`    Reminder ${i+1}: "${r}"`));

    // GET /api/predictions/:userId
    const reqPred = { params: { userId: testStudent._id.toString() }, user: testStudent };
    const resPred = mockResponse();
    await getPredictions(reqPred, resPred);
    if (resPred.statusCode !== 200 || !resPred.data.success) {
      throw new Error(`getPredictions failed: status ${resPred.statusCode}`);
    }
    console.log('✓ GET /api/predictions/:userId returned 200 Success.');

    // GET /api/study-plan/:userId
    const reqPlan = { params: { userId: testStudent._id.toString() }, user: testStudent };
    const resPlan = mockResponse();
    await getStudyPlan(reqPlan, resPlan);
    if (resPlan.statusCode !== 200 || !resPlan.data.success) {
      throw new Error(`getStudyPlan failed: status ${resPlan.statusCode}`);
    }
    console.log('✓ GET /api/study-plan/:userId returned 200 Success.');

    // GET /api/recommendations/:userId
    const reqRecs = { params: { userId: testStudent._id.toString() }, user: testStudent };
    const resRecs = mockResponse();
    await getRecommendations(reqRecs, resRecs);
    if (resRecs.statusCode !== 200 || !resRecs.data.success) {
      throw new Error(`getRecommendations failed: status ${resRecs.statusCode}`);
    }
    console.log('✓ GET /api/recommendations/:userId returned 200 Success.');
    console.log(`  Quizzes recommended count: ${resRecs.data.recommendations.recommendedQuizzes.length}`);
    resRecs.data.recommendations.recommendedQuizzes.forEach((rq, i) => {
      console.log(`    Rec ${i+1}: "${rq.title}" [Success Probability: ${rq.estimatedSuccessProbability * 100}%]`);
    });

    // GET /api/readiness/:userId
    const reqReady = { params: { userId: testStudent._id.toString() }, user: testStudent };
    const resReady = mockResponse();
    await getReadiness(reqReady, resReady);
    if (resReady.statusCode !== 200 || !resReady.data.success) {
      throw new Error(`getReadiness failed: status ${resReady.statusCode}`);
    }
    console.log('✓ GET /api/readiness/:userId returned 200 Success.');
    console.log(`  Readiness score: ${resReady.data.readinessScore}, level: ${resReady.data.readinessLevel}`);

    // 5. Test Admin API Endpoint
    console.log('\n[5/6] Verifying Admin Cohort Analytics API response...');
    
    // GET /api/predictions/cohort
    const reqCohort = { user: testAdmin };
    const resCohort = mockResponse();
    await getCohortPredictions(reqCohort, resCohort);
    if (resCohort.statusCode !== 200 || !resCohort.data.success) {
      throw new Error(`getCohortPredictions failed: status ${resCohort.statusCode}`);
    }
    console.log('✓ GET /api/predictions/cohort returned 200 Success.');
    console.log(`  Cohort size: ${resCohort.data.cohortSize}`);
    console.log(`  Average Readiness Score: ${resCohort.data.averageReadinessScore}%`);
    console.log(`  Success Projection Rate: ${resCohort.data.predictedSuccessRate}%`);
    console.log(`  Top Improving Students: ${JSON.stringify(resCohort.data.topImprovingStudents)}`);

    console.log('\n=== ALL PHASE 7 INTEGRATION TESTS PASSED ===');

  } catch (error) {
    console.error('\n❌ TEST RUN FAILED with error:');
    console.error(error);
  } finally {
    // 6. Cleanup databases
    console.log('\n[6/6] Cleaning up test data from collections...');
    
    if (testAdmin) {
      await User.deleteOne({ _id: testAdmin._id });
    }
    if (testStudent) {
      await User.deleteOne({ _id: testStudent._id });
      await StudentProfile.deleteOne({ userId: testStudent._id });
      await Recommendation.deleteOne({ userId: testStudent._id });
      await Prediction.deleteOne({ userId: testStudent._id });
      await StudyPlan.deleteMany({ userId: testStudent._id });
      await MasteryTracking.deleteMany({ userId: testStudent._id });
      await LearningMetric.deleteOne({ userId: testStudent._id });
    }
    if (testQuiz) {
      await Quiz.deleteOne({ _id: testQuiz._id });
    }
    if (testAttempt1) {
      await Attempt.deleteOne({ _id: testAttempt1._id });
    }
    if (testAttempt2) {
      await Attempt.deleteOne({ _id: testAttempt2._id });
    }
    
    console.log('Cleanup complete. Closing database connection.');
    await mongoose.connection.close();
  }
}

runTests();
