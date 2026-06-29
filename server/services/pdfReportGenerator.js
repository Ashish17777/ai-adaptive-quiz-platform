const PDFDocument = require('pdfkit');

/**
 * Modern premium table drawing utility for PDFKit
 */
function drawTable(doc, startX, startY, headers, rows, columnWidths, headerColor = [99, 102, 241]) {
  let currentY = startY;
  const rowHeight = 22;
  const padding = 6;
  
  // Draw header background
  doc.fillColor(headerColor).rect(startX, currentY, columnWidths.reduce((a, b) => a + b, 0), rowHeight).fill();
  
  // Draw header text
  let currentX = startX;
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
  headers.forEach((header, index) => {
    doc.text(header, currentX + padding, currentY + padding, {
      width: columnWidths[index] - (padding * 2),
      align: 'left'
    });
    currentX += columnWidths[index];
  });
  
  currentY += rowHeight;
  
  // Draw rows
  rows.forEach((row, rowIndex) => {
    // Page check: add a page if the row runs over margins
    if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      currentY = doc.page.margins.top;
      
      // Re-draw header row on new page
      doc.fillColor(headerColor).rect(startX, currentY, columnWidths.reduce((a, b) => a + b, 0), rowHeight).fill();
      let headerX = startX;
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      headers.forEach((header, index) => {
        doc.text(header, headerX + padding, currentY + padding, {
          width: columnWidths[index] - (padding * 2),
          align: 'left'
        });
        headerX += columnWidths[index];
      });
      currentY += rowHeight;
    }
    
    // Alternating rows shading
    const bgColor = rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
    doc.fillColor(bgColor).rect(startX, currentY, columnWidths.reduce((a, b) => a + b, 0), rowHeight).fill();
    
    // Draw cells
    let cellX = startX;
    row.forEach((cell, cellIndex) => {
      const cellText = String(cell);
      
      // Status highlighting
      if (cellText === 'YES' || cellText === 'Mastered') {
        doc.fillColor('#10B981').font('Helvetica-Bold');
      } else if (cellText === 'NO' || cellText === 'Needs Work' || cellText === 'Weak Area') {
        doc.fillColor('#EF4444').font('Helvetica-Bold');
      } else if (cellText === 'Developing' || cellText === 'Needs Improvement') {
        doc.fillColor('#F59E0B').font('Helvetica-Bold');
      } else {
        doc.fillColor('#334155').font('Helvetica');
      }
      
      doc.fontSize(8.5).text(cellText, cellX + padding, currentY + padding, {
        width: columnWidths[cellIndex] - (padding * 2),
        align: 'left',
        lineBreak: false
      });
      cellX += columnWidths[cellIndex];
    });
    
    // Row separator line
    doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(startX, currentY + rowHeight).lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), currentY + rowHeight).stroke();
    
    currentY += rowHeight;
  });
  
  return currentY;
}

/**
 * Draw KPI Cards in Grid layout
 */
function drawCard(doc, x, y, width, height, title, value, unit = '', color = '#6366F1') {
  // Draw card container
  doc.roundedRect(x, y, width, height, 8)
     .fillAndStroke('#F8FAFC', '#E2E8F0');
     
  // Draw card label
  doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text(title.toUpperCase(), x + 12, y + 12);
  
  // Draw value
  doc.fillColor(color).fontSize(20).font('Helvetica-Bold').text(value, x + 12, y + 24);
  
  // Draw unit if any
  if (unit) {
    const valWidth = doc.widthOfString(value, { size: 20 });
    doc.fillColor('#64748B').fontSize(10).font('Helvetica').text(unit, x + 12 + valWidth + 4, y + 32);
  }
}

/**
 * Standard professional header
 */
function drawHeader(doc, title, subtitle) {
  // Header accent bar
  doc.fillColor('#6366F1').rect(0, 0, doc.page.width, 12).fill();
  
  // App brand text
  doc.fillColor('#6366F1').fontSize(8).font('Helvetica-Bold').text('ANTIGRAVITY | ADAPTIVE COGNITION PLATFORM', 50, 32);
  
  // Title
  doc.fillColor('#0F172A').fontSize(22).font('Helvetica-Bold').text(title, 50, 45);
  
  // Subtitle / generation date
  const dateStr = `Generated: ${new Date().toLocaleString()}`;
  doc.fillColor('#64748B').fontSize(9).font('Helvetica').text(subtitle || dateStr, 50, 72);
  
  // Separator
  doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, 88).lineTo(doc.page.width - 50, 88).stroke();
}

/**
 * Generates the Student Report PDF
 */
function generateStudentPDF(student, analytics, recommendations, stream) {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  doc.pipe(stream);
  
  // 1. Header
  drawHeader(doc, 'Student Performance Report', `Student: ${student.name} (${student.email}) | Date: ${new Date().toLocaleDateString()}`);
  
  // 2. Metrics Grid
  let y = 105;
  doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Performance Overview', 50, y);
  y += 18;
  
  // First row of cards (Overall Accuracy, Avg Confidence, Confidence Accuracy Index)
  drawCard(doc, 50, y, 160, 60, 'Overall Accuracy', `${analytics.overallAccuracy}%`, '', '#6366F1');
  drawCard(doc, 226, y, 160, 60, 'Avg Confidence', `${analytics.averageConfidence}%`, '', '#10B981');
  drawCard(doc, 402, y, 160, 60, 'Confidence Accuracy Index', `${analytics.confidenceAccuracyIndex}%`, '', '#A855F7');
  
  y += 75;
  // Second row (Adaptive Score, Current Difficulty)
  drawCard(doc, 50, y, 248, 60, 'Total Cumulative Score', `${analytics.adaptiveScore}`, 'pts', '#EC4899');
  drawCard(doc, 314, y, 248, 60, 'Adaptive Tier Reached', `${(analytics.currentDifficulty || 'Medium').toUpperCase()}`, '', '#F59E0B');
  
  // 3. Topic Mastery Table
  y += 85;
  doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Topic Mastery Analysis', 50, y);
  y += 18;
  
  const headers = ['Topic', 'Accuracy', 'Avg Confidence', 'Questions Attempted', 'Mastery Status'];
  const columnWidths = [170, 80, 100, 80, 82];
  
  const rows = (analytics.topicMastery || []).map(topic => [
    topic.topic,
    `${topic.accuracy}%`,
    `${topic.averageConfidence}%`,
    topic.totalQuestions.toString(),
    topic.status
  ]);
  
  y = drawTable(doc, 50, y, headers, rows, columnWidths, [99, 102, 241]);
  
  // 4. AI recommendations (new page if needed)
  if (y + 120 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = 50;
  } else {
    y += 20;
  }
  
  doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Personalized Learning Recommendations', 50, y);
  y += 18;
  
  let recsCount = 0;
  
  // Topic recommendations
  if (recommendations && recommendations.recommendedTopics && recommendations.recommendedTopics.length > 0) {
    doc.fillColor('#475569').fontSize(9.5).font('Helvetica-Bold').text('SUGGESTED STUDY TOPICS:', 50, y);
    y += 14;
    
    recommendations.recommendedTopics.slice(0, 3).forEach(rec => {
      doc.fillColor('#10B981').font('Helvetica-Bold').fontSize(8.5).text('•  ' + rec.topic + ': ', 60, y, { continued: true });
      doc.fillColor('#334155').font('Helvetica').text(rec.reason, { width: doc.page.width - 120 });
      y += doc.heightOfString(rec.reason, { width: doc.page.width - 120 }) + 6;
    });
    recsCount++;
  }
  
  // Practice Set recommendations
  if (recommendations && recommendations.recommendedPracticeSets && recommendations.recommendedPracticeSets.length > 0) {
    y += 8;
    doc.fillColor('#475569').fontSize(9.5).font('Helvetica-Bold').text('PRACTICE REGIMEN:', 50, y);
    y += 14;
    
    recommendations.recommendedPracticeSets.slice(0, 3).forEach(rec => {
      doc.fillColor('#F59E0B').font('Helvetica-Bold').fontSize(8.5).text('•  ' + rec.topic + ': ', 60, y, { continued: true });
      doc.fillColor('#334155').font('Helvetica').text(rec.reason, { width: doc.page.width - 120 });
      y += doc.heightOfString(rec.reason, { width: doc.page.width - 120 }) + 6;
    });
    recsCount++;
  }
  
  // Quiz recommendations
  if (recommendations && recommendations.recommendedQuizzes && recommendations.recommendedQuizzes.length > 0) {
    y += 8;
    doc.fillColor('#475569').fontSize(9.5).font('Helvetica-Bold').text('SUGGESTED ASSESSMENTS:', 50, y);
    y += 14;
    
    recommendations.recommendedQuizzes.slice(0, 3).forEach(rec => {
      const probPercent = Math.round(rec.estimatedSuccessProbability * 100);
      const quizText = `${rec.title} (${rec.topic} - ${rec.difficulty}) — Estimated Success Probability: ${probPercent}%`;
      doc.fillColor('#6366F1').font('Helvetica-Bold').fontSize(8.5).text('•  ', 60, y, { continued: true });
      doc.fillColor('#334155').font('Helvetica').text(quizText, { width: doc.page.width - 120 });
      y += doc.heightOfString(quizText, { width: doc.page.width - 120 }) + 6;
    });
    recsCount++;
  }
  
  if (recsCount === 0) {
    doc.fillColor('#64748B').fontSize(9).font('Helvetica-Oblique').text('Take more quizzes to unlock full AI learning path diagnostics.', 60, y);
  }
  
  doc.end();
}

/**
 * Generates the Quiz Attempt Report PDF
 */
function generateQuizPDF(attempt, quizStats, stream) {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  doc.pipe(stream);
  
  const quizTitle = attempt.quiz ? attempt.quiz.title : 'Standard Evaluation';
  const quizTopic = attempt.quiz ? (attempt.quiz.topic || 'General') : 'General';
  const quizType = attempt.quiz && attempt.quiz.isAdaptive ? 'Adaptive Quiz' : 'Standard Quiz';
  
  // 1. Header
  drawHeader(
    doc,
    'Quiz Evaluation Report',
    `Student: ${attempt.user ? attempt.user.name : 'Student Profile'} | Quiz: ${quizTitle} (${quizType})`
  );
  
  // 2. Overview Stats (Grid)
  let y = 105;
  doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('Individual Performance Overview', 50, y);
  
  // Draw Class Aggregates right aligned
  doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold').text('CLASS STATS SUMMARY:', 350, y);
  doc.font('Helvetica').fontSize(8).text(`Unique Participants: ${quizStats.participantCount}`, 350, y + 12);
  doc.text(`Class Avg Score: ${quizStats.averageScore}%`, 350, y + 22);
  doc.text(`Completion Rate: ${quizStats.completionRate}%`, 350, y + 32);
  
  y += 45;
  
  // KPI grid
  drawCard(doc, 50, y, 110, 52, 'Final Score', `${attempt.score} / ${attempt.totalQuestions}`, '', '#6366F1');
  drawCard(doc, 170, y, 110, 52, 'Accuracy', `${attempt.percentage}%`, '', '#10B981');
  drawCard(doc, 290, y, 110, 52, 'Confidence Score', `${attempt.confidenceScore}`, 'pts', '#A855F7');
  drawCard(doc, 410, y, 152, 52, 'Max Tier Reached', `${(attempt.currentDifficulty || 'Medium').toUpperCase()}`, '', '#F59E0B');
  
  y += 65;
  
  // Cognitive Calibration Info
  doc.roundedRect(50, y, 512, 38, 6).fillAndStroke('#F8FAFC', '#E2E8F0');
  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5).text('Cognitive Calibration Diagnostics:', 62, y + 8);
  
  const calibText = `Average Confidence: ${attempt.averageConfidence}%  |  Confidence-Accuracy Alignment: ${attempt.confidenceAccuracyIndex}%  |  Overconfidence Count: ${attempt.overconfidenceCount || 0}  |  Underconfidence Count: ${attempt.underconfidenceCount || 0}`;
  doc.font('Helvetica').fillColor('#475569').text(calibText, 62, y + 20);
  
  // 3. Question-by-Question breakdown table
  y += 55;
  doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold').text('Question-by-Question Evaluation Details', 50, y);
  y += 16;
  
  const headers = ['#', 'Question Text', 'Topic', 'Difficulty', 'Correct', 'Confidence', 'Duration'];
  const columnWidths = [20, 202, 80, 60, 50, 55, 45];
  
  // Map responses
  const rows = (attempt.responses || []).map((resp, idx) => {
    const qObject = resp.questionId;
    let questionText = 'Question';
    if (qObject && qObject.questionText) {
      questionText = qObject.questionText;
    } else if (attempt.questionsOrder && attempt.questionsOrder[idx]) {
      questionText = attempt.questionsOrder[idx].questionText;
    }
    
    // Truncate questionText if it is too long to prevent row wrapping bugs
    if (questionText.length > 55) {
      questionText = questionText.substring(0, 52) + '...';
    }
    
    return [
      (idx + 1).toString(),
      questionText,
      resp.topic || quizTopic,
      (resp.difficulty || 'medium').toUpperCase(),
      resp.isCorrect ? 'YES' : 'NO',
      (resp.confidenceLevel || 'medium').toUpperCase(),
      `${resp.timeTaken}s`
    ];
  });
  
  y = drawTable(doc, 50, y, headers, rows, columnWidths, [99, 102, 241]);
  
  doc.end();
}

/**
 * Generates the Class Analytics PDF
 */
function generateClassPDF(classStats, stream) {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  doc.pipe(stream);
  
  // 1. Header
  drawHeader(doc, 'Class Performance & Analytics Report', `Total Managed Profiles: ${classStats.totalStudents} | Date: ${new Date().toLocaleDateString()}`);
  
  // 2. Summary stats grid
  let y = 105;
  doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Class Cohort Overview', 50, y);
  y += 18;
  
  const hardestTopicName = classStats.mostDifficultTopics && classStats.mostDifficultTopics[0]
    ? `${classStats.mostDifficultTopics[0].topic} (${classStats.mostDifficultTopics[0].accuracy}%)`
    : 'N/A';
    
  drawCard(doc, 50, y, 160, 60, 'Total Students Registered', `${classStats.totalStudents}`, '', '#6366F1');
  drawCard(doc, 226, y, 160, 60, 'Average Class Confidence', `${classStats.averageConfidence}%`, '', '#10B981');
  drawCard(doc, 402, y, 160, 60, 'Hardest Cohort Topic', hardestTopicName, '', '#EF4444');
  
  // 3. Topic Analysis Table
  y += 85;
  doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Aggregated Topic Performance Analysis', 50, y);
  y += 18;
  
  const topicHeaders = ['Topic Name', 'Average Accuracy', 'Average Confidence', 'Total Submissions'];
  const topicWidths = [200, 100, 110, 102];
  
  const topicRows = (classStats.topicPerformance || []).map(topic => [
    topic.topic,
    `${topic.accuracy}%`,
    `${topic.confidence}%`,
    topic.totalAnswers.toString()
  ]);
  
  y = drawTable(doc, 50, y, topicHeaders, topicRows, topicWidths, [79, 70, 229]);
  
  // 4. Leaderboard rankings (new page if needed)
  if (y + 140 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = 50;
  } else {
    y += 20;
  }
  
  doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Student Standings Leaderboard', 50, y);
  y += 18;
  
  const rankHeaders = ['Rank', 'Player Name', 'Cumulative Score', 'Average Accuracy', 'Quizzes Taken'];
  const rankWidths = [50, 170, 100, 100, 92];
  
  const rankRows = (classStats.playerRankings || []).map((player, index) => [
    (index + 1).toString(),
    player.name,
    `${player.score} pts`,
    `${player.accuracy}%`,
    player.quizzesPlayed.toString()
  ]);
  
  drawTable(doc, 50, y, rankHeaders, rankRows, rankWidths, [124, 58, 237]);
  
  doc.end();
}

module.exports = {
  generateStudentPDF,
  generateQuizPDF,
  generateClassPDF
};
