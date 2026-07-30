import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import PerformanceChart from '../components/PerformanceChart';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  BookOpen,
  Trophy,
  Sparkles,
  ArrowRight,
  Flame,
  MessageSquare,
  Compass,
  BrainCircuit,
  Target,
  Calendar,
  GitFork,
  Activity,
  Bell,
  CheckSquare,
  Square,
  ChevronRight,
  Users,
  Shield
} from 'lucide-react';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  isAdaptive: boolean;
  topic?: string;
  difficulty?: string;
  questions?: string[];
}

interface Attempt {
  _id: string;
  quiz: {
    title: string;
    isAdaptive: boolean;
  };
  score: number;
  totalQuestions: number;
  percentage: number;
  createdAt: string;
}

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'skilltree' | 'studyplan'>('overview');

  // Existing states
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Phase 7 states
  const [predictions, setPredictions] = useState<any>(null);
  const [studyPlan, setStudyPlan] = useState<any>(null);
  const [skillProfile, setSkillProfile] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [reminders, setReminders] = useState<string[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;
      try {
        const [
          quizRes,
          attemptRes,
          streakRes,
          recRes,
          predRes,
          planRes,
          profileRes
        ] = await Promise.all([
          API.get('/quizzes'),
          API.get(`/results/${user._id}`),
          API.get(`/ai/streak/${user._id}`).catch(() => ({ data: { streak: { current: 0, longest: 0 } } })),
          API.get(`/recommendations/${user._id}`).catch(() => ({ data: { recommendations: null } })),
          API.get(`/predictions/${user._id}`).catch(() => ({ data: { predictions: null } })),
          API.get(`/study-plan/${user._id}`).catch(() => ({ data: { studyPlan: null } })),
          API.get(`/skill-profile/${user._id}`).catch(() => ({ data: { profile: null, metrics: null, reminders: [] } }))
        ]);

        setQuizzes(quizRes.data.quizzes || []);
        setAttempts(attemptRes.data.attempts || []);
        setStreak(streakRes.data.streak || { current: 0, longest: 0 });
        
        // Phase 7 data binding
        setRecommendations(recRes.data.recommendations || null);
        setPredictions(predRes.data.predictions || null);
        setStudyPlan(planRes.data.studyPlan || null);
        
        if (profileRes.data.success) {
          setSkillProfile(profileRes.data.profile || null);
          setMetrics(profileRes.data.metrics || null);
          setReminders(profileRes.data.reminders || []);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading dashboard metadata');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);

  // Handle study plan task local toggling
  const handleToggleTask = (weekIdx: number, taskIdx: number) => {
    if (!studyPlan) return;
    const updated = { ...studyPlan };
    updated.weeks[weekIdx].tasks[taskIdx].isCompleted = !updated.weeks[weekIdx].tasks[taskIdx].isCompleted;
    setStudyPlan(updated);
  };

  const totalAttemptsCount = attempts.length;
  const averagePercentage = totalAttemptsCount > 0 
    ? Math.round(attempts.reduce((acc, curr) => acc + curr.percentage, 0) / totalAttemptsCount)
    : 0;

  // Transform attempt scores for Performance Chart
  const chartData = [...attempts]
    .slice(0, 6)
    .reverse()
    .map((attempt) => ({
      label: new Date(attempt.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      value: attempt.percentage,
    }));

  // Recharts Radar Chart topic mapping
  const radarChartData = skillProfile && skillProfile.topicMastery
    ? Object.entries(skillProfile.topicMastery).map(([topic, acc]: any) => ({
        subject: topic.charAt(0).toUpperCase() + topic.slice(1),
        accuracy: acc
      }))
    : [
        { subject: 'Algebra', accuracy: 60 },
        { subject: 'Geometry', accuracy: 50 },
        { subject: 'Probability', accuracy: 40 },
        { subject: 'Statistics', accuracy: 70 }
      ];

  // Recharts Velocity chart mapping
  const velocityChartData = metrics && metrics.velocityHistory && metrics.velocityHistory.length > 0
    ? metrics.velocityHistory.slice(-6).map((vh: any) => ({
        date: new Date(vh.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        velocity: vh.velocity
      }))
    : [
        { date: 'Initial', velocity: 0 },
        { date: 'Session 2', velocity: 5 },
        { date: 'Session 3', velocity: 12 },
        { date: 'Session 4', velocity: 15 }
      ];

  // Get readiness color
  const getReadinessColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
    if (score >= 50) return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    return 'text-red-400 border-red-500/20 bg-red-500/5';
  };

  const handleSwitchToAdmin = async () => {
    try {
      const token = localStorage.getItem('token');
      const targetUrl = `${window.location.protocol}//${window.location.hostname}:5000/api/user/role`;
      const res = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ role: 'admin' }),
      });

      if (res.ok) {
        window.location.href = '/admin';
      } else {
        const text = await res.text();
        let message = 'Failed to switch role';
        try { message = JSON.parse(text).message || message; } catch (_) {}
        alert(message);
      }
    } catch (err) {
      console.error('Failed to switch role:', err);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-300">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-indigo-900/10 border border-indigo-500/10 rounded-2xl p-6 sm:p-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <span>Welcome back, {user?.name}!</span>
            <Sparkles className="w-5.5 h-5.5 text-indigo-400 animate-pulse" />
          </h2>
          <p className="text-gray-400 text-sm mt-2 max-w-xl leading-relaxed">
            Diagnose your performance in real-time, progress along your dynamically generated study path, or drill specific subjects.
          </p>
          <div className="mt-4">
            <button
              onClick={handleSwitchToAdmin}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Switch to Faculty / Admin Portal</span>
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3 self-start md:self-auto">
          {streak && streak.current > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-xl text-center">
              <span className="block text-xl font-extrabold text-amber-400 leading-none flex items-center justify-center space-x-1">
                <span>{streak.current}</span>
                <Flame className="w-5 h-5 text-amber-500 animate-bounce" />
              </span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1 block">Streak</span>
            </div>
          )}
          <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-xl text-center">
            <span className="block text-xl font-extrabold text-indigo-400 leading-none">{totalAttemptsCount}</span>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1 block">Attempts</span>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 px-4 py-2.5 rounded-xl text-center">
            <span className="block text-xl font-extrabold text-purple-400 leading-none">{averagePercentage}%</span>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1 block">Avg Score</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Header */}
      <div className="flex border-b border-white/5 space-x-6 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'overview'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Compass className="w-4.5 h-4.5" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`pb-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'skills'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Target className="w-4.5 h-4.5" />
          <span>Skill Profile</span>
        </button>
        <button
          onClick={() => setActiveTab('skilltree')}
          className={`pb-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'skilltree'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <GitFork className="w-4.5 h-4.5" />
          <span>Skill Tree</span>
        </button>
        <button
          onClick={() => setActiveTab('studyplan')}
          className={`pb-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'studyplan'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Calendar className="w-4.5 h-4.5" />
          <span>Study Plan</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {/* ─── TAB 1: OVERVIEW ─────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Quick Links Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <GlassCard
              hoverable
              onClick={() => navigate('/dashboard/learning-path')}
              className="border-indigo-500/10 hover:border-indigo-500/30 p-4 flex items-center space-x-4 cursor-pointer"
            >
              <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Learning Roadmap</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Visualize your step-by-step masteries.</p>
              </div>
            </GlassCard>

            <GlassCard
              hoverable
              onClick={() => navigate('/dashboard/practice')}
              className="border-purple-500/10 hover:border-purple-500/30 p-4 flex items-center space-x-4 cursor-pointer"
            >
              <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 text-purple-400">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">AI Practice Room</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Target and drill weaknesses.</p>
              </div>
            </GlassCard>

            <GlassCard
              hoverable
              onClick={() => navigate('/dashboard/ai-tutor')}
              className="border-pink-500/10 hover:border-pink-500/30 p-4 flex items-center space-x-4 cursor-pointer"
            >
              <div className="bg-pink-500/10 p-3 rounded-xl border border-pink-500/20 text-pink-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">AI Tutor Chat</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Chat with your AI study assistant.</p>
              </div>
            </GlassCard>

            <GlassCard
              hoverable
              onClick={() => navigate('/multiplayer/join')}
              className="border-emerald-500/10 hover:border-emerald-500/30 p-4 flex items-center space-x-4 cursor-pointer"
            >
              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Join Multiplayer</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Enter PIN to play multiplayer quizzes.</p>
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Available Quizzes */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <span>Available Assessments</span>
              </h3>

              {quizzes.length === 0 ? (
                <GlassCard className="border border-white/5 py-16 text-center text-gray-500">
                  <p className="font-semibold text-lg text-white">No active quizzes</p>
                  <p className="text-xs text-gray-400 mt-1">Check back later or ask an administrator to add tasks</p>
                </GlassCard>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {quizzes.map((quiz) => (
                    <GlassCard
                      key={quiz._id}
                      hoverable
                      onClick={() => navigate(`/quiz/${quiz._id}`)}
                      className="border border-white/5 hover:border-indigo-500/30 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 border rounded-full ${
                              quiz.isAdaptive
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {quiz.isAdaptive ? 'AI Adaptive' : 'Static Quiz'}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-white mt-3 line-clamp-1">{quiz.title}</h4>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2 min-h-[32px]">
                          {quiz.description || 'No description available'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                          {quiz.isAdaptive ? `Topic: ${quiz.topic}` : `${quiz.questions?.length || 0} questions`}
                        </span>
                        <span className="text-indigo-400 hover:text-indigo-300 font-semibold text-xs flex items-center space-x-1">
                          <span>Start</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar Overview widgets */}
            <div className="space-y-6">
              {/* Daily consistency goals widget */}
              <GlassCard className="border border-white/5 p-4 space-y-3 bg-[#0a0f1d]">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Daily Target Goal</span>
                  <Activity className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Consistency rating:</span>
                  <span className="text-xs font-extrabold text-indigo-400">{metrics ? metrics.consistencyScore : 0}%</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-500"
                    style={{ width: `${metrics ? metrics.consistencyScore : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed font-semibold">
                  {metrics && metrics.consistencyScore >= 70
                    ? '🔥 Keep up the consistent pace! You are retaining concepts at a high velocity.'
                    : '⚡ Initiate one additional practice drill to build your retention multiplier.'}
                </p>
              </GlassCard>

              {/* AI study recommendations */}
              {recommendations && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                    <BrainCircuit className="w-5 h-5 text-indigo-400 animate-pulse" />
                    <span>AI Study Recommendations</span>
                  </h3>
                  <GlassCard className="border-indigo-500/10 bg-indigo-950/5 p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                        Readiness Level: {predictions ? predictions.readinessLevel?.replace('_', ' ') : 'beginner'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 italic">
                      "{recommendations.summary || 'Complete your evaluations to calculate review guides.'}"
                    </p>

                    {recommendations.recommendedTopics && recommendations.recommendedTopics.length > 0 && (
                      <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                        <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider block">Recommended Topics</span>
                        <div className="flex flex-wrap gap-1.5">
                          {recommendations.recommendedTopics.slice(0, 3).map((rt: any) => (
                            <span
                              key={rt.topic}
                              className="bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize"
                            >
                              {rt.topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </GlassCard>
                </div>
              )}

              {/* Progress curves chart */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-indigo-400" />
                  <span>Score Progression</span>
                </h3>
                <GlassCard className="border border-white/5">
                  <PerformanceChart data={chartData} title="Accuracy history (last 6 attempts)" />
                </GlassCard>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SKILL PROFILE ───────────────────────────────────── */}
      {activeTab === 'skills' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
          {/* Skill Radar Chart & Heatmap */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard className="border border-white/5 p-5">
              <h3 className="text-base font-bold text-white tracking-tight mb-4 flex items-center space-x-2">
                <Target className="w-5 h-5 text-indigo-400" />
                <span>Subject Mastery Matrix</span>
              </h3>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarChartData}>
                    <PolarGrid stroke="#ffffff10" />
                    <PolarAngleAxis dataKey="subject" stroke="#a1a1aa" fontSize={11} fontWeight="bold" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#a1a1aa" fontSize={9} />
                    <Radar
                      name="Accuracy"
                      dataKey="accuracy"
                      stroke="#818cf8"
                      fill="#818cf8"
                      fillOpacity={0.25}
                    />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0f1d', borderColor: '#ffffff10', color: '#fff' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Mastery Heatmap Grid */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white tracking-tight">Mastery Heatmap</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {radarChartData.map((data, index) => {
                  let opacityClass = 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
                  if (data.accuracy >= 85) opacityClass = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
                  else if (data.accuracy >= 60) opacityClass = 'bg-indigo-500/30 border-indigo-500/50 text-indigo-300';
                  else opacityClass = 'bg-red-500/10 border-red-500/20 text-red-400';

                  return (
                    <GlassCard key={index} className={`border p-4 text-center space-y-1 ${opacityClass}`}>
                      <h4 className="text-xs font-extrabold uppercase tracking-wide truncate">{data.subject}</h4>
                      <p className="text-2xl font-black">{data.accuracy}%</p>
                      <span className="text-[9px] font-bold opacity-80">
                        {data.accuracy >= 85 ? 'Mastered' : data.accuracy >= 60 ? 'Moderate' : 'Review Needed'}
                      </span>
                    </GlassCard>
                  );
                })}
              </div>
            </div>

            {/* Learning Velocity Trend Graph */}
            <GlassCard className="border border-white/5 p-5">
              <h3 className="text-base font-bold text-white tracking-tight mb-4 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                <span>Learning Velocity (Slope of accuracy change)</span>
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={velocityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={10} />
                    <YAxis stroke="#6b7280" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#0a0f1d', borderColor: '#ffffff10', color: '#fff' }} />
                    <Line type="monotone" dataKey="velocity" stroke="#a78bfa" strokeWidth={3} dot={{ fill: '#c084fc', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          {/* Exam Readiness circular gauge card & smart notifications */}
          <div className="space-y-6">
            {/* Exam Readiness Gauge */}
            {skillProfile && (
              <GlassCard className={`border p-6 text-center space-y-4 ${getReadinessColor(skillProfile.examReadinessScore)}`}>
                <h3 className="text-xs uppercase font-extrabold tracking-widest text-gray-400">Exam Readiness Index</h3>
                <div className="relative inline-flex items-center justify-center">
                  {/* Gauge Ring */}
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="8" fill="transparent" className="opacity-10" />
                    <circle
                      cx="64"
                      cy="64"
                      r="54"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 54}
                      strokeDashoffset={2 * Math.PI * 54 * (1 - skillProfile.examReadinessScore / 100)}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <span className="absolute text-3xl font-black text-white">{skillProfile.examReadinessScore}%</span>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white capitalize">
                    {predictions ? predictions.readinessLevel?.replace('_', ' ') : 'beginner'} Level
                  </h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Based on adaptive difficulty scaling, confidence precision calibration, and daily practice rates.
                  </p>
                </div>
              </GlassCard>
            )}

            {/* Smart reminders notification panel */}
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
                <Bell className="w-4.5 h-4.5 text-indigo-400" />
                <span>AI Insights Feed</span>
              </h3>
              <div className="space-y-3">
                {reminders.map((reminder, idx) => (
                  <GlassCard key={idx} className="border border-indigo-500/10 bg-indigo-950/5 p-3.5 flex items-start space-x-3 text-xs">
                    <div className="mt-0.5 text-indigo-400">
                      <Sparkles className="w-4.5 h-4.5 animate-pulse" />
                    </div>
                    <p className="text-gray-300 leading-relaxed">{reminder}</p>
                  </GlassCard>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: VISUAL SKILL TREE ───────────────────────────────── */}
      {activeTab === 'skilltree' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
          <GlassCard className="border border-white/5 p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                <GitFork className="w-5 h-5 text-indigo-400" />
                <span>Metacognitive Curriculum Tree</span>
              </h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Track parent node aggregates and unlock subsequent skills as accuracy threshold crosses 75%.
              </p>
            </div>

            {/* Visual tree directories */}
            <div className="space-y-8 pl-4 border-l border-white/10 relative">
              {/* Parent root node */}
              <div className="relative">
                <div className="absolute -left-6.5 top-2.5 w-5 h-px bg-white/20" />
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-600/20 border border-indigo-500/30 px-3.5 py-2 rounded-xl flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-bold text-white">Mathematics Curriculum</span>
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider bg-white/5 border border-white/5 px-2 py-0.5 rounded">
                    Root Node
                  </span>
                </div>
              </div>

              {/* Sub-node nodes */}
              <div className="space-y-6 pl-6 relative">
                {radarChartData.map((data, idx) => {
                  const isUnlocked = data.accuracy >= 60;
                  const isMastered = data.accuracy >= 85;

                  return (
                    <div key={idx} className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white/2 border border-white/5 rounded-xl">
                      {/* Left horizontal visual connector line */}
                      <div className="absolute -left-6.5 top-7 w-6.5 h-px bg-white/10" />

                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${
                          isMastered 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : isUnlocked 
                              ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                              : 'bg-white/2 border-white/5 text-gray-500'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white capitalize">{data.subject}</h4>
                          <span className="text-[10px] text-gray-500 mt-0.5 block">
                            Status: <strong className={isMastered ? 'text-emerald-400' : isUnlocked ? 'text-indigo-400' : 'text-gray-500'}>
                              {isMastered ? 'Mastered' : isUnlocked ? 'Unlocked' : 'Locked'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Right mastery progress bar */}
                      <div className="flex items-center space-x-4 min-w-[200px]">
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-[10px] font-extrabold text-gray-400">
                            <span>Mastery Percentage</span>
                            <span>{data.accuracy}%</span>
                          </div>
                          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${isMastered ? 'bg-emerald-500' : isUnlocked ? 'bg-indigo-500' : 'bg-gray-700'}`}
                              style={{ width: `${data.accuracy}%` }}
                            />
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 hidden sm:block" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ─── TAB 4: STUDY PLAN CALENDAR ─────────────────────────────── */}
      {activeTab === 'studyplan' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
          <GlassCard className="border border-white/5 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <span>Personalized 4-Week Study Planner</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Focusing 70% on weak subjects, 20% on moderate topics, and 10% on review areas.
                </p>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-md">
                Active Plan
              </span>
            </div>

            {studyPlan && studyPlan.weeks && studyPlan.weeks.length > 0 ? (
              <div className="space-y-6">
                {studyPlan.weeks.map((week: any, wIdx: number) => (
                  <GlassCard key={wIdx} className="border border-white/5 p-5 bg-[#0a0f1d]/50 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <h4 className="text-sm font-extrabold text-white flex items-center space-x-2">
                        <span className="bg-indigo-650 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white bg-indigo-600">
                          Week {week.weekNumber}
                        </span>
                        <span className="capitalize">{week.topic}</span>
                      </h4>
                      <span className="text-[9px] uppercase font-extrabold px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded">
                        Target: {week.difficulty || 'medium'}
                      </span>
                    </div>

                    {/* Week Task list */}
                    <div className="space-y-3">
                      {week.tasks.map((task: any, tIdx: number) => (
                        <div
                          key={tIdx}
                          onClick={() => handleToggleTask(wIdx, tIdx)}
                          className="flex items-start space-x-3 p-2 text-xs text-gray-300 hover:bg-white/2 rounded-lg cursor-pointer transition-colors"
                        >
                          <div className="mt-0.5 flex-shrink-0 text-indigo-400">
                            {task.isCompleted ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                          <span className={`${task.isCompleted ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                            {task.taskText}
                          </span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-12">No active study plans compiled.</p>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
