import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { exportQuizReportCSV, exportQuizReportPDF } from '../utils/reportExport';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Award,
  Compass,
  FileSpreadsheet,
  FileDown,
  Zap,
  Activity,
  BrainCircuit
} from 'lucide-react';

interface Question {
  _id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  topic: string;
  explanation?: string;
}

interface Attempt {
  _id: string;
  quiz: {
    title: string;
    isAdaptive: boolean;
    topic?: string;
  };
  questionsOrder: Question[];
  answers: number[];
  responses: Array<{
    questionId: Question | string;
    selectedAnswer: number;
    correctAnswer: number;
    isCorrect: boolean;
    confidenceLevel: string;
    timeTaken: number;
    difficulty: string;
    topic: string;
  }>;
  score: number;
  confidenceScore: number;
  overconfidenceCount: number;
  underconfidenceCount: number;
  confidenceAccuracyIndex: number;
  averageConfidence: number;
  totalQuestions: number;
  percentage: number;
  isCompleted: boolean;
  currentDifficulty: string;
  createdAt: string;
}

const ResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttemptResults = async () => {
      try {
        const response = await API.get(`/attempts/${attemptId}`);
        setAttempt(response.data.attempt);

        if (response.data.attempt && user) {
          try {
            const reportResp = await API.get(`/ai/report/${user._id}?attemptId=${attemptId}`);
            if (reportResp.data?.success && reportResp.data?.hasReport) {
              setAiReport(reportResp.data.report);
            }
          } catch (e) {
            console.error('Error fetching AI report summary', e);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading attempt details');
      } finally {
        setLoading(false);
      }
    };
    fetchAttemptResults();
  }, [attemptId, user]);

  const handleExportCSV = () => {
    if (!attempt) return;
    const reportData = {
      quizTitle: attempt.quiz.title,
      studentName: user?.name || 'Student Profile',
      score: attempt.score,
      confidenceScore: attempt.confidenceScore,
      totalQuestions: attempt.totalQuestions,
      accuracy: attempt.percentage,
      averageConfidence: attempt.averageConfidence,
      confidenceAccuracy: attempt.confidenceAccuracyIndex,
      overconfidenceCount: attempt.overconfidenceCount,
      underconfidenceCount: attempt.underconfidenceCount,
      difficultyReached: attempt.currentDifficulty,
      responses: attempt.responses.map((r, idx) => {
        const qText = (r.questionId as any)?.questionText || attempt.questionsOrder[idx]?.questionText || 'Question Text';
        const opts = (r.questionId as any)?.options || attempt.questionsOrder[idx]?.options || [];
        const selectedText = opts[r.selectedAnswer] || `Option ${r.selectedAnswer}`;
        const correctText = opts[r.correctAnswer] || `Option ${r.correctAnswer}`;
        return {
          questionText: qText,
          topic: r.topic || attempt.quiz.topic || 'General',
          difficulty: r.difficulty || 'medium',
          selectedOption: selectedText,
          correctOption: correctText,
          isCorrect: r.isCorrect,
          confidenceLevel: r.confidenceLevel,
          timeTaken: r.timeTaken,
        };
      }),
    };
    exportQuizReportCSV(reportData);
  };

  const handleExportPDF = () => {
    if (!attemptId) return;
    exportQuizReportPDF(attemptId, setPdfStatus);
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error || !attempt) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <GlassCard className="border border-red-500/20">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">Results Error</h3>
          <p className="text-sm text-gray-400 mt-2">{error || 'Attempt results not found'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 px-4 py-2 bg-indigo-600 rounded-lg text-white font-semibold text-xs"
          >
            Go to Dashboard
          </button>
        </GlassCard>
      </div>
    );
  }

  const wrongAnswersCount = attempt.totalQuestions - attempt.score;

  // Percentage gauge calculations
  const radius = 50;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (attempt.percentage / 100) * circumference;

  // Visual text feedbacks
  const getFeedbackMessage = (pct: number) => {
    if (pct >= 90) return { title: 'Outstanding Performance!', subtitle: 'You have mastered this concept.', color: 'text-indigo-400' };
    if (pct >= 75) return { title: 'Excellent Work!', subtitle: 'Great understanding of the topic.', color: 'text-emerald-400' };
    if (pct >= 50) return { title: 'Good Attempt!', subtitle: 'Passed, but room for refinement.', color: 'text-amber-400' };
    return { title: 'Keep Practicing!', subtitle: 'Focus on reviewed items below and try again.', color: 'text-red-400' };
  };

  const feedback = getFeedbackMessage(attempt.percentage);

  // Strong and Weak topics extraction
  const topicAccuracyMap: Record<string, { correct: number; total: number }> = {};
  attempt.responses.forEach((resp) => {
    const topic = resp.topic || 'General';
    if (!topicAccuracyMap[topic]) {
      topicAccuracyMap[topic] = { correct: 0, total: 0 };
    }
    topicAccuracyMap[topic].total++;
    if (resp.isCorrect) {
      topicAccuracyMap[topic].correct++;
    }
  });

  const strongTopics: string[] = [];
  const weakTopics: string[] = [];
  Object.entries(topicAccuracyMap).forEach(([topic, data]) => {
    const acc = Math.round((data.correct / data.total) * 100);
    if (acc >= 85) {
      strongTopics.push(topic);
    } else if (acc < 50) {
      weakTopics.push(topic);
    }
  });

  const difficultyColors = {
    easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    hard: 'bg-red-500/10 text-red-400 border-red-500/20',
    expert: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-300">
      {/* Header Back Button & Export options */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Student Dashboard</span>
        </button>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white rounded-xl transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV Report</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/10 transition-all"
          >
            <FileDown className="w-4 h-4" />
            <span>PDF Report</span>
          </button>
        </div>
      </div>

      {/* Hero Score Gauge Panel */}
      <GlassCard className="border border-white/5 p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 justify-around">
        {/* SVG Ring Gauge */}
        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth={strokeWidth}
            />
            {/* Value ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke={
                attempt.percentage >= 80
                  ? '#6366f1' // indigo
                  : attempt.percentage >= 50
                  ? '#f59e0b' // amber
                  : '#ef4444' // red
              }
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-4xl font-extrabold text-white leading-none">
              {attempt.percentage}%
            </span>
            <span className="text-[10px] text-gray-500 block uppercase font-bold mt-1 tracking-wider">
              Final Accuracy
            </span>
          </div>
        </div>

        {/* Written Score Feedback */}
        <div className="text-center md:text-left space-y-4 max-w-sm">
          <div>
            <h2 className={`text-2xl font-extrabold tracking-tight ${feedback.color}`}>
              {feedback.title}
            </h2>
            <p className="text-gray-400 text-sm mt-1.5 font-medium leading-relaxed">
              {feedback.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-white/2 border border-white/5 rounded-xl text-center">
              <span className="block text-lg font-bold text-white leading-none">
                {attempt.totalQuestions}
              </span>
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-1 block">
                Total
              </span>
            </div>
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-center">
              <span className="block text-lg font-bold text-emerald-400 leading-none">
                {attempt.score}
              </span>
              <span className="text-[9px] text-emerald-500/70 font-bold uppercase tracking-wider mt-1 block">
                Correct
              </span>
            </div>
            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-center">
              <span className="block text-lg font-bold text-red-400 leading-none">
                {wrongAnswersCount}
              </span>
              <span className="text-[9px] text-red-500/70 font-bold uppercase tracking-wider mt-1 block">
                Wrong
              </span>
            </div>
          </div>

          {user?.role !== 'admin' && (
            <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2 mt-4">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-400">
                <BrainCircuit className="w-4 h-4 animate-pulse" />
                <span>AI Cognitive Insights</span>
              </div>
              {aiReport ? (
                <p className="text-[11px] text-gray-300 italic line-clamp-2">
                  "{aiReport.summary}"
                </p>
              ) : (
                <p className="text-[11px] text-gray-400">
                  Analyze accuracy patterns, difficulty levels, and confidence calibration.
                </p>
              )}
              <button
                onClick={() => navigate(`/dashboard/report/${attemptId}`)}
                className="w-full text-center block text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg transition-all"
              >
                View Full AI Report Card
              </button>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Metacognitive Performance Report Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard className="border border-white/5 p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
            <Activity className="w-4.5 h-4.5 text-indigo-400" />
            <span>Confidence &amp; Metacognitive Analysis</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/2 p-3.5 rounded-xl border border-white/5">
              <span className="block text-xl font-black text-indigo-400 font-mono">
                {attempt.confidenceScore || 0} pts
              </span>
              <span className="text-[10px] text-gray-500 font-bold uppercase block mt-1">
                Confidence Score
              </span>
            </div>

            <div className="bg-white/2 p-3.5 rounded-xl border border-white/5">
              <span className="block text-xl font-black text-emerald-400 font-mono">
                {attempt.averageConfidence || 0}%
              </span>
              <span className="text-[10px] text-gray-500 font-bold uppercase block mt-1">
                Avg Confidence
              </span>
            </div>

            <div className="bg-white/2 p-3.5 rounded-xl border border-white/5">
              <span className="block text-xl font-black text-purple-400 font-mono">
                {attempt.confidenceAccuracyIndex || 0}%
              </span>
              <span className="text-[10px] text-gray-500 font-bold uppercase block mt-1">
                Confidence Accuracy
              </span>
            </div>

            <div className="bg-white/2 p-3.5 rounded-xl border border-white/5">
              <span className="block text-xl font-black text-pink-400 font-mono uppercase">
                {attempt.currentDifficulty}
              </span>
              <span className="text-[10px] text-gray-500 font-bold uppercase block mt-1">
                Max Tier Reached
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-semibold pt-2 border-t border-white/5">
            <div className="text-gray-400">
              Overconfidence count: <span className="text-red-400 font-bold font-mono">{attempt.overconfidenceCount || 0}</span>
            </div>
            <div className="text-gray-400">
              Underconfidence count: <span className="text-amber-400 font-bold font-mono">{attempt.underconfidenceCount || 0}</span>
            </div>
          </div>
        </GlassCard>

        {/* Strengths & Weaknesses Panel */}
        <GlassCard className="border border-white/5 p-6 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>Topic Challenge Assessment</span>
            </h3>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider block mb-1">
                  Strong Topics (&ge;85% Acc)
                </span>
                {strongTopics.length === 0 ? (
                  <span className="text-xs text-gray-500 italic block pl-1">No strong areas identified yet</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {strongTopics.map((t) => (
                      <span key={t} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] text-red-400 font-extrabold uppercase tracking-wider block mb-1">
                  Weak Topics (&lt;50% Acc)
                </span>
                {weakTopics.length === 0 ? (
                  <span className="text-xs text-gray-500 italic block pl-1">No weak areas identified yet</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {weakTopics.map((t) => (
                      <span key={t} className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-gray-500 font-bold border-t border-white/5 pt-3 leading-snug">
            Adaptive quizzes adjust question streams to challenge your knowledge limits and reveal learning trends.
          </div>
        </GlassCard>
      </div>

      {/* Questions Review list */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
          <Award className="w-5 h-5 text-indigo-400" />
          <span>Evaluation Review</span>
        </h3>

        <div className="space-y-5">
          {attempt.questionsOrder.map((q, idx) => {
            const studentAnswerIdx = attempt.answers[idx];
            const isStudentCorrect = q.correctAnswer === studentAnswerIdx;

            return (
              <GlassCard
                key={q._id}
                className={`border ${
                  isStudentCorrect
                    ? 'border-emerald-500/20 shadow-emerald-500/2'
                    : 'border-red-500/20 shadow-red-500/2'
                }`}
              >
                {/* Header indicators */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-4 border-b border-white/5 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center font-bold text-indigo-400">
                      {idx + 1}
                    </span>
                    <span className="text-gray-400 font-semibold uppercase tracking-wider">
                      Topic: {q.topic}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 self-start sm:self-auto">
                    {attempt.quiz.isAdaptive && (
                      <span className="text-[10px] font-semibold text-indigo-400/80 flex items-center space-x-1">
                        <Compass className="w-3 h-3" />
                        <span>Adaptive Scale</span>
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-extrabold uppercase border px-2.5 py-0.5 rounded-md ${
                        difficultyColors[q.difficulty]
                      }`}
                    >
                      {q.difficulty}
                    </span>
                  </div>
                </div>

                {/* Prompt */}
                <h4 className="text-base font-semibold text-white mt-4 leading-relaxed">
                  {q.questionText}
                </h4>

                {/* Options Review Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {q.options.map((opt, oIdx) => {
                    const isCorrectAnswer = q.correctAnswer === oIdx;
                    const isSelectedAnswer = studentAnswerIdx === oIdx;

                    let bgStyle = 'bg-transparent border-white/5 text-gray-400';
                    let leadingIcon = null;

                    if (isCorrectAnswer) {
                      bgStyle = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
                      leadingIcon = <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
                    } else if (isSelectedAnswer && !isStudentCorrect) {
                      bgStyle = 'bg-red-500/10 border-red-500/30 text-red-400';
                      leadingIcon = <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
                    }

                    return (
                      <div
                        key={oIdx}
                        className={`flex items-center space-x-3 px-4 py-3 rounded-xl border text-xs font-semibold ${bgStyle}`}
                      >
                        <span
                          className={`w-6 h-6 rounded flex items-center justify-center font-bold border ${
                            isCorrectAnswer
                              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                              : isSelectedAnswer
                              ? 'bg-red-500/20 border-red-500/30 text-red-400'
                              : 'bg-white/5 border-transparent text-gray-500'
                          }`}
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="flex-grow">{opt}</span>
                        {leadingIcon}
                      </div>
                    );
                  })}
                </div>

                {/* Question correctness banner */}
                <div className="mt-4 pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-[11px] font-medium">
                  {isStudentCorrect ? (
                    <p className="text-emerald-400 flex items-center space-x-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Correctly Answered</span>
                    </p>
                  ) : (
                    <p className="text-red-400 flex items-center space-x-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Incorrect. Correct answer was {String.fromCharCode(65 + q.correctAnswer)}</span>
                    </p>
                  )}

                  {attempt.responses[idx] && (
                    <div className="flex items-center space-x-2 text-gray-400">
                      <span>Submitted Confidence:</span>
                      <span className={`uppercase font-bold ${
                        attempt.responses[idx].confidenceLevel === 'high'
                          ? 'text-rose-400 font-mono'
                          : attempt.responses[idx].confidenceLevel === 'medium'
                          ? 'text-amber-400 font-mono'
                          : 'text-blue-400 font-mono'
                      }`}>
                        {attempt.responses[idx].confidenceLevel}
                      </span>
                      <span className="text-gray-600">•</span>
                      <span>Speed: {attempt.responses[idx].timeTaken || 0}s</span>
                    </div>
                  )}
                </div>

                {q.explanation && (
                  <div className="mt-3 bg-white/2 border border-white/5 p-3 rounded-lg text-xs leading-relaxed text-gray-400">
                    <span className="font-bold text-gray-300 block mb-1">Explanation:</span>
                    {q.explanation}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>
      {pdfStatus && (
      <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className={`px-5 py-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-center space-x-3 text-sm font-semibold ${
          pdfStatus.includes('Failed')
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : pdfStatus.includes('Started')
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
        }`}>
          {pdfStatus.includes('Generating') && (
            <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mr-1" />
          )}
          <span>{pdfStatus}</span>
        </div>
      </div>
    )}
  </div>
);
};

export default ResultPage;
