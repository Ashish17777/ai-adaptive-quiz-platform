import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  exportClassReportCSV,
  exportClassReportPDF,
  type ClassReportData
} from '../utils/reportExport';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import {
  ArrowLeft,
  Users,
  Compass,
  Trophy,
  Award,
  AlertTriangle,
  Flame,
  FileSpreadsheet,
  FileDown,
  BrainCircuit,
  Sparkles,
  TrendingUp,
  Activity,
  Award as MedalIcon
} from 'lucide-react';

interface MissedQuestion {
  questionText: string;
  missedCount: number;
  totalAttempts: number;
  accuracy: number;
  topic: string;
}

interface DifficultTopic {
  topic: string;
  accuracy: number;
}

interface PlayerRanking {
  name: string;
  score: number;
  accuracy: number;
  quizzesPlayed: number;
}

interface Stats {
  averageConfidence: number;
  mostMissedQuestions: MissedQuestion[];
  mostDifficultTopics: DifficultTopic[];
  playerRankings: PlayerRanking[];
  difficultyDistribution: Array<{ name: string; value: number }>;
}

interface ChartsData {
  topicPerformance: Array<{ topic: string; accuracy: number; confidence: number }>;
  confidenceDistribution: Array<{ name: string; value: number }>;
  leaderboardTrends: PlayerRanking[];
}

const AdminAnalytics: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats>({
    averageConfidence: 0,
    mostMissedQuestions: [],
    mostDifficultTopics: [],
    playerRankings: [],
    difficultyDistribution: [],
  });

  const [charts, setCharts] = useState<ChartsData>({
    topicPerformance: [],
    confidenceDistribution: [],
    leaderboardTrends: [],
  });

  const [aiStats, setAiStats] = useState<any>(null);
  const [cohortPredictions, setCohortPredictions] = useState<any>(null);

  useEffect(() => {
    const fetchAdminAnalytics = async () => {
      try {
        const [analyticsRes, aiStatsRes, cohortRes] = await Promise.all([
          API.get('/analytics/admin'),
          API.get('/ai/usage-stats').catch(() => ({ data: { stats: null, recentActivity: [] } })),
          API.get('/predictions/cohort').catch(() => ({ data: { success: false } }))
        ]);
        setStats(analyticsRes.data.stats);
        setCharts(analyticsRes.data.charts);
        setAiStats(aiStatsRes.data);
        
        if (cohortRes.data.success) {
          setCohortPredictions(cohortRes.data);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading administrator metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchAdminAnalytics();
  }, []);

  const handleExportCSV = () => {
    const reportData: ClassReportData = {
      totalStudents: stats.playerRankings.length,
      averageConfidenceClass: stats.averageConfidence,
      mostDifficultTopics: stats.mostDifficultTopics,
      difficultyDistribution: stats.difficultyDistribution,
      playerRankings: stats.playerRankings,
    };
    exportClassReportCSV(reportData);
  };

  const handleExportPDF = () => {
    exportClassReportPDF('all', setPdfStatus);
  };

  if (loading) return <LoadingSpinner fullPage />;

  const PIE_COLORS = ['#3b82f6', '#f59e0b', '#ef4444'];
  const BAR_COLORS = ['#6366f1', '#10b981', '#f43f5e', '#a855f7'];

  // Map readiness distribution for chart
  const readinessDistributionData = cohortPredictions && cohortPredictions.levelsDistribution
    ? [
        { name: 'Beginner', count: cohortPredictions.levelsDistribution.beginner },
        { name: 'Intermediate', count: cohortPredictions.levelsDistribution.intermediate },
        { name: 'Advanced', count: cohortPredictions.levelsDistribution.advanced },
        { name: 'Exam Ready', count: cohortPredictions.levelsDistribution.exam_ready }
      ]
    : [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Admin Overview</span>
          </button>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <span>Admin Analytics Dashboard</span>
            <Users className="w-6 h-6 text-indigo-400" />
          </h2>
          <p className="text-gray-400 text-sm mt-1.5 font-medium">
            Class-wide metacognition ratios, topic challenge metrics, and player performance distributions.
          </p>
        </div>

        {stats.playerRankings.length > 0 && (
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => navigate('/admin/ai-insights')}
              className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold bg-indigo-650 hover:bg-indigo-600 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-indigo-600/10 transition-all border border-indigo-500/20"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>AI Insights</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white rounded-xl transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Class CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/10 transition-all"
            >
              <FileDown className="w-4 h-4" />
              <span>Class PDF</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {stats.playerRankings.length === 0 ? (
        <GlassCard className="border border-white/5 py-24 text-center text-gray-500">
          <Award className="w-16 h-16 text-indigo-400 mx-auto mb-4 opacity-50" />
          <p className="font-bold text-lg text-white">No attempts logged yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Data will populate here once students begin answering quizzes in the system.
          </p>
        </GlassCard>
      ) : (
        <>
          {/* Top Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlassCard className="border border-white/5 p-5 text-center flex flex-col justify-center">
              <span className="block text-3xl font-black text-indigo-400 font-mono">
                {stats.playerRankings.length}
              </span>
              <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                Total Active Students
              </span>
            </GlassCard>

            <GlassCard className="border border-white/5 p-5 text-center flex flex-col justify-center">
              <span className="block text-3xl font-black text-emerald-400 font-mono">
                {stats.averageConfidence}%
              </span>
              <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                Average Class Confidence
              </span>
            </GlassCard>

            <GlassCard className="border border-white/5 p-5 text-left space-y-1">
              <span className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider mb-1">
                Top Difficult Topics
              </span>
              {stats.mostDifficultTopics.length === 0 ? (
                <span className="text-xs text-gray-400 italic">No topics reported</span>
              ) : (
                stats.mostDifficultTopics.map((dt) => (
                  <div key={dt.topic} className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-white truncate max-w-[150px]">{dt.topic}</span>
                    <span className="text-red-400 font-bold font-mono">{dt.accuracy}% Acc</span>
                  </div>
                ))
              )}
            </GlassCard>
          </div>

          {/* Risk Alert Banner */}
          {stats.playerRankings.some(p => p.accuracy < 50) && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center space-x-2">
              <AlertTriangle className="w-4.5 h-4.5 text-red-500 animate-pulse" />
              <span>
                <strong>AI Alert:</strong> {stats.playerRankings.filter(p => p.accuracy < 50).length} student(s) are currently performing below 50% average accuracy and may require intervention.
              </span>
            </div>
          )}

          {/* ─── NEW PHASE 7: COHORT PREDICTIVE DIAGNOSTICS PANEL ────────────────── */}
          {cohortPredictions && (
            <div className="space-y-6">
              <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center space-x-2">
                <BrainCircuit className="w-5 h-5 text-indigo-400" />
                <span>AI Predictive Diagnostics & Cohort Projections</span>
              </h3>

              {/* Aggregated Predictive Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                <GlassCard className="border border-white/5 p-5 bg-indigo-950/5 text-center flex flex-col justify-center">
                  <span className="block text-3xl font-black text-indigo-400 font-mono">
                    {cohortPredictions.averageReadinessScore}%
                  </span>
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                    Class Readiness Index
                  </span>
                </GlassCard>

                <GlassCard className="border border-white/5 p-5 bg-emerald-950/5 text-center flex flex-col justify-center">
                  <span className="block text-3xl font-black text-emerald-400 font-mono">
                    {cohortPredictions.predictedSuccessRate}%
                  </span>
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                    Success Rate Projection
                  </span>
                </GlassCard>

                <GlassCard className="border border-white/5 p-5 bg-purple-950/5 text-center flex flex-col justify-center">
                  <span className="block text-3xl font-black text-purple-400 font-mono">
                    +{cohortPredictions.trends?.averageCohortVelocity}%
                  </span>
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                    Avg Learning Velocity
                  </span>
                </GlassCard>

                <GlassCard className="border border-white/5 p-5 bg-pink-950/5 text-center flex flex-col justify-center">
                  <span className="block text-3xl font-black text-pink-400 font-mono">
                    {cohortPredictions.trends?.averageConsistency}%
                  </span>
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                    Avg Practice Consistency
                  </span>
                </GlassCard>
              </div>

              {/* Chart widgets: Readiness distribution & Drop-off lines */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Readiness distribution bar chart */}
                <GlassCard className="border border-white/5 p-6">
                  <h4 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
                    <TrendingUp className="w-4.5 h-4.5 text-indigo-400" />
                    <span>Student Readiness Distribution</span>
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={readinessDistributionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }} />
                        <Bar dataKey="count" name="Students" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>

                {/* Drop-off analysis graph */}
                <GlassCard className="border border-white/5 p-6">
                  <h4 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
                    <Activity className="w-4.5 h-4.5 text-pink-400" />
                    <span>Drop-off Analysis (Difficulty vs Accuracy)</span>
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cohortPredictions.difficultyDropoffs}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="difficulty" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }} />
                        <Line type="monotone" dataKey="accuracy" name="Average Accuracy (%)" stroke="#ec4899" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCard>
              </div>

              {/* Top Improving Students list */}
              <div className="grid grid-cols-1 gap-6">
                <GlassCard className="border border-white/5 p-6 space-y-4">
                  <h4 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2 flex items-center space-x-2">
                    <MedalIcon className="w-4.5 h-4.5 text-amber-400 animate-bounce" />
                    <span>Top Improving Students (High Velocity Metrics)</span>
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="text-gray-500 uppercase font-extrabold tracking-wider border-b border-white/5">
                          <th className="py-2.5">Student</th>
                          <th className="py-2.5">Email</th>
                          <th className="py-2.5 text-center">Learning Velocity</th>
                          <th className="py-2.5 text-right">Readiness Index</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-semibold text-gray-300">
                        {cohortPredictions.topImprovingStudents.map((s: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/2">
                            <td className="py-3 text-white">{s.name}</td>
                            <td className="py-3 text-gray-400">{s.email}</td>
                            <td className="py-3 text-center text-purple-400 font-bold font-mono">+{s.learningVelocity}% pts/quiz</td>
                            <td className="py-3 text-right font-black font-mono text-emerald-400">{s.readinessScore}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </div>
            </div>
          )}

          {/* Charts Row 1: Topic Performance & Confidence distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Topic Performance Bar Chart */}
            <GlassCard className="lg:col-span-2 border border-white/5 p-6">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
                <Compass className="w-4 h-4 text-indigo-400" />
                <span>Class Performance by Topic</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.topicPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="topic" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
                      labelClassName="text-white font-bold"
                    />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="accuracy" name="Accuracy (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="confidence" name="Confidence (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Confidence distribution Pie Chart */}
            <GlassCard className="border border-white/5 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span>Confidence Distribution</span>
                </h3>
                <div className="h-48 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.confidenceDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {charts.confidenceDistribution.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex justify-center space-x-4 text-xs font-semibold mt-4">
                {charts.confidenceDistribution.map((entry, index) => (
                  <div key={entry.name} className="flex items-center space-x-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="text-gray-400">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Row 2: Rankings and Most Missed Questions */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Leaderboard Rankings */}
            <GlassCard className="lg:col-span-3 border border-white/5 p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2 flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-indigo-400" />
                <span>Student Rankings</span>
              </h3>
              <div className="max-h-80 overflow-y-auto pr-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-gray-500 uppercase font-extrabold tracking-wider border-b border-white/5">
                      <th className="py-2.5">Rank</th>
                      <th className="py-2.5">Student</th>
                      <th className="py-2.5 text-center">Accuracy</th>
                      <th className="py-2.5 text-center">Quizzes</th>
                      <th className="py-2.5 text-right">Confidence Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-semibold text-gray-300">
                    {stats.playerRankings.map((player, idx) => {
                      const isAtRisk = player.accuracy < 50;
                      return (
                        <tr key={player.name} className={`hover:bg-white/2 ${isAtRisk ? 'bg-red-500/5' : ''}`}>
                          <td className="py-3 font-mono font-bold text-gray-500">{idx + 1}</td>
                          <td className="py-3 text-white flex items-center space-x-1.5">
                            <span>{player.name}</span>
                            {isAtRisk && (
                              <span title="At-risk (<50% accuracy)">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              </span>
                            )}
                          </td>
                          <td className={`py-3 text-center font-mono ${isAtRisk ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                            {player.accuracy}%
                          </td>
                          <td className="py-3 text-center">{player.quizzesPlayed}</td>
                          <td className="py-3 text-right font-black font-mono text-indigo-400">{player.score}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            {/* Most Missed Questions */}
            <GlassCard className="lg:col-span-2 border border-white/5 p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/5 pb-2 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>Most Missed Questions</span>
              </h3>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {stats.mostMissedQuestions.length === 0 ? (
                  <p className="text-xs text-gray-500 italic text-center py-6">No questions reported missed</p>
                ) : (
                  stats.mostMissedQuestions.map((q, idx) => (
                    <div key={idx} className="bg-white/2 p-3 rounded-lg border border-white/5 space-y-2">
                      <p className="text-xs text-white font-bold line-clamp-2 leading-relaxed">
                        {q.questionText}
                      </p>
                      <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase">
                        <span>Topic: {q.topic}</span>
                        <span className="text-red-400 font-black">
                          {q.missedCount} / {q.totalAttempts} Misses ({q.accuracy}% Acc)
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>

          {/* Difficulty distribution chart */}
          <GlassCard className="border border-white/5 p-6">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
              <Flame className="w-4.5 h-4.5 text-purple-400 animate-pulse" />
              <span>Served Questions Difficulty Distribution</span>
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.difficultyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
                  />
                  <Bar dataKey="value" name="Questions Count" fill="#a855f7" radius={[4, 4, 0, 0]}>
                    {stats.difficultyDistribution.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* AI Usage Statistics Dashboard */}
          {aiStats && aiStats.stats && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Stats Cards */}
              <GlassCard className="lg:col-span-1 border border-white/5 p-6 space-y-4">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
                  <BrainCircuit className="w-4 h-4 text-indigo-400" />
                  <span>AI Automation Summary</span>
                </h3>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center p-3 bg-white/2 border border-white/5 rounded-xl">
                    <span className="text-xs font-semibold text-gray-300">Questions Generated</span>
                    <span className="text-sm font-black text-indigo-400 font-mono">{aiStats.stats.questionsGenerated}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/2 border border-white/5 rounded-xl">
                    <span className="text-xs font-semibold text-gray-300">Quizzes Generated</span>
                    <span className="text-sm font-black text-purple-400 font-mono">{aiStats.stats.quizzesGenerated}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/2 border border-white/5 rounded-xl">
                    <span className="text-xs font-semibold text-gray-300">Practice Sets Created</span>
                    <span className="text-sm font-black text-pink-400 font-mono">{aiStats.stats.practiceSetsGenerated}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/2 border border-white/5 rounded-xl">
                    <span className="text-xs font-semibold text-gray-300">Files Processed (PDF/Img)</span>
                    <span className="text-sm font-black text-emerald-400 font-mono font-bold">
                      {aiStats.stats.pdfProcessed + aiStats.stats.imageProcessed}
                    </span>
                  </div>
                </div>
              </GlassCard>

              {/* Recent AI logs */}
              <GlassCard className="lg:col-span-2 border border-white/5 p-6 space-y-4">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span>Recent AI Generation Logs</span>
                </h3>

                <div className="max-h-64 overflow-y-auto pr-1 space-y-2.5">
                  {aiStats.recentActivity && aiStats.recentActivity.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-6 text-center">No AI usage logged yet</p>
                  ) : (
                    aiStats.recentActivity.map((log: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-3 bg-white/2 rounded-xl border border-white/5 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-white capitalize">
                            {log.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            By {log.userId?.name || 'Unknown User'} • {new Date(log.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 font-mono font-bold text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                          +{log.count} item{log.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
            </div>
          )}
        </>
    )}
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

export default AdminAnalytics;
