import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ArrowLeft, BrainCircuit, TrendingUp, AlertCircle,
  CheckCircle, Lightbulb, BookOpen, Target, Zap, ChevronRight
} from 'lucide-react';

interface TopicBreakdown {
  topic: string;
  accuracy: number;
  status: 'mastered' | 'intermediate' | 'weak';
  questionsCount: number;
}

interface AIReport {
  summary: string;
  learningLevel: 'beginner' | 'intermediate' | 'advanced';
  accuracy: number;
  confidenceAccuracy: number;
  adaptiveScore: number;
  difficultyReached: string;
  strengths: string[];
  weaknesses: string[];
  suggestedTopics: string[];
  studyRecommendations: string[];
  topicBreakdown: TopicBreakdown[];
  generatedAt: string;
}

const levelConfig = {
  beginner: { label: 'Beginner', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  intermediate: { label: 'Intermediate', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  advanced: { label: 'Advanced', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
};

const statusConfig = {
  mastered: { label: 'Mastered', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  intermediate: { label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  weak: { label: 'Needs Work', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

const AIReportCard: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState<AIReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasReport, setHasReport] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      try {
        const res = await API.get(`/ai/report/${user._id}?attemptId=${attemptId}`);
        if (res.data.hasReport) {
          setReport(res.data.report);
          setHasReport(true);
        } else {
          setHasReport(false);
        }
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load AI report');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user, attemptId]);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <span>AI Report Card</span>
            <BrainCircuit className="w-6 h-6 text-indigo-400 animate-pulse" />
          </h2>
          <p className="text-gray-400 text-sm mt-1 font-medium">
            Personalized analysis of your quiz performance and learning patterns.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => navigate('/dashboard/practice')}
            className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Zap className="w-4 h-4" />
            <span>Practice Weaknesses</span>
          </button>
          <button
            onClick={() => navigate('/dashboard/learning-path')}
            className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 rounded-xl transition-all"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Learning Path</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!hasReport ? (
        <GlassCard className="border border-white/5 py-24 text-center">
          <BrainCircuit className="w-14 h-14 text-indigo-400 mx-auto mb-4 opacity-50" />
          <p className="text-white font-bold text-lg">Report being generated…</p>
          <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
            Your AI report card is being prepared. Please refresh in a moment or complete a quiz first.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all"
          >
            Refresh
          </button>
        </GlassCard>
      ) : report && (
        <>
          {/* Learning Level + Summary */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-base font-bold text-white">AI Performance Summary</h3>
              <span className={`text-xs font-extrabold uppercase tracking-wide px-3 py-1 rounded-full border ${levelConfig[report.learningLevel].bg} ${levelConfig[report.learningLevel].border} ${levelConfig[report.learningLevel].color}`}>
                {levelConfig[report.learningLevel].label} Level
              </span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed border-l-2 border-indigo-500 pl-4 italic">
              {report.summary}
            </p>
          </GlassCard>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Accuracy', value: `${report.accuracy}%`, icon: Target, color: 'text-indigo-400' },
              { label: 'Confidence Accuracy', value: `${report.confidenceAccuracy}%`, icon: BrainCircuit, color: 'text-purple-400' },
              { label: 'Adaptive Score', value: report.adaptiveScore, icon: Zap, color: 'text-amber-400' },
              { label: 'Difficulty Reached', value: report.difficultyReached.charAt(0).toUpperCase() + report.difficultyReached.slice(1), icon: TrendingUp, color: 'text-emerald-400' },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <GlassCard key={metric.label} className="border border-white/5 p-4 text-center">
                  <Icon className={`w-5 h-5 mx-auto mb-2 ${metric.color}`} />
                  <span className={`block text-2xl font-black font-mono ${metric.color}`}>{metric.value}</span>
                  <span className="text-xs text-gray-500 font-medium mt-1 block">{metric.label}</span>
                </GlassCard>
              );
            })}
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassCard className="border border-emerald-500/10 p-6 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Strong Areas</span>
              </h3>
              {report.strengths.length > 0 ? (
                <ul className="space-y-2">
                  {report.strengths.map((s) => (
                    <li key={s} className="flex items-center space-x-2 text-sm text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="capitalize">{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">Complete more quizzes to identify your strengths.</p>
              )}
            </GlassCard>

            <GlassCard className="border border-red-500/10 p-6 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>Weak Areas</span>
              </h3>
              {report.weaknesses.length > 0 ? (
                <ul className="space-y-2">
                  {report.weaknesses.map((w) => (
                    <li key={w} className="flex items-center space-x-2 text-sm text-red-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="capitalize">{w}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">No weak areas detected yet — keep quizzing!</p>
              )}
            </GlassCard>
          </div>

          {/* Study Recommendations */}
          {report.studyRecommendations.length > 0 && (
            <GlassCard className="border border-indigo-500/10 p-6 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Lightbulb className="w-4 h-4 text-indigo-400" />
                <span>AI Study Recommendations</span>
              </h3>
              <ul className="space-y-2">
                {report.studyRecommendations.map((r, i) => (
                  <li key={i} className="flex items-start space-x-3 text-sm text-gray-300">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {/* Suggested Topics */}
          {report.suggestedTopics.length > 0 && (
            <GlassCard className="border border-white/5 p-6 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span>Recommended Next Topics</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {report.suggestedTopics.map((topic, i) => (
                  <span
                    key={topic}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold"
                  >
                    <span className="text-purple-500 font-bold">#{i + 1}</span>
                    <span className="capitalize">{topic}</span>
                  </span>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Topic Breakdown */}
          {report.topicBreakdown.length > 0 && (
            <GlassCard className="border border-white/5 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white">Topic-by-Topic Breakdown</h3>
              <div className="space-y-3">
                {report.topicBreakdown.map((topic) => {
                  const cfg = statusConfig[topic.status];
                  return (
                    <div key={topic.topic} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white capitalize truncate">{topic.topic}</span>
                          <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                            <span className="text-xs text-gray-400">{topic.questionsCount}q</span>
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${topic.status === 'mastered' ? 'bg-emerald-500' : topic.status === 'intermediate' ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${topic.accuracy}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-white w-10 text-right">{topic.accuracy}%</span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/dashboard/practice')}
              className="flex-1 flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-sm"
            >
              <Zap className="w-4 h-4" />
              <span>Generate Practice Quiz</span>
            </button>
            <button
              onClick={() => navigate('/dashboard/learning-path')}
              className="flex-1 flex items-center justify-center space-x-2 py-3 bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 font-bold rounded-xl transition-all text-sm"
            >
              <TrendingUp className="w-4 h-4" />
              <span>View Learning Path</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AIReportCard;
