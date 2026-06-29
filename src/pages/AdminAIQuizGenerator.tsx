import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ArrowLeft,
  Sparkles,
  BookOpen,
  Compass,
  CheckCircle,
  ListOrdered
} from 'lucide-react';

const AdminAIQuizGenerator: React.FC = () => {
  const navigate = useNavigate();

  // Inputs
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(10);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ quizId: string; title: string; count: number } | null>(null);

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !topic.trim()) {
      setError('Please provide both a quiz title and a topic category.');
      return;
    }
    setError(null);
    setSuccessData(null);
    setLoading(true);

    try {
      const res = await API.post('/ai/generate-quiz', {
        title,
        topic,
        difficulty,
        numberOfQuestions: questionCount
      });

      if (res.data.success) {
        setSuccessData({
          quizId: res.data.quiz._id,
          title: res.data.quiz.title,
          count: res.data.questionsCount
        });
        setTitle('');
        setTopic('');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to auto-generate quiz.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-300">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Admin Overview</span>
        </button>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI Quiz Generator
          </span>
          <Sparkles className="w-7 h-7 text-indigo-400 animate-pulse" />
        </h2>
        <p className="text-gray-400 text-sm mt-1.5 font-medium">
          Instantly generate complete, adaptive-ready evaluation exams and templates using AI.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <GlassCard className="border border-white/5 p-16 text-center space-y-6">
          <LoadingSpinner />
          <div className="space-y-2 max-w-sm mx-auto">
            <h4 className="text-white font-bold text-base">Creating Assessment Template...</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              AI is authoring standard-aligned questions, selecting option variables, and compiling solutions.
            </p>
          </div>
        </GlassCard>
      ) : successData ? (
        <GlassCard className="border border-emerald-500/20 bg-emerald-500/1 p-8 text-center space-y-6">
          <div className="inline-flex p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-extrabold text-white">Quiz Generated Successfully!</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
              Quiz <strong className="text-white">"{successData.title}"</strong> is active and available with{' '}
              <strong className="text-emerald-400">{successData.count}</strong> generated questions.
            </p>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => setSuccessData(null)}
              className="px-5 py-2.5 bg-white/5 border border-white/10 text-gray-300 text-xs font-bold rounded-xl hover:bg-white/10 transition-all"
            >
              Generate Another Quiz
            </button>
            <button
              onClick={() => navigate('/admin/quizzes')}
              className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-600 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
            >
              Go to Quiz Manager
            </button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="border border-white/5 p-6 sm:p-8">
          <form onSubmit={handleGenerateQuiz} className="space-y-6">
            <div className="space-y-4">
              {/* Quiz Title */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">Quiz Name</label>
                <input
                  type="text"
                  placeholder="e.g. Probability Basics Midterm, Intermediate Calculus"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/2 border border-white/5 rounded-xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              {/* Topic Category */}
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Probability, Algebra, Geometry"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-white/2 border border-white/5 rounded-xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              {/* Configuration selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-3.5 py-3.5 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">Questions Quantity</label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-3.5 py-3.5 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  >
                    <option value="5">5 Questions</option>
                    <option value="10">10 Questions</option>
                    <option value="15">15 Questions</option>
                    <option value="20">20 Questions</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-1.5 py-4 text-xs font-bold bg-indigo-650 hover:bg-indigo-600 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-lg transition-all"
            >
              <Sparkles className="w-4.5 h-4.5" />
              <span>Generate & Save Complete Quiz</span>
            </button>
          </form>
        </GlassCard>
      )}

      {/* Info footer details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-xs font-semibold text-gray-500">
        <GlassCard className="border border-white/5 p-4 flex flex-col justify-center">
          <BookOpen className="w-5 h-5 text-indigo-400/60 mx-auto mb-1.5" />
          <span>Save Directly to Database</span>
        </GlassCard>
        <GlassCard className="border border-white/5 p-4 flex flex-col justify-center">
          <Compass className="w-5 h-5 text-purple-400/60 mx-auto mb-1.5" />
          <span>Adaptive Ready Layout</span>
        </GlassCard>
        <GlassCard className="border border-white/5 p-4 flex flex-col justify-center">
          <ListOrdered className="w-5 h-5 text-pink-400/60 mx-auto mb-1.5" />
          <span>Automatic Grading Solutions</span>
        </GlassCard>
      </div>
    </div>
  );
};

export default AdminAIQuizGenerator;
