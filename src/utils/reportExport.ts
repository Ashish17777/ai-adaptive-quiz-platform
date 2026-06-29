import API from '../services/api';

// Generic helper to download CSV string
const downloadCSV = (filename: string, csvContent: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ==========================================
// 1. STUDENT REPORT EXPORTS
// ==========================================
export interface StudentReportData {
  studentName: string;
  studentEmail: string;
  overallAccuracy: number;
  averageConfidence: number;
  confidenceAccuracyIndex: number;
  adaptiveScore: number;
  currentDifficulty: string;
  topicMastery: Array<{
    topic: string;
    accuracy: number;
    averageConfidence: number;
    status: string;
    totalQuestions: number;
  }>;
}

export const exportStudentReportCSV = (data: StudentReportData) => {
  let csv = 'Student Performance Report\n';
  csv += `Name,${data.studentName}\n`;
  csv += `Email,${data.studentEmail}\n`;
  csv += `Overall Accuracy,${data.overallAccuracy}%\n`;
  csv += `Average Confidence,${data.averageConfidence}%\n`;
  csv += `Confidence Accuracy Index,${data.confidenceAccuracyIndex}%\n`;
  csv += `Adaptive Score,${data.adaptiveScore}\n`;
  csv += `Current Difficulty,${data.currentDifficulty}\n\n`;

  csv += 'Topic Mastery Analysis\n';
  csv += 'Topic,Accuracy (%),Average Confidence (%),Total Questions,Status\n';
  data.topicMastery.forEach(t => {
    csv += `"${t.topic}",${t.accuracy},${t.averageConfidence},${t.totalQuestions},"${t.status}"\n`;
  });

  downloadCSV(`${data.studentName.replace(/\s+/g, '_')}_student_report.csv`, csv);
};

export const exportStudentReportPDF = async (
  studentId: string,
  onStatusChange?: (status: string | null) => void
) => {
  if (onStatusChange) onStatusChange('Generating PDF...');
  try {
    const response = await API.get(`/reports/student/pdf/${studentId}`, {
      responseType: 'blob',
    });

    if (onStatusChange) onStatusChange('Download Started');

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // We can try to extract a clean filename from content-disposition header if present
    const filename = `student_report_${studentId}.pdf`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    setTimeout(() => {
      if (onStatusChange) onStatusChange(null);
    }, 2000);
  } catch (error) {
    console.error('PDF Generation Failed:', error);
    if (onStatusChange) onStatusChange('PDF Generation Failed');
    setTimeout(() => {
      if (onStatusChange) onStatusChange(null);
    }, 4000);
  }
};


// ==========================================
// 2. SINGLE QUIZ ATTEMPT REPORT EXPORTS
// ==========================================
export interface QuizReportData {
  quizTitle: string;
  studentName: string;
  score: number;
  confidenceScore: number;
  totalQuestions: number;
  accuracy: number;
  averageConfidence: number;
  confidenceAccuracy: number;
  overconfidenceCount: number;
  underconfidenceCount: number;
  difficultyReached: string;
  responses: Array<{
    questionText: string;
    topic: string;
    difficulty: string;
    selectedOption: string;
    correctOption: string;
    isCorrect: boolean;
    confidenceLevel: string;
    timeTaken: number;
  }>;
}

export const exportQuizReportCSV = (data: QuizReportData) => {
  let csv = `Quiz Performance Report: ${data.quizTitle}\n`;
  csv += `Student Name,${data.studentName}\n`;
  csv += `Correct Answers,${data.score}/${data.totalQuestions}\n`;
  csv += `Confidence Score,${data.confidenceScore}\n`;
  csv += `Accuracy,${data.accuracy}%\n`;
  csv += `Average Confidence,${data.averageConfidence}%\n`;
  csv += `Confidence Accuracy Index,${data.confidenceAccuracy}%\n`;
  csv += `Overconfidence Count,${data.overconfidenceCount}\n`;
  csv += `Underconfidence Count,${data.underconfidenceCount}\n`;
  csv += `Adaptive Difficulty Reached,${data.difficultyReached}\n\n`;

  csv += 'Question Breakdown\n';
  csv += 'Question,Topic,Difficulty,Selected Option,Correct Option,Is Correct,Confidence,Time Taken (s)\n';
  data.responses.forEach((r) => {
    csv += `"${r.questionText.replace(/"/g, '""')}","${r.topic}",${r.difficulty},"${r.selectedOption.replace(/"/g, '""')}","${r.correctOption.replace(/"/g, '""')}",${r.isCorrect},${r.confidenceLevel},${r.timeTaken}\n`;
  });

  downloadCSV(`${data.studentName.replace(/\s+/g, '_')}_quiz_report.csv`, csv);
};

export const exportQuizReportPDF = async (
  attemptId: string,
  onStatusChange?: (status: string | null) => void
) => {
  if (onStatusChange) onStatusChange('Generating PDF...');
  try {
    const response = await API.get(`/reports/quiz/pdf/${attemptId}`, {
      responseType: 'blob',
    });

    if (onStatusChange) onStatusChange('Download Started');

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `quiz_report_${attemptId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    setTimeout(() => {
      if (onStatusChange) onStatusChange(null);
    }, 2000);
  } catch (error) {
    console.error('PDF Generation Failed:', error);
    if (onStatusChange) onStatusChange('PDF Generation Failed');
    setTimeout(() => {
      if (onStatusChange) onStatusChange(null);
    }, 4000);
  }
};


// ==========================================
// 3. CLASS REPORT EXPORTS (FOR ADMINS/TEACHERS)
// ==========================================
export interface ClassReportData {
  totalStudents: number;
  averageConfidenceClass: number;
  mostDifficultTopics: Array<{ topic: string; accuracy: number }>;
  difficultyDistribution: Array<{ name: string; value: number }>;
  playerRankings: Array<{
    name: string;
    score: number;
    accuracy: number;
    quizzesPlayed: number;
  }>;
  totalRankingsCount?: number;
}

export const exportClassReportCSV = (data: ClassReportData) => {
  let csv = 'Class Performance & Analytics Report\n';
  csv += `Total Students,${data.totalRankingsCount || data.playerRankings.length}\n`;
  csv += `Average Class Confidence,${data.averageConfidenceClass}%\n\n`;

  csv += 'Difficult Topics (Lowest Accuracy)\n';
  csv += 'Topic,Accuracy (%)\n';
  data.mostDifficultTopics.forEach(t => {
    csv += `"${t.topic}",${t.accuracy}%\n`;
  });
  csv += '\n';

  csv += 'Student Leaderboard Rankings\n';
  csv += 'Rank,Player Name,Confidence Score,Accuracy (%),Quizzes Played\n';
  data.playerRankings.forEach((p, idx) => {
    csv += `${idx + 1},"${p.name}",${p.score},${p.accuracy},${p.quizzesPlayed}\n`;
  });

  downloadCSV(`Class_Analytics_Report_${new Date().toISOString().slice(0, 10)}.csv`, csv);
};

export const exportClassReportPDF = async (
  classId: string,
  onStatusChange?: (status: string | null) => void
) => {
  if (onStatusChange) onStatusChange('Generating PDF...');
  try {
    const response = await API.get(`/reports/class/pdf/${classId}`, {
      responseType: 'blob',
    });

    if (onStatusChange) onStatusChange('Download Started');

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `class_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    setTimeout(() => {
      if (onStatusChange) onStatusChange(null);
    }, 2000);
  } catch (error) {
    console.error('PDF Generation Failed:', error);
    if (onStatusChange) onStatusChange('PDF Generation Failed');
    setTimeout(() => {
      if (onStatusChange) onStatusChange(null);
    }, 4000);
  }
};
