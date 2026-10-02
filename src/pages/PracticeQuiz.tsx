import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import {
  ArrowLeft, ArrowRight, CheckCircle, Zap, BrainCircuit,
  AlertCircle, RefreshCw, ShieldAlert
} from 'lucide-react';
import { FormattedQuestionText, FormattedOptionText } from '../components/FormattedQuestionText';

interface PracticeQuestion {
  _id: string;
  questionText: string;
  options: string[];
  difficulty: string;
  topic: string;
}

interface PracticeResponse {
  questionId: string;
  answerIndex: number;
  confidenceLevel: 'low' | 'medium' | 'high';
  timeTaken: number;
}

interface ResultResponse {
  questionText: string;
  options: string[];
  correctAnswer: number;
  selectedAnswer: number;
  isCorrect: boolean;
  confidenceLevel: string;
  explanation?: string;
  topic: string;
}

const difficultyColors: Record<string, string> = {
  easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  hard: 'bg-red-500/10 text-red-400 border-red-500/20',
  expert: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const PracticeQuiz: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Generation phase
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [noQuestions, setNoQuestions] = useState(false);

  // Quiz phase
  const [practiceSetId, setPracticeSetId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<PracticeResponse[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high' | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [submitting, setSubmitting] = useState(false);

  // Results phase
  const [results, setResults] = useState<ResultResponse[] | null>(null);
  const [score, setScore] = useState(0);
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    // Fetch weak topics upfront for display
    const fetchRecommendations = async () => {
      if (!user) return;
      try {
        const res = await API.post('/ai/recommend');
        setWeakTopics(res.data.recommendations?.weaknesses || []);
      } catch (_e) {
        // silently fail
      }
    };
    fetchRecommendations();
  }, [user]);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await API.get(`/ai/practice/${user._id}`);
      if (!res.data.hasQuestions) {
        setNoQuestions(true);
      } else {
        setPracticeSetId(res.data.practiceSetId);
        setQuestions(res.data.questions);
        setResponses(new Array(res.data.questions.length).fill(null).map(() => ({
          questionId: '',
          answerIndex: -1,
          confidenceLevel: 'medium' as const,
          timeTaken: 0,
        })));
        setQuestionStartTime(Date.now());
        setCurrentIndex(0);
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to generate practice set');
    } finally {
      setGenerating(false);
    }
  };

  const handleOptionSelect = (idx: number) => {
    setSelectedOption(idx);
    setError(null);
  };

  const handleConfidenceSelect = (level: 'low' | 'medium' | 'high') => {
    setConfidence(level);
    setError(null);
  };

  const handleNext = () => {
    if (selectedOption === null || confidence === null) {
      setError('Please select both an answer and a confidence level.');
      return;
    }
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    const updated = [...responses];
    updated[currentIndex] = {
      questionId: questions[currentIndex]._id,
      answerIndex: selectedOption,
      confidenceLevel: confidence,
      timeTaken: elapsed,
    };
    setResponses(updated);
    setSelectedOption(null);
    setConfidence(null);
    setQuestionStartTime(Date.now());
    setCurrentIndex(currentIndex + 1);
  };

  const handleSubmit = async () => {
    if (selectedOption === null || confidence === null) {
      setError('Please select both an answer and a confidence level before submitting.');
      return;
    }
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    const finalResponses = [...responses];
    finalResponses[currentIndex] = {
      questionId: questions[currentIndex]._id,
      answerIndex: selectedOption,
      confidenceLevel: confidence,
      timeTaken: elapsed,
    };

    setSubmitting(true);
    try {
      const res = await API.post('/ai/practice/submit', {
        practiceSetId,
        responses: finalResponses,
      });
      setResults(res.data.responses);
      setScore(res.data.score);
      setPercentage(res.data.percentage);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error submitting practice set');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Results Screen ──
  if (results) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
        <GlassCard className="border border-white/5 p-8 text-center space-y-4">
          <div className="inline-flex p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
            <BrainCircuit className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-2xl font-extrabold text-white">Practice Complete!</h3>
          <div className="flex justify-center gap-6">
            <div className="text-center">
              <span className="block text-3xl font-black text-indigo-400 font-mono">{score}/{questions.length}</span>
              <span className="text-xs text-gray-500 font-medium">Questions Correct</span>
            </div>
            <div className="text-center">
              <span className="block text-3xl font-black text-emerald-400 font-mono">{percentage}%</span>
              <span className="text-xs text-gray-500 font-medium">Accuracy</span>
            </div>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={handleGenerate}
              className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>New Practice Set</span>
            </button>
            <button
              onClick={() => navigate('/dashboard/learning-path')}
              className="flex items-center space-x-2 px-5 py-2.5 bg-white/5 border border-white/10 text-gray-300 text-sm font-bold rounded-xl hover:bg-white/10 transition-all"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Learning Path</span>
            </button>
          </div>
        </GlassCard>

        {/* Question Review */}
        <div className="space-y-4">
          {results.map((r, i) => (
            <GlassCard key={i} className={`border p-5 space-y-2 ${r.isCorrect ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white leading-snug">{r.questionText}</p>
                {r.isCorrect
                  ? <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  : <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
              </div>
              <div className="text-xs space-y-1">
                {!r.isCorrect && (
                  <p className="text-red-400">Your answer: <span className="font-semibold">{r.options?.[r.selectedAnswer] || 'N/A'}</span></p>
                )}
                <p className="text-emerald-400">Correct answer: <span className="font-semibold">{r.options?.[r.correctAnswer] || 'N/A'}</span></p>
                {r.explanation && <p className="text-gray-400 italic mt-1">{r.explanation}</p>}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    );
  }

  // ── Active Quiz ──
  if (questions.length > 0 && practiceSetId) {
    const currentQ = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Progress */}
        <GlassCard className="border border-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-white">Practice Quiz</span>
            <span className="text-xs text-indigo-400 font-semibold">
              Question {currentIndex + 1} of {questions.length}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-[10px] font-extrabold uppercase border px-2 py-0.5 rounded-full ${difficultyColors[currentQ.difficulty] || difficultyColors.medium}`}>
              {currentQ.difficulty}
            </span>
            <span className="text-xs text-gray-500 capitalize">Topic: {currentQ.topic}</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </GlassCard>

        {/* Question Card */}
        <GlassCard className="border border-white/5 p-6 sm:p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2 rounded-lg flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Question</span>
            <div className="text-lg font-bold text-white leading-relaxed">
              <FormattedQuestionText text={currentQ.questionText} />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {currentQ.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleOptionSelect(idx)}
                className={`w-full flex items-center space-x-4 px-4 py-4 rounded-xl border text-left text-sm font-semibold transition-all ${
                  selectedOption === idx
                    ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                    : 'bg-transparent border-white/5 text-gray-300 hover:bg-white/3 hover:border-white/10'
                }`}
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold border transition-colors ${
                  selectedOption === idx ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/5 text-gray-500'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 leading-snug">
                  <FormattedOptionText text={opt} />
                </span>
              </button>
            ))}
          </div>

          {/* Confidence */}
          <div className="border-t border-white/5 pt-5 space-y-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confidence Level</span>
            <div className="flex gap-3">
              {(['low', 'medium', 'high'] as const).map((level) => {
                const colors = { low: 'border-blue-500 bg-blue-600/15 text-blue-400', medium: 'border-amber-500 bg-amber-600/15 text-amber-400', high: 'border-rose-500 bg-rose-600/15 text-rose-400' };
                const inactive = { low: 'border-white/5 text-gray-400 hover:border-blue-500/30', medium: 'border-white/5 text-gray-400 hover:border-amber-500/30', high: 'border-white/5 text-gray-400 hover:border-rose-500/30' };
                return (
                  <button
                    key={level}
                    onClick={() => handleConfidenceSelect(level)}
                    className={`flex-1 flex items-center justify-center space-x-1.5 py-3 rounded-xl border text-xs font-extrabold uppercase tracking-wide transition-all ${
                      confidence === level ? colors[level] : `bg-transparent ${inactive[level]}`
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full border flex items-center justify-center ${confidence === level ? 'border-current' : 'border-gray-600'}`}>
                      {confidence === level && <span className="w-1.5 h-1.5 bg-current rounded-full" />}
                    </span>
                    <span>{level}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </GlassCard>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="text-xs font-semibold text-gray-400 hover:text-white transition-colors">
            ← Exit Practice
          </button>
          {isLastQuestion ? (
            <button
              onClick={handleSubmit}
              disabled={selectedOption === null || confidence === null || submitting}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{submitting ? 'Submitting…' : 'Finish Practice'}</span>
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={selectedOption === null || confidence === null}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Generation Start Screen ──
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <button onClick={() => navigate('/dashboard')} className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white mb-2 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-2">
          <span>Smart Practice Quiz</span>
          <Zap className="w-6 h-6 text-amber-400" />
        </h2>
        <p className="text-gray-400 text-sm mt-1">AI-generated practice targeting your weak areas.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <GlassCard className="border border-white/5 p-8 space-y-6 text-center">
        <div className="inline-flex p-5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
          <BrainCircuit className="w-12 h-12 text-amber-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Ready to Practice?</h3>
          <p className="text-gray-400 text-sm mt-2 leading-relaxed max-w-sm mx-auto">
            I'll generate a personalized 10-question set — <span className="text-amber-400 font-semibold">70% from your weak topics</span> and 30% review questions.
          </p>
        </div>

        {noQuestions ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400 space-y-1">
            <p className="font-bold">No questions available for your weak topics.</p>
            <p className="text-xs">Ask your admin to add more questions to the question bank.</p>
          </div>
        ) : (
          <>
            {weakTopics.length > 0 && (
              <div className="text-left space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Targeting These Weak Topics:</p>
                <div className="flex flex-wrap gap-2">
                  {weakTopics.slice(0, 5).map(t => (
                    <span key={t} className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold capitalize">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 text-center text-xs text-gray-400">
              <div className="p-3 bg-white/3 rounded-xl border border-white/5">
                <span className="block text-lg font-black text-white">10</span>
                <span>Questions</span>
              </div>
              <div className="p-3 bg-white/3 rounded-xl border border-white/5">
                <span className="block text-lg font-black text-amber-400">70%</span>
                <span>Weak Topics</span>
              </div>
              <div className="p-3 bg-white/3 rounded-xl border border-white/5">
                <span className="block text-lg font-black text-indigo-400">30%</span>
                <span>Review</span>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center space-x-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating your set…</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Generate Practice Set</span>
                </>
              )}
            </button>
          </>
        )}
      </GlassCard>
    </div>
  );
};

export default PracticeQuiz;
