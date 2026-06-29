const axios = require('axios');

function cleanJsonResponse(text) {
  if (!text) return '';
  let cleanText = text.trim();
  // Remove markdown code blocks like ```json ... ``` or ``` ... ```
  if (cleanText.startsWith('```')) {
    const lines = cleanText.split('\n');
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    if (lines[lines.length - 1].startsWith('```')) {
      lines.pop();
    }
    cleanText = lines.join('\n').trim();
  }
  return cleanText;
}

// Predefined high-quality question bank for rule-based generation fallback
const QUESTION_POOLS = {
  math: {
    easy: [
      { questionText: "What is 15 + 28?", options: ["33", "43", "45", "38"], correctAnswer: 1, explanation: "15 + 28 = 43." },
      { questionText: "Solve for x: x - 7 = 12.", options: ["5", "19", "14", "15"], correctAnswer: 1, explanation: "Add 7 to both sides: x = 12 + 7 = 19." },
      { questionText: "What is the square root of 64?", options: ["6", "7", "8", "9"], correctAnswer: 2, explanation: "8 * 8 = 64, so the square root is 8." },
      { questionText: "What is 12 * 9?", options: ["98", "108", "118", "106"], correctAnswer: 1, explanation: "12 * 9 = 108." }
    ],
    medium: [
      { questionText: "What is 15 * 12?", options: ["150", "180", "160", "200"], correctAnswer: 1, explanation: "15 * 12 = 180." },
      { questionText: "What is the slope of the line y = 3x - 5?", options: ["3", "-5", "3/5", "-3/5"], correctAnswer: 0, explanation: "In the slope-intercept form y = mx + b, m is the slope, which is 3." },
      { questionText: "If a triangle has angles of 50 and 60 degrees, what is the third angle?", options: ["50", "70", "80", "90"], correctAnswer: 1, explanation: "Sum of angles in a triangle is 180. 180 - (50 + 60) = 70." },
      { questionText: "What is the area of a circle with radius 7? (Use pi = 22/7)", options: ["154", "44", "98", "308"], correctAnswer: 0, explanation: "Area = pi * r^2 = (22/7) * 7 * 7 = 154." }
    ],
    hard: [
      { questionText: "Solve for x: 3x + 5 = 2x - 7.", options: ["-12", "12", "-2", "2"], correctAnswer: 0, explanation: "Subtract 2x: x + 5 = -7. Subtract 5: x = -12." },
      { questionText: "Find the limit: lim (x->3) (x^2 - 9)/(x - 3).", options: ["3", "0", "6", "undefined"], correctAnswer: 2, explanation: "Factor: (x - 3)(x + 3)/(x - 3) = x + 3. Limit as x->3 is 3 + 3 = 6." },
      { questionText: "What is the derivative of f(x) = 3x^2 + 4x - 5?", options: ["6x", "6x + 4", "3x + 4", "6x - 5"], correctAnswer: 1, explanation: "Using power rule: d/dx(3x^2) = 6x, d/dx(4x) = 4, d/dx(-5) = 0." },
      { questionText: "What is the value of log2(128)?", options: ["5", "6", "7", "8"], correctAnswer: 2, explanation: "2^7 = 128, so log2(128) = 7." }
    ],
    expert: [
      { questionText: "Find the integral: integral of 2x dx from 1 to 3.", options: ["4", "8", "6", "9"], correctAnswer: 1, explanation: "Anti-derivative of 2x is x^2. Evaluate from 1 to 3: 3^2 - 1^2 = 9 - 1 = 8." },
      { questionText: "Solve the differential equation: dy/dx = 3y.", options: ["y = Ce^(3x)", "y = 3x + C", "y = Ce^x", "y = 3Ce^x"], correctAnswer: 0, explanation: "Separate variables: dy/y = 3dx. Integrate: ln(y) = 3x + C. Solve for y: y = e^(3x + C) = Ce^(3x)." },
      { questionText: "What is the sum of the infinite geometric series: 1 + 1/3 + 1/9 + 1/27 + ...?", options: ["3/2", "4/3", "2", "3"], correctAnswer: 0, explanation: "Using sum formula S = a / (1 - r) where a = 1 and r = 1/3. S = 1 / (1 - 1/3) = 1 / (2/3) = 3/2." }
    ]
  },
  coding: {
    easy: [
      { questionText: "Which keyword is used to declare a constant in Javascript?", options: ["var", "let", "const", "constant"], correctAnswer: 2, explanation: "'const' declares read-only constant variables." },
      { questionText: "What does HTML stand for?", options: ["Hypertext Markup Language", "Hyperlink Text Markup Language", "Home Tool Markup Language", "Hypertext Machine Language"], correctAnswer: 0, explanation: "HTML is Hypertext Markup Language." },
      { questionText: "Which CSS property changes text color?", options: ["text-color", "color", "font-color", "background-color"], correctAnswer: 1, explanation: "The 'color' property specifies the text color." }
    ],
    medium: [
      { questionText: "What is the output of console.log(typeof null) in JavaScript?", options: ["'null'", "'undefined'", "'object'", "'string'"], correctAnswer: 2, explanation: "Historically, typeof null returns 'object' in JavaScript." },
      { questionText: "Which of the following array methods modifies the original array in JavaScript?", options: ["concat()", "map()", "filter()", "push()"], correctAnswer: 3, explanation: "push() mutates the array. concat(), map(), and filter() return new arrays." },
      { questionText: "What is the default port for HTTP traffic?", options: ["80", "443", "8080", "3000"], correctAnswer: 0, explanation: "HTTP defaults to port 80; HTTPS defaults to 443." }
    ],
    hard: [
      { questionText: "What is a closure in JavaScript?", options: ["A method to close browser tabs", "A function that has access to its outer scope variables even after the outer function returned", "A private class constructor", "An analytical debugger tool"], correctAnswer: 1, explanation: "A closure is the combination of a function bundled together with references to its surrounding state." },
      { questionText: "What is the time complexity of searching in a balanced binary search tree?", options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"], correctAnswer: 2, explanation: "Balanced BST operations take logarithmic time: O(log n)." }
    ],
    expert: [
      { questionText: "Which of the following is true about JavaScript prototype chains?", options: ["Prototype chains can form circular references", "Object.prototype.__proto__ is null", "Function.prototype.__proto__ is Function.prototype", "All prototype chains inherit from class entities"], correctAnswer: 1, explanation: "Object.prototype is at the top of the prototype chain and its proto link is null." },
      { questionText: "How does the Node.js event loop handle microtasks?", options: ["They run after each phase of the event loop", "They run immediately after the current operation finishes (before next event loop phase)", "They are deferred to setImmediate queue", "They run in worker threads"], correctAnswer: 1, explanation: "Microtask callbacks (Promises, process.nextTick) are executed immediately after the currently running script executes." }
    ]
  }
};

// Jaccard similarity checker to normalized word tokens
const getSimilarity = (text1, text2) => {
  if (!text1 || !text2) return 0;
  const normalize = (text) => text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
};

// Check if a question is a duplicate of any existing question in database or currently generated list
async function isDuplicate(questionText, topic, currentList) {
  // Check against currently generated list in this batch
  for (const q of currentList) {
    if (getSimilarity(q.questionText, questionText) > 0.75) {
      return true;
    }
  }

  // Check against database existing questions
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const Question = require('../models/questionModel');
      const existing = await Question.find({ topic: topic.toLowerCase() }).select('questionText').limit(200);
      for (const q of existing) {
        if (getSimilarity(q.questionText, questionText) > 0.75) {
          return true;
        }
      }
    }
  } catch (error) {
    // Fallback if DB connection is unavailable
  }

  return false;
}

// Full quality control check
async function qualityControlCheck(q, topic, difficulty, currentList) {
  // 1. Correct Answer Validation
  if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
    return { valid: false, reason: 'Invalid correct answer index (must be 0-3)' };
  }

  // 2. Option Diversity
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    return { valid: false, reason: 'Must have exactly 4 options' };
  }
  const uniqueOptions = new Set(q.options.map(opt => opt ? opt.trim().toLowerCase() : ''));
  if (uniqueOptions.size !== 4 || uniqueOptions.has('')) {
    return { valid: false, reason: 'Options must be 4 distinct, non-empty values' };
  }

  // 3. Duplicate Question Detection
  if (await isDuplicate(q.questionText, topic, currentList)) {
    return { valid: false, reason: 'Duplicate question text detected (Jaccard similarity > 75%)' };
  }

  // 4. Topic Relevance
  const normalizedTopic = topic.toLowerCase();
  const textToCheck = (q.questionText + ' ' + (q.explanation || '')).toLowerCase();
  
  const topicKeywords = {
    math: ['math', 'solve', 'calculate', 'value', 'equal', 'sum', 'product', 'equation', 'number', 'x', 'y'],
    probability: ['probability', 'chance', 'die', 'dice', 'coin', 'coins', 'card', 'cards', 'random', 'permutation', 'combination', 'outcome'],
    geometry: ['geometry', 'angle', 'triangle', 'circle', 'square', 'rectangle', 'area', 'perimeter', 'polygon', 'radius', 'side', 'shapes'],
    statistics: ['statistics', 'mean', 'median', 'mode', 'distribution', 'deviation', 'variance', 'average', 'data', 'percentile'],
    algebra: ['algebra', 'equation', 'solve', 'expression', 'variables', 'function', 'x', 'quadratic', 'linear'],
    coding: ['code', 'javascript', 'program', 'function', 'array', 'object', 'loop', 'variable', 'complexity', 'class', 'html', 'css']
  };

  let isRelevant = false;
  for (const key of Object.keys(topicKeywords)) {
    if (normalizedTopic.includes(key) || key.includes(normalizedTopic)) {
      const keywords = topicKeywords[key];
      if (keywords.some(kw => textToCheck.includes(kw))) {
        isRelevant = true;
        break;
      }
    }
  }
  
  if (!isRelevant) {
    const generalKeywords = normalizedTopic.split(/\s+/).filter(w => w.length > 2);
    if (generalKeywords.length === 0 || generalKeywords.some(kw => textToCheck.includes(kw))) {
      isRelevant = true;
    }
  }

  if (!isRelevant) {
    return { valid: false, reason: 'Lacks topic relevance to ' + topic };
  }

  // 5. Difficulty Consistency
  if (q.difficulty && q.difficulty.toLowerCase() !== difficulty.toLowerCase()) {
    return { valid: false, reason: 'Difficulty mismatch' };
  }

  // 6. Explanation Quality
  if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim().length < 30) {
    return { valid: false, reason: 'Explanation too short or missing' };
  }
  const badExplanationPhrases = ['correct answer is option', 'correct answer is a', 'correct answer is b', 'correct answer is c', 'correct answer is d'];
  if (badExplanationPhrases.includes(q.explanation.trim().toLowerCase())) {
    return { valid: false, reason: 'Explanation lacks detailed reasoning' };
  }

  return { valid: true };
}

// Generate mathematically unique, dynamically randomized questions for fallback
const generateDynamicMathQuestionInner = (topic, difficulty) => {
  const diff = difficulty.toLowerCase();
  const top = topic.toLowerCase();
  
  if (top.includes('probabilit')) {
    const items = ['marbles', 'socks', 'balls', 'apples', 'pens'];
    const colors = ['red', 'blue', 'green', 'black', 'white'];
    const item = items[Math.floor(Math.random() * items.length)];
    const c1 = colors[Math.floor(Math.random() * colors.length)];
    let c2 = colors[Math.floor(Math.random() * colors.length)];
    while (c1 === c2) c2 = colors[Math.floor(Math.random() * colors.length)];

    const num1 = Math.floor(Math.random() * 8) + 3; // 3 to 10
    const num2 = Math.floor(Math.random() * 8) + 3; // 3 to 10
    const total = num1 + num2;

    if (diff === 'easy') {
      const qText = `A bag contains ${num1} ${c1} ${item} and ${num2} ${c2} ${item}. If you select one at random, what is the probability that it is ${c1}?`;
      
      const seen = new Set();
      const options = [];
      for (const val of [num1, num2, 1, num1 - 1, num2 - 1, num1 + 1, 2, 0]) {
        if (options.length === 4) break;
        if (val >= 0 && val < total && !seen.has(val)) {
          seen.add(val);
          options.push(`${val}/${total}`);
        }
      }
      let pad = 0;
      while (options.length < 4) {
        if (!seen.has(pad) && pad < total) {
          seen.add(pad);
          options.push(`${pad}/${total}`);
        }
        pad++;
      }

      return {
        questionText: qText,
        options,
        correctAnswer: 0,
        explanation: `Total ${item} is ${num1} + ${num2} = ${total}. The probability of picking ${c1} is the number of ${c1} ${item} divided by total, which is ${num1}/${total}.`,
      };
    } else if (diff === 'medium') {
      const total2 = total - 1;
      const qText = `A drawer contains ${num1} ${c1} ${item} and ${num2} ${c2} ${item}. If you pick two at random without replacement, what is the probability that both are ${c1}?`;
      const numCorrect = num1 * (num1 - 1);
      const denCorrect = total * total2;

      const seen = new Set();
      const options = [];
      const pool = [numCorrect - 2, numCorrect, num1 * total, num1 * num2, numCorrect + 2, numCorrect - 1];
      const wrongPool = [];
      for (const val of pool) {
        if (val !== numCorrect && val > 0 && val < denCorrect && !seen.has(val)) {
          seen.add(val);
          wrongPool.push(`${val}/${denCorrect}`);
        }
      }
      let pad = 1;
      while (wrongPool.length < 3) {
        if (pad !== numCorrect && !seen.has(pad) && pad < denCorrect) {
          seen.add(pad);
          wrongPool.push(`${pad}/${denCorrect}`);
        }
        pad++;
      }
      
      options.push(wrongPool[0]);
      options.push(`${numCorrect}/${denCorrect}`);
      options.push(wrongPool[1]);
      options.push(wrongPool[2]);

      return {
        questionText: qText,
        options,
        correctAnswer: 1,
        explanation: `First pick probability: ${num1}/${total}. Second pick probability: ${num1 - 1}/${total2}. Multiply them: (${num1}/${total}) * (${num1 - 1}/${total2}) = ${numCorrect}/${denCorrect}.`,
      };
    } else if (diff === 'hard') {
      const qText = `A box has ${num1} ${c1} and ${num2} ${c2} ${item}. If you pick two at random with replacement, what is the probability that they are of different colors?`;
      const numCorrect = 2 * num1 * num2;
      const denCorrect = total * total;

      const seen = new Set();
      const pool = [num1 * num2, num1 * (num1 - 1), num2 * (num2 - 1), numCorrect - 1, numCorrect + 1];
      const wrongPool = [];
      for (const val of pool) {
        if (val !== numCorrect && val > 0 && val < denCorrect && !seen.has(val)) {
          seen.add(val);
          wrongPool.push(`${val}/${denCorrect}`);
        }
      }
      let pad = 1;
      while (wrongPool.length < 3) {
        if (pad !== numCorrect && !seen.has(pad) && pad < denCorrect) {
          seen.add(pad);
          wrongPool.push(`${pad}/${denCorrect}`);
        }
        pad++;
      }

      const options = [wrongPool[0], wrongPool[1], `${numCorrect}/${denCorrect}`, wrongPool[2]];

      return {
        questionText: qText,
        options,
        correctAnswer: 2,
        explanation: `The probability of different colors is P(${c1} then ${c2}) + P(${c2} then ${c1}). With replacement, P(${c1},${c2}) = (${num1}/${total}) * (${num2}/${total}) = ${num1 * num2}/${denCorrect}. Same for P(${c2},${c1}). Total is 2 * (${num1 * num2})/${denCorrect} = ${numCorrect}/${denCorrect}.`,
      };
    } else {
      const n = Math.floor(Math.random() * 3) + 4; // 4 to 6
      const k = Math.floor(Math.random() * (n - 2)) + 2; // 2 to n-1
      const fact = (num) => num <= 1 ? 1 : num * fact(num - 1);
      const ways = fact(n) / (fact(k) * fact(n - k));
      const totalOutcomes = Math.pow(2, n);
      const qText = `If you flip a fair coin ${n} times, what is the probability of getting exactly ${k} heads?`;
      const ansVal = `${ways}/${totalOutcomes}`;
      
      const seen = new Set();
      seen.add(ansVal);
      const wrongPool = [];
      const pool = [ways - 1, ways + 1, ways + 2, ways - 2];
      for (const val of pool) {
        if (val > 0 && val < totalOutcomes) {
          const opt = `${val}/${totalOutcomes}`;
          if (!seen.has(opt)) {
            seen.add(opt);
            wrongPool.push(opt);
          }
        }
      }
      while (wrongPool.length < 3) {
        const val = Math.floor(Math.random() * totalOutcomes);
        const opt = `${val}/${totalOutcomes}`;
        if (!seen.has(opt)) {
          seen.add(opt);
          wrongPool.push(opt);
        }
      }
      const options = [wrongPool[0], wrongPool[1], wrongPool[2], ansVal];
      return {
        questionText: qText,
        options,
        correctAnswer: 3,
        explanation: `The total number of outcomes is 2^${n} = ${totalOutcomes}. The number of ways to get exactly ${k} heads is ${n} choose ${k} = ${ways}. Thus, the probability is ${ways}/${totalOutcomes}.`,
      };
    }
  } else if (top.includes('geometry')) {
    const base = Math.floor(Math.random() * 8) + 4; // 4 to 11
    const height = Math.floor(Math.random() * 8) + 4; // 4 to 11
    
    if (diff === 'easy') {
      const qText = `Calculate the area of a right-angled triangle with base = ${base} cm and height = ${height} cm.`;
      const area = 0.5 * base * height;

      const seen = new Set();
      const pool = [base * height, base + height, base * height + 2, area + 5, area - 3];
      const wrongPool = [];
      for (const val of pool) {
        if (val !== area && val > 0 && !seen.has(val)) {
          seen.add(val);
          wrongPool.push(`${val} sq cm`);
        }
      }
      let pad = 1;
      while (wrongPool.length < 3) {
        if (pad !== area && !seen.has(pad)) {
          seen.add(pad);
          wrongPool.push(`${pad} sq cm`);
        }
        pad++;
      }

      const options = [wrongPool[0], `${area} sq cm`, wrongPool[1], wrongPool[2]];

      return {
        questionText: qText,
        options,
        correctAnswer: 1,
        explanation: `Area of a triangle is (base * height) / 2 = (${base} * ${height}) / 2 = ${area} sq. cm.`,
      };
    } else if (diff === 'medium') {
      const side = Math.floor(Math.random() * 15) + 3; // 3 to 17
      const area = side * side;
      const qText = `If the perimeter of a square is ${4 * side} cm, what is its area?`;

      const seen = new Set();
      const pool = [4 * side, 2 * side, side * side + 4, area + 8, area - 4];
      const wrongPool = [];
      for (const val of pool) {
        if (val !== area && val > 0 && !seen.has(val)) {
          seen.add(val);
          wrongPool.push(`${val} sq cm`);
        }
      }
      let pad = 1;
      while (wrongPool.length < 3) {
        if (pad !== area && !seen.has(pad)) {
          seen.add(pad);
          wrongPool.push(`${pad} sq cm`);
        }
        pad++;
      }

      const options = [wrongPool[0], wrongPool[1], `${area} sq cm`, wrongPool[2]];

      return {
        questionText: qText,
        options,
        correctAnswer: 2,
        explanation: `Perimeter of a square is 4 * side = ${4 * side} cm, so side is ${side} cm. Area of square is side^2 = ${side} * ${side} = ${area} sq. cm.`,
      };
    } else if (diff === 'hard') {
      const r = Math.floor(Math.random() * 12) + 2; // 2 to 13
      const areaRect = 4 * r * (2 * r);
      const qText = `A rectangle is circumscribed around two identical circles of radius ${r} cm placed side-by-side. What is the area of the rectangle?`;

      const seen = new Set();
      const pool = [r * r * 4, r * r * 8, areaRect - 5, areaRect + 6];
      const wrongPool = [];
      for (const val of pool) {
        if (val !== areaRect && val > 0 && !seen.has(val)) {
          seen.add(val);
          wrongPool.push(`${val} sq cm`);
        }
      }
      let pad = 1;
      while (wrongPool.length < 3) {
        if (pad !== areaRect && !seen.has(pad)) {
          seen.add(pad);
          wrongPool.push(`${pad} sq cm`);
        }
        pad++;
      }

      const options = [`${areaRect} sq cm`, wrongPool[0], wrongPool[1], wrongPool[2]];

      return {
        questionText: qText,
        options,
        correctAnswer: 0,
        explanation: `Two circles side-by-side will have length = 4 * radius = ${4 * r} cm, and width = 2 * radius = ${2 * r} cm. The area of circumscribing rectangle is length * width = ${4 * r} * ${2 * r} = ${areaRect} sq. cm.`,
      };
    } else {
      const s = Math.floor(Math.random() * 10) + 1; // 1 to 10
      const hyp = 10 * s;
      const leg = 6 * s;
      const height = 8 * s;
      const radius = 6 * s;
      const vol = 96 * s * s * s;
      const qText = `In a right triangle, the hypotenuse is ${hyp} cm and one leg is ${leg} cm. If the triangle is rotated around its longer leg to form a cone, what is the volume of the cone in terms of pi?`;
      const ansVal = `${vol} pi cubic cm`;
      const wrong1 = `${vol + 32} pi cubic cm`;
      const wrong2 = `${vol * 2} pi cubic cm`;
      const wrong3 = `${vol - 16} pi cubic cm`;
      const options = [wrong1, ansVal, wrong2, wrong3];
      return {
        questionText: qText,
        options,
        correctAnswer: 1,
        explanation: `By Pythagoras theorem, the longer leg (height) is sqrt(${hyp}^2 - ${leg}^2) = ${height} cm. The radius is the shorter leg = ${radius} cm. The volume of the cone is (1/3) * pi * r^2 * h = (1/3) * pi * ${radius * radius} * ${height} = ${vol} pi cubic cm.`,
      };
    }
  } else if (top.includes('statistics')) {
    const list = [
      Math.floor(Math.random() * 5) + 1,
      Math.floor(Math.random() * 5) + 3,
      Math.floor(Math.random() * 5) + 5,
      Math.floor(Math.random() * 5) + 7,
      Math.floor(Math.random() * 5) + 9,
    ];
    const sum = list.reduce((a, b) => a + b, 0);
    const mean = sum / 5;

    if (diff === 'easy') {
      const qText = `Find the mean of the following five numbers: ${list.join(', ')}.`;

      const seen = new Set();
      const roundedMean = Math.round(mean * 10) / 10;
      seen.add(roundedMean);

      const pool = [mean + 1.2, mean - 0.8, mean + 2.5, mean + 1.5];
      const wrongPool = [];
      for (const val of pool) {
        const rounded = Math.round(val * 10) / 10;
        if (!seen.has(rounded)) {
          seen.add(rounded);
          wrongPool.push(`${rounded}`);
        }
      }
      while (wrongPool.length < 3) {
        const val = Math.round((mean + Math.random() * 10 - 5) * 10) / 10;
        if (!seen.has(val)) {
          seen.add(val);
          wrongPool.push(`${val}`);
        }
      }

      const options = [wrongPool[0], wrongPool[1], wrongPool[2], `${roundedMean}`];

      return {
        questionText: qText,
        options,
        correctAnswer: 3,
        explanation: `Mean is the sum of all values divided by total count: (${list.join(' + ')}) / 5 = ${sum} / 5 = ${mean}.`,
      };
    } else if (diff === 'medium') {
      const sorted = [...list].sort((a, b) => a - b);
      const median = sorted[2];
      const qText = `Find the median of the following numbers: ${list.join(', ')}.`;

      const seen = new Set();
      seen.add(Math.round(median));

      const pool = [median + 1, median - 1, Math.round(mean)];
      const wrongPool = [];
      for (const val of pool) {
        const rounded = Math.round(val);
        if (!seen.has(rounded) && rounded >= 0) {
          seen.add(rounded);
          wrongPool.push(`${rounded}`);
        }
      }
      while (wrongPool.length < 3) {
        const val = Math.round(median + Math.floor(Math.random() * 10) - 5);
        if (!seen.has(val) && val >= 0) {
          seen.add(val);
          wrongPool.push(`${val}`);
        }
      }

      const options = [wrongPool[0], `${Math.round(median)}`, wrongPool[1], wrongPool[2]];

      return {
        questionText: qText,
        options,
        correctAnswer: 1,
        explanation: `To find the median, arrange in ascending order: ${sorted.join(', ')}. The middle (3rd) value is ${median}.`,
      };
    } else if (diff === 'hard') {
      const meanSquareDiff = list.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
      const populationVariance = Math.round((meanSquareDiff / 5) * 100) / 100;
      
      const qText = `Calculate the population variance of the following data set: ${list.join(', ')}.`;

      const seen = new Set();
      seen.add(populationVariance);

      const pool = [populationVariance + 2.1, populationVariance - 1.5, Math.round(Math.sqrt(populationVariance) * 100) / 100];
      const wrongPool = [];
      for (const val of pool) {
        const rounded = Math.round(val * 100) / 100;
        if (!seen.has(rounded) && rounded >= 0) {
          seen.add(rounded);
          wrongPool.push(`${rounded}`);
        }
      }
      while (wrongPool.length < 3) {
        const val = Math.round((populationVariance + Math.random() * 5) * 100) / 100;
        if (!seen.has(val) && val >= 0) {
          seen.add(val);
          wrongPool.push(`${val}`);
        }
      }

      const options = [wrongPool[0], wrongPool[1], wrongPool[2], `${populationVariance}`];

      return {
        questionText: qText,
        options,
        correctAnswer: 3,
        explanation: `Mean is ${mean}. Subtract mean and square differences: [${list.map(v => Math.round(Math.pow(v - mean, 2) * 100) / 100).join(', ')}]. Average of squared diffs is ${meanSquareDiff} / 5 = ${populationVariance}.`,
      };
    } else {
      const mu = (Math.floor(Math.random() * 10) + 10) * 10; // 100 to 190
      const sd = Math.floor(Math.random() * 10) + 5; // 5 to 14
      const low = mu - 2 * sd;
      const high = mu + 2 * sd;
      const qText = `In a normal distribution with mean = ${mu} and standard deviation = ${sd}, what percentage of the population lies between ${low} and ${high}?`;
      const ansVal = `Approximately 95%`;
      const wrong1 = `Approximately 68%`;
      const wrong2 = `Approximately 99.7%`;
      const wrong3 = `Approximately 50%`;
      const options = [wrong1, ansVal, wrong2, wrong3];
      return {
        questionText: qText,
        options,
        correctAnswer: 1,
        explanation: `The range ${low} to ${high} represents mean +/- 2 standard deviations (${mu} +/- 2 * ${sd}). According to the empirical rule (68-95-99.7 rule), approximately 95% of the data lies within 2 standard deviations of the mean.`,
      };
    }
  } else if (top.includes('algebra')) {
    const root1 = Math.floor(Math.random() * 4) + 1; // 1 to 4
    const root2 = Math.floor(Math.random() * 4) + 5; // 5 to 8
    const sumRoots = root1 + root2;
    const prodRoots = root1 * root2;

    if (diff === 'easy') {
      const val1 = Math.floor(Math.random() * 15) + 5;
      const val2 = Math.floor(Math.random() * 10) + 2;
      const ans = val1 - val2;
      const qText = `Solve for x: x + ${val2} = ${val1}.`;

      const seen = new Set();
      seen.add(ans);

      const pool = [val1 + val2, ans - 2, ans + 3];
      const wrongPool = [];
      for (const val of pool) {
        if (!seen.has(val)) {
          seen.add(val);
          wrongPool.push(`${val}`);
        }
      }
      while (wrongPool.length < 3) {
        const val = ans + Math.floor(Math.random() * 10) + 1;
        if (!seen.has(val)) {
          seen.add(val);
          wrongPool.push(`${val}`);
        }
      }

      const options = [wrongPool[0], wrongPool[1], `${ans}`, wrongPool[2]];

      return {
        questionText: qText,
        options,
        correctAnswer: 2,
        explanation: `Subtract ${val2} from both sides: x = ${val1} - ${val2} = ${ans}.`,
      };
    } else if (diff === 'medium') {
      const coeff = Math.floor(Math.random() * 4) + 2; // 2 to 5
      const constVal = Math.floor(Math.random() * 10) + 1; // 1 to 10
      const rhs = coeff * root1 + constVal;
      const qText = `Solve for x: ${coeff}x + ${constVal} = ${rhs}.`;

      const seen = new Set();
      seen.add(root1);

      const pool = [root1 + 2, root1 - 1, root1 * 2];
      const wrongPool = [];
      for (const val of pool) {
        if (!seen.has(val) && val >= 0) {
          seen.add(val);
          wrongPool.push(`${val}`);
        }
      }
      while (wrongPool.length < 3) {
        const val = root1 + Math.floor(Math.random() * 10) + 1;
        if (!seen.has(val)) {
          seen.add(val);
          wrongPool.push(`${val}`);
        }
      }

      const options = [wrongPool[0], `${root1}`, wrongPool[1], wrongPool[2]];

      return {
        questionText: qText,
        options,
        correctAnswer: 1,
        explanation: `Subtract ${constVal}: ${coeff}x = ${rhs - constVal}. Divide by ${coeff}: x = ${root1}.`,
      };
    } else if (diff === 'hard') {
      const qText = `Find the roots of the quadratic equation: x^2 - ${sumRoots}x + ${prodRoots} = 0.`;
      const ansVal = `x = ${root1}, x = ${root2}`;
      const wrong1 = `x = -${root1}, x = -${root2}`;
      const wrong2 = `x = ${root1}, x = -${root2}`;
      const wrong3 = `x = -${root1}, x = ${root2}`;
      const options = [wrong1, wrong2, wrong3, ansVal];
      return {
        questionText: qText,
        options,
        correctAnswer: 3,
        explanation: `Factoring the quadratic equation gives (x - ${root1})(x - ${root2}) = 0. Thus, x = ${root1} or x = ${root2}.`,
      };
    } else {
      const a = Math.floor(Math.random() * 3) + 2; // 2 to 4
      const b = Math.floor(Math.random() * 4) + 2; // 2 to 5
      const coeff_x2 = a * a;
      const coeff_x = 2 * a * b;
      const constantVal = b * b - 1;
      const qText = `If f(x) = ${a}x + ${b} and g(x) = x^2 - 1, find the composite function g(f(x)).`;
      const ansVal = `${coeff_x2}x^2 + ${coeff_x}x + ${constantVal}`;
      const wrong1 = `${coeff_x2}x^2 + ${constantVal + 1}`;
      const wrong2 = `${coeff_x2}x^2 + ${coeff_x}x + ${constantVal + 1}`;
      const wrong3 = `${a}x^2 + ${coeff_x}x + ${constantVal}`;
      const options = [wrong1, wrong2, wrong3, ansVal];
      return {
        questionText: qText,
        options,
        correctAnswer: 3,
        explanation: `g(f(x)) = g(${a}x + ${b}) = (${a}x + ${b})^2 - 1 = (${coeff_x2}x^2 + ${coeff_x}x + ${b * b}) - 1 = ${coeff_x2}x^2 + ${coeff_x}x + ${constantVal}.`,
      };
    }
  }

  // Check if it is a coding topic
  const codingKeywords = ['code', 'coding', 'program', 'develop', 'variable', 'loop', 'array', 'class', 'method', 'constant', 'javascript', 'python', 'html', 'css', 'software'];
  const isCoding = codingKeywords.some(kw => top.includes(kw));

  if (isCoding) {
    const codeTopics = ['variable', 'loop', 'array', 'class', 'method', 'constant'];
    const topicTerm = codeTopics[Math.floor(Math.random() * codeTopics.length)];

    if (diff === 'easy') {
      return {
        questionText: `Which of the following is the standard syntax to declare a local ${topicTerm} in modern web development?`,
        options: [
          `Using specialized core compiler tags for ${topicTerm}`,
          `Using standard structured keywords matching ${topicTerm}`,
          `Invoking system configuration libraries`,
          `Directly writing machine assembly scripts`
        ],
        correctAnswer: 1,
        explanation: `Modern developer syntax relies on standard structured keywords designed for declaring a ${topicTerm}.`,
      };
    } else if (diff === 'medium') {
      return {
        questionText: `When implementing a custom ${topicTerm} framework, what is a key design pattern for managing its lifecycle?`,
        options: [
          `Executing synchronous loop threads in background workers`,
          `Bypassing sandbox constraints on local memory variables`,
          `Separating allocation and reference mapping inside the ${topicTerm} model`,
          `Exporting raw database files to the public repository`
        ],
        correctAnswer: 2,
        explanation: `Proper ${topicTerm} lifecycle execution requires separation of memory allocation from reference mappings.`,
      };
    } else if (diff === 'hard') {
      return {
        questionText: `During high-throughput load tests on a ${topicTerm} cluster, what is the principal bottleneck for memory leaks?`,
        options: [
          `Unreleased references and circular scopes containing the ${topicTerm} instance`,
          `Excessive CSS template renderings`,
          `Encryption algorithms slowing down database authentication`,
          `Slow network bandwidth handshakes`
        ],
        correctAnswer: 0,
        explanation: `Circular scopes and unreleased references are primary drivers of memory leaks for a ${topicTerm} in active memory.`,
      };
    } else {
      return {
        questionText: `In low-level runtime engines, how does garbage collection optimize the compilation phase for a ${topicTerm}?`,
        options: [
          `It bypasses variable scopes and treats everything as static global templates`,
          `It performs escape analysis to decide whether to allocate the ${topicTerm} on the stack versus the heap`,
          `It disables system interrupts during array searches`,
          `It encrypts memory addresses to protect stack pointers`
        ],
        correctAnswer: 1,
        explanation: `Escape analysis allows optimization engines to evaluate if a ${topicTerm} can be stack-allocated, which avoids garbage collection overhead.`,
      };
    }
  } else {
    // General conceptual fallback questions for non-math/non-coding topics
    const capTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
    
    if (diff === 'easy') {
      const templates = [
        {
          questionText: `Which of the following best defines the primary concept or principle of ${capTopic}?`,
          options: [
            `A systematic framework designed to analyze and apply core rules of ${topic}`,
            `A temporary phenomenon that has no direct relation to ${topic}`,
            `An obsolete design structure replaced by mechanical systems`,
            `A graphical display method designed to mask variables`
          ],
          correctAnswer: 0,
          explanation: `The core principle of ${topic} is defined as a systematic framework to analyze and apply its foundational guidelines.`,
        },
        {
          questionText: `What is considered a primary objective when studying the dynamics of ${capTopic}?`,
          options: [
            `To restrict the applications of ${topic} to obsolete local frameworks`,
            `To formulate a structured understanding of core definitions and applications of ${topic}`,
            `To estimate values using completely arbitrary criteria`,
            `To identify stylistic details that are unrelated to standard ${topic}`
          ],
          correctAnswer: 1,
          explanation: `A primary objective of studying ${topic} is to gain a structured understanding of its main concepts and applications.`,
        }
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    } else if (diff === 'medium') {
      const templates = [
        {
          questionText: `How is the knowledge of ${capTopic} typically applied to solve modern domain-specific problems?`,
          options: [
            `By running legacy processes that bypass security constraints`,
            `By using standard frameworks of ${topic} to evaluate practical scenarios and find optimal outcomes`,
            `By storing all local operations in global config registers`,
            `By ignoring empirical research and domain-specific benchmarks`
          ],
          correctAnswer: 1,
          explanation: `Applying the frameworks of ${topic} allows practitioners to evaluate real-world scenarios and determine optimal outcomes.`,
        },
        {
          questionText: `What represents a key variable or parameter to monitor when executing a plan based on ${capTopic}?`,
          options: [
            `Whether the core attributes of ${topic} align with expected constraints and criteria`,
            `The total count of background processes running in raw assembly`,
            `The absolute frequency of unmonitored memory leaks`,
            `The quantity of public access keys published in open source folders`
          ],
          correctAnswer: 0,
          explanation: `Monitoring how the core attributes of ${topic} align with criteria is essential for successful execution of the plan.`,
        }
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    } else if (diff === 'hard') {
      const templates = [
        {
          questionText: `In a complex system that relies on ${capTopic}, what is the cascading impact if a core parameter is changed?`,
          options: [
            `The system automatically halts and drops all local connections`,
            `The dependent relationships within the ${topic} system shift, requiring adjustments to associated variables`,
            `All local variables are promoted to global system properties`,
            `The system reboots and restores original database files`
          ],
          correctAnswer: 1,
          explanation: `Changing a core parameter in a ${topic} system shifts dependent relationships and requires adjusting related variables.`,
        }
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    } else {
      // expert
      const templates = [
        {
          questionText: `When analyzing advanced theoretical boundary conditions in ${capTopic}, how are conflicting constraints resolved?`,
          options: [
            `By assuming standard simplified constraints and ignoring edge cases`,
            `By formulating multi-objective analytical or mathematical models specific to the ${topic} domain`,
            `By bypassing validation checks and compiling memory stacks directly`,
            `By reverting all parameters to basic definitions automatically`
          ],
          correctAnswer: 1,
          explanation: `Conflicting theoretical boundary constraints in ${topic} are resolved by utilizing advanced multi-objective analytical models.`,
        }
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }
  }
};

const addPhrasingDiversity = (qText) => {
  const queryPrefixes = [
    "Solve the following: ",
    "Solve this problem: ",
    "Find the correct answer: ",
    "What is the result: ",
    "Based on the context, solve: ",
    "Compute the value: ",
    "Calculate the outcome of: ",
    "Answer this math query: ",
    "Analyze and answer: ",
    "Determine the solution: "
  ];
  
  const querySuffixes = [
    " Please show your steps.",
    " Express the answer clearly.",
    " Choose the most appropriate option.",
    " Provide the correct response.",
    " Round to nearest decimal if needed.",
    " Verify your calculation.",
    " Use mathematical principles.",
    " Select the best choice.",
    " Double check your reasoning.",
    " Answer based on core math rules."
  ];

  const prefix = queryPrefixes[Math.floor(Math.random() * queryPrefixes.length)];
  const suffix = querySuffixes[Math.floor(Math.random() * querySuffixes.length)];

  let modifiedQText = qText;
  if (qText && qText.length > 0) {
    modifiedQText = qText.charAt(0).toLowerCase() + qText.slice(1);
  }
  
  return `${prefix}${modifiedQText}${suffix}`;
};

const generateDynamicMathQuestion = (topic, difficulty) => {
  const q = generateDynamicMathQuestionInner(topic, difficulty);
  q.questionText = addPhrasingDiversity(q.questionText);
  return q;
};

/**
 * Validate a single generated question to ensure compatibility with adaptive/confidence database structures.
 */
function validateQuestion(q, topic, difficulty) {
  if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim() === '') {
    return false;
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    return false;
  }
  if (q.options.some(opt => typeof opt !== 'string' || opt.trim() === '')) {
    return false;
  }
  if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
    return false;
  }
  
  // Set default values for metadata if missing
  q.topic = (q.topic || topic || 'general').toLowerCase();
  q.difficulty = (q.difficulty || difficulty || 'medium').toLowerCase();
  if (!['easy', 'medium', 'hard', 'expert'].includes(q.difficulty)) {
    q.difficulty = 'medium';
  }
  q.explanation = q.explanation || `The correct answer is option ${String.fromCharCode(65 + q.correctAnswer)}.`;
  
  return true;
}

/**
 * Core question generator service (Gemini + OpenAI ready, with rule-based fallback).
 */
async function generateQuestions({ topic, difficulty, numberOfQuestions = 5, questionType = 'MCQ', pdfContent, userId, action }) {
  const count = Number(numberOfQuestions) || 5;
  const diff = (difficulty || 'medium').toLowerCase();
  const top = (topic || 'general').toLowerCase();

  const validatedList = [];
  let attempts = 0;
  const maxAttempts = 3;

  const startTime = Date.now();
  let promptUsed = '';
  let apiErrorMessage = '';
  const validationErrors = [];

  // 1. LLM Mode: Gemini
  if (process.env.GEMINI_API_KEY && validatedList.length < count) {
    while (validatedList.length < count && attempts < maxAttempts) {
      attempts++;
      const remainingCount = count - validatedList.length;
      try {
        const pdfConstraint = pdfContent ? `\nCRITICAL: Generate questions strictly based on the following text content extracted from a study document/PDF:\n"""\n${pdfContent}\n"""\nQuestions MUST ONLY reference facts, concepts, definitions, or formulas discussed in this text.` : '';
        
        const prompt = `Generate exactly ${remainingCount} unique multiple choice questions (MCQ) about "${top}" with "${diff}" difficulty.${pdfConstraint}

                Difficulty Guidelines:
                - "easy": Direct recall of terminology, definitions, and basic principles. Simple, single-step questions.
                - "medium": Application-based concepts, interpreting examples, or single-step formula applications.
                - "hard": Multi-step reasoning, combination of two or more distinct concepts, or algebraic/logical derivations.
                - "expert": Advanced analytical problem solving, edge cases, complex composite structures, or theoretical failures/proofs.

                For each question, return exactly 4 options, the 0-indexed correctAnswer, and a detailed explanation (minimum 30 characters, explaining the reasoning and why the others are wrong).
                Format your response ONLY as a JSON array matching this schema:
                [
                  {
                    "questionText": "Question string?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correctAnswer": 0,
                    "explanation": "Detailed explanation string",
                    "topic": "${top}",
                    "difficulty": "${diff}"
                  }
                ]
                
                DO NOT generate questions similar to: ${validatedList.map(q => q.questionText).join(' | ')}`;

        promptUsed = prompt;

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          }
        );
        
        const resText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleanText = cleanJsonResponse(resText);
        const parsed = JSON.parse(cleanText);
        const questionsList = parsed.questions || parsed.array || (Array.isArray(parsed) ? parsed : Object.values(parsed)[0]);
        if (Array.isArray(questionsList)) {
          for (const q of questionsList) {
            const fullQ = { ...q, topic: q.topic || top, difficulty: q.difficulty || diff };
            const qc = await qualityControlCheck(fullQ, top, diff, validatedList);
            if (qc.valid) {
              validatedList.push(fullQ);
            } else {
              console.warn('[AIService] Question rejected by QC:', qc.reason);
              validationErrors.push(`${fullQ.questionText || 'Empty question'}: ${qc.reason}`);
            }
          }
        }
      } catch (e) {
        console.warn('[AIService] Gemini Question Gen failed. Error:', e.message);
        apiErrorMessage = `Gemini Error: ${e.message}`;
        break; // break loop to fallback
      }
    }
  }

  // 2. LLM Mode: OpenAI
  if (process.env.OPENAI_API_KEY && validatedList.length < count) {
    attempts = 0;
    while (validatedList.length < count && attempts < maxAttempts) {
      attempts++;
      const remainingCount = count - validatedList.length;
      try {
        const pdfConstraint = pdfContent ? `\nCRITICAL: Generate questions strictly based on the following text content extracted from a study document/PDF:\n"""\n${pdfContent}\n"""\nQuestions MUST ONLY reference facts, concepts, definitions, or formulas discussed in this text.` : '';
        
        const prompt = `Generate exactly ${remainingCount} unique multiple choice questions (MCQ) about "${top}" with "${diff}" difficulty.${pdfConstraint}
              
              Difficulty Guidelines:
              - "easy": Direct recall of terminology, definitions, and basic principles. Simple, single-step questions.
              - "medium": Application-based concepts, interpreting examples, or single-step formula applications.
              - "hard": Multi-step reasoning, combination of two or more distinct concepts, or algebraic/logical derivations.
              - "expert": Advanced analytical problem solving, edge cases, complex composite structures, or theoretical failures/proofs.

              Format response as a JSON array matching this schema:
              [
                {
                  "questionText": "Question string?",
                  "options": ["Option A", "Option B", "Option C", "Option D"],
                  "correctAnswer": 0,
                  "explanation": "Detailed explanation string",
                  "topic": "${top}",
                  "difficulty": "${diff}"
                }
              ]
              
              DO NOT generate questions similar to: ${validatedList.map(q => q.questionText).join(' | ')}`;

        promptUsed = prompt;

        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: prompt
            }],
            response_format: { type: 'json_object' }
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const resText = response.data?.choices?.[0]?.message?.content;
        const cleanText = cleanJsonResponse(resText);
        const parsed = JSON.parse(cleanText);
        const questionsList = parsed.questions || parsed.array || (Array.isArray(parsed) ? parsed : Object.values(parsed)[0]);
        if (Array.isArray(questionsList)) {
          for (const q of questionsList) {
            const fullQ = { ...q, topic: q.topic || top, difficulty: q.difficulty || diff };
            const qc = await qualityControlCheck(fullQ, top, diff, validatedList);
            if (qc.valid) {
              validatedList.push(fullQ);
            } else {
              console.warn('[AIService] Question rejected by QC:', qc.reason);
              validationErrors.push(`${fullQ.questionText || 'Empty question'}: ${qc.reason}`);
            }
          }
        }
      } catch (e) {
        console.warn('[AIService] OpenAI Question Gen failed. Error:', e.message);
        apiErrorMessage = apiErrorMessage ? `${apiErrorMessage} | OpenAI Error: ${e.message}` : `OpenAI Error: ${e.message}`;
        break; // break loop to fallback
      }
    }
  }

  // 3. Fallback: Dynamic Parameterized Rule-Based Generator
  if (validatedList.length < count) {
    console.log(`[AIService] Running dynamic rule-based question generation to top-up to ${count} questions (current: ${validatedList.length})`);
    if (!promptUsed) {
      promptUsed = 'Fallback: Dynamic Parameterized Rule-Based Generator';
    }
    
    let fallbackLoop = 0;
    while (validatedList.length < count && fallbackLoop < Math.max(50, count * 5)) {
      fallbackLoop++;
      const rawQ = generateDynamicMathQuestion(top, diff);
      const fullQ = { ...rawQ, topic: top, difficulty: diff, generatedByAI: true };
      const qc = await qualityControlCheck(fullQ, top, diff, validatedList);
      if (qc.valid) {
        validatedList.push(fullQ);
      } else {
        validationErrors.push(`${fullQ.questionText || 'Empty question'}: ${qc.reason}`);
      }
    }
  }

  const generationTimeMs = Date.now() - startTime;
  const success = validatedList.length >= count;

  if (userId) {
    try {
      const AILog = require('../models/aiLogModel');
      await AILog.create({
        userId,
        action: action || 'question_generation',
        topic: top,
        difficulty: diff,
        prompt: promptUsed || 'Fallback Rule-Based Generator',
        generatedQuestions: validatedList,
        validationResults: {
          success: validationErrors.length === 0 && validatedList.length > 0,
          errors: validationErrors
        },
        generationTimeMs,
        errorMessage: apiErrorMessage,
        success
      });
    } catch (logErr) {
      console.error('[AILog] Failed to save log inside generateQuestions:', logErr.message);
    }
  }

  return validatedList;
}

module.exports = { generateQuestions, validateQuestion, qualityControlCheck, getSimilarity };
