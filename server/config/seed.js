const mongoose = require('mongoose');
const User = require('../models/userModel');
const Question = require('../models/questionModel');
const Quiz = require('../models/quizModel');
const Attempt = require('../models/attemptModel');
const dotenv = require('dotenv');

dotenv.config();

const sampleQuestions = [
  // Easy Questions
  {
    questionText: 'Which keyword is used to declare a variable that cannot be reassigned?',
    options: ['let', 'var', 'const', 'define'],
    correctAnswer: 2,
    difficulty: 'easy',
    topic: 'javascript',
    explanation: 'The const keyword declares block-scoped variables that cannot be reassigned after declaration.',
  },
  {
    questionText: 'What is the output of console.log(typeof "Hello")?',
    options: ['string', 'String', 'text', 'object'],
    correctAnswer: 0,
    difficulty: 'easy',
    topic: 'javascript',
    explanation: 'The typeof operator returns a string indicating the type of the unevaluated operand. "Hello" is a primitive string, so it returns "string".',
  },
  {
    questionText: 'Which array method adds one or more elements to the end of an array?',
    options: ['pop()', 'push()', 'shift()', 'unshift()'],
    correctAnswer: 1,
    difficulty: 'easy',
    topic: 'javascript',
    explanation: 'The push() method adds one or more elements to the end of an array and returns the new length of the array.',
  },

  // Medium Questions
  {
    questionText: 'What is the output of console.log(typeof NaN)?',
    options: ['number', 'nan', 'undefined', 'object'],
    correctAnswer: 0,
    difficulty: 'medium',
    topic: 'javascript',
    explanation: 'In JavaScript, NaN (Not-a-Number) is a special value of the Number data type, meaning typeof NaN returns "number".',
  },
  {
    questionText: 'Which of the following is NOT a true closure in JavaScript?',
    options: [
      'A nested function referencing outer variables',
      'A function returned from another function retaining access',
      'An immediately invoked function expression (IIFE) that runs globally',
      'An event handler referencing variables in its parent scope',
    ],
    correctAnswer: 2,
    difficulty: 'medium',
    topic: 'javascript',
    explanation: 'An IIFE that runs globally without capturing any outer lexical scopes is just an executed function block, not a functional closure.',
  },
  {
    questionText: 'What is the output of console.log(0.1 + 0.2 === 0.3)?',
    options: ['true', 'false', 'undefined', 'TypeError'],
    correctAnswer: 1,
    difficulty: 'medium',
    topic: 'javascript',
    explanation: 'Due to double-precision floating-point arithmetic (IEEE 754), 0.1 + 0.2 actually equals 0.30000000000000004, which does not strictly equal 0.3.',
  },

  // Hard Questions
  {
    questionText: 'How does the JavaScript event loop handle microtasks compared to macrotasks?',
    options: [
      'Macrotasks are executed before microtasks in every tick',
      'Microtasks queue is fully exhausted before executing the next macrotask',
      'They are executed concurrently in separate parallel threads',
      'Only one microtask is executed per event loop iteration',
    ],
    correctAnswer: 1,
    difficulty: 'hard',
    topic: 'javascript',
    explanation: 'At the end of each task in the event loop, the microtask queue is fully cleared (exhausted) before control is passed back to run the next macrotask.',
  },
  {
    questionText: 'What does the "use strict" directive accomplish?',
    options: [
      'It compiles JavaScript code to strict typed C++ bytecode',
      'It enforces strict variable declarations and throws errors on silent mistakes',
      'It prevents files from being loaded over HTTP, requiring HTTPS',
      'It restricts external module imports to JSON documents',
    ],
    correctAnswer: 1,
    difficulty: 'hard',
    topic: 'javascript',
    explanation: 'Strict mode makes it easier to write "secure" JavaScript by turning silent errors into real exceptions (e.g. throwing error on assigning to undeclared variables).',
  },
  {
    questionText: 'What is the output of console.log(typeof (class {}))?',
    options: ['class', 'object', 'function', 'undefined'],
    correctAnswer: 2,
    difficulty: 'hard',
    topic: 'javascript',
    explanation: 'Classes in JavaScript are syntactic sugar over prototype constructor functions, so typeof evaluates a class to "function".',
  },

  // Expert Questions
  {
    questionText: 'What is the correct behavior of the Temporal Dead Zone (TDZ) in ES6?',
    options: [
      'It restricts lexical scoping to the global context',
      'It is a state where let/const variables exist but cannot be accessed before lexical initialization',
      'It affects var declarations during compilation',
      'It is a runtime zone where memory leaks are automatically collected'
    ],
    correctAnswer: 1,
    difficulty: 'expert',
    topic: 'javascript',
    explanation: 'The Temporal Dead Zone (TDZ) is the period between scope entry and lexical variable initialization where let/const variables exist in memory but cannot be accessed, throwing a ReferenceError if referenced.',
  },
  {
    questionText: 'Which of the following is true regarding JavaScript prototype inheritance and property shadowing?',
    options: [
      'Modifying a shadowed property on an instance changes the prototype value for all instances',
      'Properties set on prototype are not writeable on individual instances',
      'Setting a property on an instance shadows a property of the same name on the prototype chain',
      'Object.getPrototypeOf() returns the constructor function of the instance'
    ],
    correctAnswer: 2,
    difficulty: 'expert',
    topic: 'javascript',
    explanation: 'Setting a property directly on a child object instance creates a local property of that name, which shadows (hides) the prototype property without altering it.',
  },
  {
    questionText: 'Why does WeakMap allow garbage collection of its keys, unlike Map?',
    options: [
      'Keys in WeakMap must be primitive types which are stored on stack memory',
      'Keys are held via weak references, allowing objects to be garbage collected if there are no other strong references',
      'WeakMap values are automatically deleted after a fixed timeout interval',
      'WeakMap stores all key-value entries in external system process memory'
    ],
    correctAnswer: 1,
    difficulty: 'expert',
    topic: 'javascript',
    explanation: 'WeakMap holds "weak" references to its key objects. If there are no other strong references to a key object left, it is cleared by garbage collection, and its entry is removed from the WeakMap.',
  },
];

const seedDB = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adaptive-quiz');
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await User.deleteMany();
    await Question.deleteMany();
    await Quiz.deleteMany();
    await Attempt.deleteMany();
    console.log('Cleared existing collections.');

    // 1. Create Users
    const admin = await User.create({
      name: 'System Administrator',
      email: 'admin@quiz.com',
      password: 'admin123',
      role: 'admin',
    });

    const student = await User.create({
      name: 'Jane Student',
      email: 'student@quiz.com',
      password: 'student123',
      role: 'student',
    });

    console.log('Seed users created successfully:');
    console.log('- Admin: admin@quiz.com (password: admin123)');
    console.log('- Student: student@quiz.com (password: student123)');

    // 2. Create Questions
    const questionPayloads = sampleQuestions.map((q) => ({
      ...q,
      createdBy: admin._id,
    }));
    const createdQuestions = await Question.insertMany(questionPayloads);
    console.log(`Created ${createdQuestions.length} JavaScript questions.`);

    // 3. Create Quizzes
    // Static Quiz
    const staticQuiz = await Quiz.create({
      title: 'JavaScript Fundamentals (Static)',
      description: 'A static assessment covering basic data types, array methods, and basic scoping rules.',
      isAdaptive: false,
      questions: [
        createdQuestions[0]._id, // const
        createdQuestions[1]._id, // typeof string
        createdQuestions[2]._id, // array push
        createdQuestions[3]._id, // typeof NaN
      ],
      createdBy: admin._id,
    });

    // Adaptive Quiz
    const adaptiveQuiz = await Quiz.create({
      title: 'JavaScript Mastery (AI Adaptive)',
      description: 'An AI-driven adaptive evaluation. The engine scales difficulty based on your answers to test your proficiency level.',
      isAdaptive: true,
      topic: 'javascript',
      createdBy: admin._id,
    });

    console.log('Seed quizzes created successfully:');
    console.log(`- Static Quiz: "${staticQuiz.title}"`);
    console.log(`- Adaptive Quiz: "${adaptiveQuiz.topic}" topic: "${adaptiveQuiz.title}"`);

    mongoose.connection.close();
    console.log('Database seeding complete. Database closed.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();
