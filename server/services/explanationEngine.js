/**
 * Explanation Engine
 * Generates step-by-step explanations for quiz questions.
 * Uses stored question.explanation field + rule-based augmentation.
 * Architecture is LLM-ready: swap generateExplanation() body for API call.
 */

const DIFFICULTY_HINTS = {
  easy: 'This is a foundational concept. Review the basics of this topic.',
  medium: 'This requires solid understanding of core concepts. Try working through examples step by step.',
  hard: 'This is an advanced problem. Focus on identifying the underlying pattern or formula.',
  expert: 'This is expert-level. Break the problem into smaller parts and verify each step.',
};

const CONFIDENCE_FEEDBACK = {
  'correct-high': '✅ Great — your high confidence matched your correct answer. This topic is building towards mastery.',
  'correct-medium': '✅ You got it right with moderate confidence. Review this concept once more to solidify your understanding.',
  'correct-low': '⚠️ You got it right but had low confidence. Practice more to build self-belief in this topic.',
  'wrong-high': '❌ You were highly confident but answered incorrectly. This is a common overconfidence pattern. Review the fundamentals carefully.',
  'wrong-medium': '❌ You were moderately confident but answered incorrectly. Take time to re-read the concept before your next attempt.',
  'wrong-low': '❌ You expected to get this wrong — and did. Try some easier questions on this topic first.',
};

/**
 * Generate a structured explanation for a question response.
 * @param {Object} params
 * @param {Object} params.question - Full Question document
 * @param {number} params.selectedAnswer - Index of selected option
 * @param {boolean} params.isCorrect
 * @param {string} params.confidenceLevel - 'low'|'medium'|'high'
 * @returns {Object} Structured explanation
 */
function generateExplanation({ question, selectedAnswer, isCorrect, confidenceLevel }) {
  const correctIndex = question.correctAnswer;
  const correctOptionText = question.options[correctIndex];
  const selectedOptionText = question.options[selectedAnswer] || 'No option selected';

  // Core explanation from DB, or generated fallback
  const coreExplanation = question.explanation
    || `The correct answer is **${correctOptionText}**. Review the topic "${question.topic}" to understand why this is correct.`;

  // Why the selected answer was wrong (if incorrect)
  let whyWrong = null;
  if (!isCorrect) {
    whyWrong = `You selected **"${selectedOptionText}"** (Option ${String.fromCharCode(65 + selectedAnswer)}). `
      + `This is incorrect because it does not satisfy the conditions of the question. `
      + `The key distinction is that **"${correctOptionText}"** correctly addresses the problem.`;
  }

  // Related concepts suggestion
  const relatedConcepts = [
    question.topic,
    `${question.difficulty}-level ${question.topic} problems`,
  ];

  // Confidence feedback
  const confidenceKey = `${isCorrect ? 'correct' : 'wrong'}-${confidenceLevel || 'medium'}`;
  const confidenceFeedback = CONFIDENCE_FEEDBACK[confidenceKey] || '';

  // Difficulty-based study hint
  const studyHint = DIFFICULTY_HINTS[question.difficulty] || DIFFICULTY_HINTS.medium;

  return {
    questionText: question.questionText,
    selectedOption: selectedOptionText,
    correctOption: correctOptionText,
    isCorrect,
    explanation: coreExplanation,
    whyWrong,
    relatedConcepts,
    confidenceFeedback,
    studyHint,
    topic: question.topic,
    difficulty: question.difficulty,
  };
}

/**
 * Generate AI tutor chat response (rule-based).
 * @param {string} message - User's chat message
 * @param {Object} context - { topic, recentWrongTopics, learningLevel }
 * @returns {string} AI assistant response
 */
function generateChatResponse(message, context = {}) {
  const msg = message.toLowerCase().trim();
  const topic = context.topic || 'the current topic';
  const level = context.learningLevel || 'intermediate';
  const weakTopics = context.recentWrongTopics || [];

  // Dynamic helper to check if this exact text matches anything in chat history (memory system)
  const isDuplicateResponse = (text) => {
    if (!context.history || !Array.isArray(context.history)) return false;
    return context.history.some(h => h.role === 'assistant' && h.content === text);
  };

  const getVariantResponse = (baseResponse, alternativeResponse) => {
    return isDuplicateResponse(baseResponse) ? alternativeResponse : baseResponse;
  };

  // 1. Detect Intent
  let detectedIntent = 'explain';
  if (msg.includes('practice') || msg.includes('question') || msg.includes('quiz') || msg.includes('test me')) {
    detectedIntent = 'practice';
  } else if (msg.includes('example') || msg.includes('sample') || msg.includes('instance') || msg.includes('show me')) {
    detectedIntent = 'example';
  } else if (msg.includes('hint') || msg.includes('clue') || msg.includes('tip')) {
    detectedIntent = 'hint';
  } else if (msg.includes('step-by-step') || msg.includes('solution') || msg.includes('solve') || msg.includes('steps') || msg.includes('walkthrough')) {
    detectedIntent = 'solution';
  } else if (msg.includes('explain') || msg.includes('teach') || msg.includes('what is') || msg.includes('how do') || msg.includes('how does')) {
    detectedIntent = 'explain';
  }

  // 2. Handle general queries first
  if (msg.includes('what should i study') || msg.includes('next') || msg.includes('recommend')) {
    if (weakTopics.length > 0) {
      return `Based on your weak areas, I recommend focused study in:\n\n`
        + weakTopics.slice(0, 3).map((t, i) => `**${i + 1}. ${t}**`).join('\n')
        + `\n\nCheck your **Learning Path** for a complete personalized roadmap!`;
    }
    return `You are doing great! I recommend challenging yourself with expert-level questions on your top topics. See your **Learning Path** for more details!`;
  }

  if (msg.includes('score') || msg.includes('performance') || msg.includes('how am i doing')) {
    return `Have a look at your **Student Analytics** dashboard! It has complete details on accuracy by topic, confidence indices, and difficulty metrics.`;
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `Hello! 👋 I'm your AI Study Tutor. I can explain incorrect questions, recommend topics to study next, or help you practice. What's on your mind?`;
  }

  // 3. Route based on Intent and Learning Level
  if (detectedIntent === 'explain') {
    if (level === 'beginner') {
      const base = `[Beginner Level Guide] Let's explain **${topic}** simply. Think of it like a set of building blocks: you start with the foundation and build up. The core concept is all about understanding the fundamental elements. What part of **${topic}** should we look at first?`;
      const alt = `[Beginner Level Guide] Let's break down **${topic}** with a simple analogy. Imagine it as a roadmap where each turn is a basic concept. It's designed to be simple and easy to grasp. Shall we discuss the main rules?`;
      return getVariantResponse(base, alt);
    } else if (level === 'advanced') {
      const base = `[Advanced Level Analysis] Let's analyze **${topic}** technically. In advanced applications, we must evaluate the core constraints, mathematical derivations, and boundary parameters of this topic. What specific theorem or model are you working on?`;
      const alt = `[Advanced Level Analysis] Let's explore the complex structures of **${topic}**. This involves looking at the multi-factor relations, execution limits, and theoretical edge cases. Shall we review the formal proof?`;
      return getVariantResponse(base, alt);
    } else {
      const base = `Let's explain **${topic}**. This covers the core principles, standard methods of calculation, and key applications. What specific concept would you like to review?`;
      const alt = `Let's look at **${topic}**. Standard theory suggests focusing on definition and key relationships first. How can I help you clarify this topic?`;
      return getVariantResponse(base, alt);
    }
  }

  if (detectedIntent === 'example') {
    if (level === 'beginner') {
      const base = `[Beginner Level Guide] Here is a simple example of **${topic}**: Suppose you have 3 red apples and 2 green apples. If you pick one, the chance of picking red is 3 out of 5! Simple right?`;
      const alt = `[Beginner Level Guide] Let's look at a basic example of **${topic}**: If a task takes 5 minutes and another takes 10 minutes, the average time is 7.5 minutes. We keep it straightforward!`;
      return getVariantResponse(base, alt);
    } else if (level === 'advanced') {
      const base = `[Advanced Level Analysis] Here is an advanced example of **${topic}**: Let $X$ be a random variable distributed under constraints $C_1, C_2$. The probability density function is derived as $f(x) = \\lambda e^{-\\lambda x}$. Let's calculate the expectation.`;
      const alt = `[Advanced Level Analysis] Consider this advanced scenario in **${topic}**: An array of size $n$ is processed using a recursive divide-and-conquer algorithm. The recurrence relation is $T(n) = 2T(n/2) + O(n)$. Let's resolve the complexity bounds.`;
      return getVariantResponse(base, alt);
    } else {
      const base = `Here is a standard example of **${topic}**: Let's solve for a typical value where we apply the core formula. If $x = 5$ and we double it, we get $10$. What example would you like to build?`;
      const alt = `Let's run through a practical example of **${topic}**: We input standard parameters into the model and check the output step-by-step. Let me know if you want to try one!`;
      return getVariantResponse(base, alt);
    }
  }

  if (detectedIntent === 'practice') {
    if (level === 'beginner') {
      const base = `[Beginner Level Guide] Let's try a simple practice question on **${topic}**: If you flip a coin, what is the probability of getting Heads? Options: A) 1/2, B) 1/3, C) 1/4, D) 1. What is your choice?`;
      const alt = `[Beginner Level Guide] Let's try this simple question on **${topic}**: Which term represents the starting point? Options: A) Origin, B) Terminus, C) Peak, D) Slope. What is your pick?`;
      return getVariantResponse(base, alt);
    } else if (level === 'advanced') {
      const base = `[Advanced Level Analysis] Let's try a challenging practice question on **${topic}**: What is the limit of $(x^2 - 1)/(x - 1)$ as $x$ approaches $1$ under L'Hopital's rule? Options: A) 2, B) 0, C) 1, D) Undefined. What is your solution?`;
      const alt = `[Advanced Level Analysis] Here is a tough practice question on **${topic}**: Which complexity class represents problems solvable in polynomial time on a non-deterministic Turing machine? Options: A) NP, B) P, C) PSPACE, D) EXP. What is your choice?`;
      return getVariantResponse(base, alt);
    } else {
      const base = `Let's try a standard practice question on **${topic}**: Solve for $y$ in $y = 3x + 2$ when $x = 2$. Options: A) 8, B) 6, C) 5, D) 7. What is your answer?`;
      const alt = `Here is a practice question on **${topic}**: What is the sum of angles in a triangle? Options: A) 180 degrees, B) 90 degrees, C) 360 degrees, D) 270 degrees. Tell me your pick!`;
      return getVariantResponse(base, alt);
    }
  }

  if (detectedIntent === 'hint') {
    if (level === 'beginner') {
      const base = `[Beginner Level Guide] Here is a simple hint for **${topic}**: Try drawing a picture or counting the items one by one. It makes the problem much easier to see!`;
      const alt = `[Beginner Level Guide] A basic tip for **${topic}**: Look at the options and see if you can eliminate the ones that are obviously too large or too small.`;
      return getVariantResponse(base, alt);
    } else if (level === 'advanced') {
      const base = `[Advanced Level Analysis] Here is a conceptual hint for **${topic}**: Consider the asymptotic boundary conditions or verify if the derivative of the constraint function is positive in this interval.`;
      const alt = `[Advanced Level Analysis] An advanced hint for **${topic}**: Apply Bayes' theorem or check if the recurrence relation can be simplified using the Master Theorem.`;
      return getVariantResponse(base, alt);
    } else {
      const base = `Here is a hint for **${topic}**: Double check your arithmetic and ensure you are using the correct formula for this topic.`;
      const alt = `A quick hint for **${topic}**: Focus on the relationship between the key variables in the question before starting calculations.`;
      return getVariantResponse(base, alt);
    }
  }

  if (detectedIntent === 'solution') {
    if (level === 'beginner') {
      const base = `[Beginner Level Guide] Let's solve this step-by-step simply: 1) Read the problem, 2) Write down the numbers, 3) Add or subtract them, 4) Check your answer. It is that simple!`;
      const alt = `[Beginner Level Guide] Here is the simple step-by-step breakdown: first, identify what we have. Second, perform the operation. Finally, verify the result. You've got this!`;
      return getVariantResponse(base, alt);
    } else if (level === 'advanced') {
      const base = `[Advanced Level Analysis] Here is the step-by-step mathematical breakdown for **${topic}**: 1) Formulate the state equation, 2) Integrate over the specified limits, 3) Apply initial boundary conditions to solve for $C$, 4) Substitute values.`;
      const alt = `[Advanced Level Analysis] Let's analyze the technical solution: 1) Identify the recurrence relationship, 2) Draw the recursion tree, 3) Sum the cost at each level, 4) Derive the final asymptotic complexity bounds.`;
      return getVariantResponse(base, alt);
    } else {
      const base = `Let's break down the step-by-step solution for **${topic}**: 1) Identify the given variables, 2) Apply the standard formula, 3) Solve for the unknown variable, 4) Verify against the choices.`;
      const alt = `Here is the step-by-step solution: first state the theorem. Next, plug in the values. Finally, calculate the final number. Let me know if you need more details!`;
      return getVariantResponse(base, alt);
    }
  }

  // General fallback
  const base = `That is a great query about **${topic}**. Let's review definitions, try practice questions, and check your Learning Path roadmap. What specific area can we detail?`;
  const alt = `For **${topic}**, I suggest starting with simple examples and verifying each step. What particular question can we walk through?`;
  return getVariantResponse(base, alt);
}

module.exports = { generateExplanation, generateChatResponse };
