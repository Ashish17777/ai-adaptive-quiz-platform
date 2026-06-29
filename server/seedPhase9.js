const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const User = require('./models/userModel');
const Question = require('./models/questionModel');
const Quiz = require('./models/quizModel');
const Attempt = require('./models/attemptModel');
const TopicMastery = require('./models/topicMasteryModel');
const StudentProfile = require('./models/studentProfileModel');
const Prediction = require('./models/predictionModel');

async function seed() {
  console.log('=== SEEDING PHASE 9 ANALYTICS DATABASE ===');
  await connectDB();

  try {
    // 1. Clean up old seed data
    console.log('Cleaning existing seed accounts...');
    await User.deleteMany({ email: { $in: ['admin@example.com', 'student@example.com', 'student2@example.com', 'student3@example.com', 'student4@example.com'] } });
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // 2. Create Admin and Students
    console.log('Creating user accounts...');
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@example.com',
      password: passwordHash,
      role: 'admin',
    });

    const student = await User.create({
      name: 'Alex Mercer (High Performer)',
      email: 'student@example.com',
      password: passwordHash,
      role: 'student',
    });

    const student2 = await User.create({
      name: 'John Doe (At-Risk)',
      email: 'student2@example.com',
      password: passwordHash,
      role: 'student',
    });

    const student3 = await User.create({
      name: 'Sarah Connor (Fast Improver)',
      email: 'student3@example.com',
      password: passwordHash,
      role: 'student',
    });

    const student4 = await User.create({
      name: 'Elena Fisher (Low Confidence)',
      email: 'student4@example.com',
      password: passwordHash,
      role: 'student',
    });

    console.log('✓ Users created.');

    // 3. Create Questions & Quizzes
    console.log('Seeding question bank and quizzes...');
    const topics = ['Mathematics', 'Physics', 'Chemistry', 'Biology'];
    const difficultyTiers = ['easy', 'medium', 'hard', 'expert'];
    
    const seededQuestions = [];
    for (let i = 0; i < 20; i++) {
      const topic = topics[i % topics.length];
      const difficulty = difficultyTiers[i % difficultyTiers.length];
      
      const q = await Question.create({
        questionText: `What is the correct scientific property value/theory for concept #${i + 1}?`,
        options: ['Correct Option A', 'Distractor Option B', 'Distractor Option C', 'Distractor Option D'],
        correctAnswer: 0,
        difficulty,
        topic,
        createdBy: admin._id,
      });
      seededQuestions.push(q);
    }

    // Create 3 Quizzes
    const quizMath = await Quiz.create({
      title: 'Mathematics Assessment',
      topic: 'Mathematics',
      isAdaptive: true,
      createdBy: admin._id,
      questions: seededQuestions.filter(q => q.topic === 'Mathematics').map(q => q._id),
    });

    const quizPhysics = await Quiz.create({
      title: 'Physics Mechanics Exam',
      topic: 'Physics',
      isAdaptive: true,
      createdBy: admin._id,
      questions: seededQuestions.filter(q => q.topic === 'Physics').map(q => q._id),
    });

    const quizGeneral = await Quiz.create({
      title: 'Science Foundations Quiz',
      topic: 'Chemistry',
      isAdaptive: false,
      createdBy: admin._id,
      questions: seededQuestions.map(q => q._id).slice(0, 10),
    });

    console.log('✓ Quizzes and questions seeded.');

    // 4. Seed attempts for Alex Mercer (High Performer)
    console.log('Simulating attempt history for student 1 (Alex)...');
    const mathQuestions = seededQuestions.filter(q => q.topic === 'Mathematics');
    const physicsQuestions = seededQuestions.filter(q => q.topic === 'Physics');
    
    // Attempt 1: 2 days ago (Math)
    await Attempt.create({
      user: student._id,
      quiz: quizMath._id,
      isAdaptive: true,
      questionsOrder: mathQuestions.map(q => q._id),
      answers: [0, 0, 0, 0, 0],
      responses: mathQuestions.map(q => ({
        questionId: q._id,
        selectedAnswer: 0,
        correctAnswer: 0,
        isCorrect: true,
        confidenceLevel: 'high',
        timeTaken: 15,
        difficulty: q.difficulty,
        topic: 'Mathematics',
      })),
      score: 5,
      confidenceScore: 15,
      averageConfidence: 0.95,
      totalQuestions: 5,
      percentage: 100,
      isCompleted: true,
      currentDifficulty: 'expert',
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    });

    // Attempt 2: 1 day ago (Physics)
    await Attempt.create({
      user: student._id,
      quiz: quizPhysics._id,
      isAdaptive: true,
      questionsOrder: physicsQuestions.map(q => q._id),
      answers: [0, 0, 1, 0, 0],
      responses: physicsQuestions.map((q, idx) => ({
        questionId: q._id,
        selectedAnswer: idx === 2 ? 1 : 0,
        correctAnswer: 0,
        isCorrect: idx !== 2,
        confidenceLevel: idx === 2 ? 'low' : 'high',
        timeTaken: 22,
        difficulty: q.difficulty,
        topic: 'Physics',
      })),
      score: 4,
      confidenceScore: 12,
      averageConfidence: 0.85,
      totalQuestions: 5,
      percentage: 80,
      isCompleted: true,
      currentDifficulty: 'hard',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    // Seed Topic Mastery & Student Profiles for Alex
    await TopicMastery.create({ userId: student._id, topic: 'Mathematics', accuracy: 100, avgDifficulty: 'expert', totalAttempts: 1 });
    await TopicMastery.create({ userId: student._id, topic: 'Physics', accuracy: 80, avgDifficulty: 'hard', totalAttempts: 1 });
    await StudentProfile.create({ userId: student._id, adaptiveScore: 90, examReadinessScore: 92 });
    await Prediction.create({ userId: student._id, predictedScore: 94, predictedDifficultyLevel: 'expert', readinessLevel: 'exam_ready' });

    // 5. Seed attempts for John Doe (At-Risk)
    console.log('Simulating attempt history for student 2 (John)...');
    await Attempt.create({
      user: student2._id,
      quiz: quizGeneral._id,
      isAdaptive: false,
      questionsOrder: quizGeneral.questions,
      answers: [1, 2, 0, 1, 3, 2, 1, 0, 2, 1],
      responses: quizGeneral.questions.map((qId, idx) => {
        const q = seededQuestions.find(sq => sq._id.toString() === qId.toString());
        const isCorrect = idx === 2 || idx === 7;
        return {
          questionId: qId,
          selectedAnswer: isCorrect ? 0 : 1,
          correctAnswer: 0,
          isCorrect,
          confidenceLevel: 'high', // Dunning-Kruger effect
          timeTaken: 8,
          difficulty: q.difficulty,
          topic: q.topic,
        };
      }),
      score: 2,
      confidenceScore: 3,
      averageConfidence: 0.9,
      totalQuestions: 10,
      percentage: 20,
      isCompleted: true,
      currentDifficulty: 'easy',
      createdAt: new Date(),
    });

    await TopicMastery.create({ userId: student2._id, topic: 'Chemistry', accuracy: 20, avgDifficulty: 'easy', totalAttempts: 1 });
    await StudentProfile.create({ userId: student2._id, adaptiveScore: 20, examReadinessScore: 25 });
    await Prediction.create({ userId: student2._id, predictedScore: 30, predictedDifficultyLevel: 'easy', readinessLevel: 'beginner' });

    // 6. Seed attempts for Sarah Connor (Fast Improver)
    console.log('Simulating attempt history for student 3 (Sarah)...');
    // Quiz 1 (low score)
    await Attempt.create({
      user: student3._id,
      quiz: quizGeneral._id,
      isAdaptive: false,
      questionsOrder: quizGeneral.questions.slice(0, 5),
      answers: [2, 1, 0, 3, 2],
      responses: quizGeneral.questions.slice(0, 5).map((qId, idx) => ({
        questionId: qId,
        selectedAnswer: idx === 2 ? 0 : 1,
        correctAnswer: 0,
        isCorrect: idx === 2,
        confidenceLevel: 'medium',
        timeTaken: 25,
        difficulty: 'medium',
        topic: 'Mathematics',
      })),
      score: 1,
      percentage: 20,
      totalQuestions: 5,
      isCompleted: true,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    // Quiz 2 (high score)
    await Attempt.create({
      user: student3._id,
      quiz: quizGeneral._id,
      isAdaptive: false,
      questionsOrder: quizGeneral.questions.slice(0, 5),
      answers: [0, 0, 0, 0, 1],
      responses: quizGeneral.questions.slice(0, 5).map((qId, idx) => ({
        questionId: qId,
        selectedAnswer: idx === 4 ? 1 : 0,
        correctAnswer: 0,
        isCorrect: idx !== 4,
        confidenceLevel: 'high',
        timeTaken: 18,
        difficulty: 'medium',
        topic: 'Mathematics',
      })),
      score: 4,
      percentage: 80,
      totalQuestions: 5,
      isCompleted: true,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });

    await TopicMastery.create({ userId: student3._id, topic: 'Mathematics', accuracy: 80, avgDifficulty: 'medium', totalAttempts: 2 });
    await StudentProfile.create({ userId: student3._id, adaptiveScore: 70, examReadinessScore: 65 });
    await Prediction.create({ userId: student3._id, predictedScore: 75, predictedDifficultyLevel: 'medium', readinessLevel: 'intermediate' });

    // 7. Seed attempts for Elena Fisher (Low Confidence)
    console.log('Simulating attempt history for student 4 (Elena)...');
    await Attempt.create({
      user: student4._id,
      quiz: quizGeneral._id,
      isAdaptive: false,
      questionsOrder: quizGeneral.questions.slice(0, 5),
      answers: [0, 0, 0, 0, 0],
      responses: quizGeneral.questions.slice(0, 5).map((qId) => ({
        questionId: qId,
        selectedAnswer: 0,
        correctAnswer: 0,
        isCorrect: true,
        confidenceLevel: 'low', // Low confidence but accurate
        timeTaken: 30,
        difficulty: 'medium',
        topic: 'Mathematics',
      })),
      score: 5,
      percentage: 100,
      totalQuestions: 5,
      isCompleted: true,
      createdAt: new Date(),
    });

    await TopicMastery.create({ userId: student4._id, topic: 'Mathematics', accuracy: 100, avgDifficulty: 'medium', totalAttempts: 1 });
    await StudentProfile.create({ userId: student4._id, adaptiveScore: 80, examReadinessScore: 75 });
    await Prediction.create({ userId: student4._id, predictedScore: 82, predictedDifficultyLevel: 'medium', readinessLevel: 'intermediate' });

    console.log('\n=== SEED DATA LOADED SUCCESSFULLY ===');
    console.log('Admin Login: admin@example.com / password123');
    console.log('Student Login: student@example.com / password123');
    console.log('======================================');

  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

seed();
