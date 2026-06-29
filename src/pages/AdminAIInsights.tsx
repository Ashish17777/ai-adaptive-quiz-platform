import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import {
  ArrowLeft,
  BrainCircuit,
  Users,
  Award,
  AlertTriangle,
  Sparkles,
  BookOpen,
  TrendingUp,
  Gauge
} from 'lucide-react';

interface HeatmapData {
  topics: string[];
  users: string[];
  data: Record<string, Record<string, number>>;
}

interface ClassTopicPerf {
  topic: string;
  avgAccuracy: number;
  studentCount: number;
}

interface AtRiskStudent {
  name: string;
  avgAccuracy: number;
}

interface AdminAIInsightsData {
  heatmap: HeatmapData;
  classTopicPerformance: ClassTopicPerf[];
  mostDifficultTopics: ClassTopicPerf[];
  atRiskStudents: AtRiskStudent[];
  classAvgConfidence: number;
  classSummary: string;
  totalStudents: number;
}

const AdminAIInsights: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<AdminAIInsightsData | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await API.get('/ai/admin-insights');
        setInsights(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading AI Administrator Insights');
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  if (loading) return <LoadingSpinner fullPage />;

  if (error || !insights) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <GlassCard className="border border-red-500/20 p-6 text-center text-red-400">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold">Failed to load AI Insights</h3>
          <p className="text-sm mt-1">{error || 'An unexpected error occurred.'}</p>
        </GlassCard>
      </div>
    );
  }

  const BAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981'];

  // Helper to color accuracy values
  const getAccuracyColorClass = (val: number | undefined) => {
    if (val === undefined) return 'text-gray-500 bg-white/2 border-white/5';
    if (val >= 85) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (val >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

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
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              AI Classroom Insights
            </span>
            <BrainCircuit className="w-7 h-7 text-indigo-400 animate-pulse" />
          </h2>
          <p className="text-gray-400 text-sm mt-1.5 font-medium">
            AI-driven topic mastery matrices, metacognitive accuracy, and student intervention indicators.
          </p>
        </div>
      </div>

      {/* Summary Narrative Banner */}
      <GlassCard className="border-indigo-500/20 bg-indigo-950/20 relative overflow-hidden p-6">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Sparkles className="w-24 h-24 text-white" />
        </div>
        <div className="flex items-start space-x-4">
          <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1.5">AI Cohort Analysis</h3>
            <p className="text-gray-300 text-sm leading-relaxed font-medium">
              {insights.classSummary.replace(/\*\*(.*?)\*\*/g, '$1')}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="border-white/5 p-5 text-center flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-2 right-2 text-indigo-500/20">
            <Users className="w-12 h-12" />
          </div>
          <span className="block text-3xl font-black text-indigo-400 font-mono">
            {insights.totalStudents}
          </span>
          <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
            Cohort Population
          </span>
        </GlassCard>

        <GlassCard className="border-white/5 p-5 text-center flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-2 right-2 text-purple-500/20">
            <Gauge className="w-12 h-12" />
          </div>
          <span className="block text-3xl font-black text-purple-400 font-mono">
            {insights.classAvgConfidence}%
          </span>
          <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
            Cohort Metacognitive Accuracy
          </span>
        </GlassCard>

        <GlassCard className="border-white/5 p-5 text-center flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-2 right-2 text-rose-500/20">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <span className="block text-3xl font-black text-rose-400 font-mono">
            {insights.atRiskStudents.length}
          </span>
          <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
            At-Risk Students (&lt;50% accuracy)
          </span>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Class Topic Performance Chart */}
        <GlassCard className="border-white/5 p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Class-wide Topic Mastery</h3>
            </div>
            <span className="text-xs text-gray-400 bg-white/5 px-2.5 py-1 rounded-full font-medium">
              Average Accuracy %
            </span>
          </div>

          <div className="h-80 w-full">
            {insights.classTopicPerformance.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                No topic data logged yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={insights.classTopicPerformance}
                  margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="topic"
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(v) => [`${v}%`, 'Avg Accuracy']}
                  />
                  <Bar dataKey="avgAccuracy" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40}>
                    {insights.classTopicPerformance.map((_entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassCard>

        {/* At-Risk Intervention List */}
        <GlassCard className="border-white/5 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
              <h3 className="text-lg font-bold text-white">Student Interventions</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-medium">
              Students identified by AI below 50% cumulative accuracy across completed topics.
            </p>

            <div className="space-y-3 pt-2">
              {insights.atRiskStudents.length === 0 ? (
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl text-center text-emerald-400 text-sm">
                  <Award className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="font-bold">All Clear!</p>
                  <p className="text-xs text-emerald-500/70 mt-0.5">No students are currently flagged for intervention.</p>
                </div>
              ) : (
                insights.atRiskStudents.map((student, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 bg-white/3 border border-white/5 rounded-xl hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center font-bold text-xs text-rose-400 border border-rose-500/20">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-white">{student.name}</span>
                    </div>
                    <span className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
                      {student.avgAccuracy}% Acc
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {insights.atRiskStudents.length > 0 && (
            <div className="pt-4 mt-4 border-t border-white/5 text-[10px] text-gray-500 text-center font-medium">
              Recommend assigning targeted practice sets to flagged students.
            </div>
          )}
        </GlassCard>
      </div>

      {/* Cohort Topic Mastery Heatmap */}
      <GlassCard className="border-white/5 p-6 space-y-4">
        <div className="flex items-center space-x-2.5">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold text-white">Cohort Topic Mastery Grid</h3>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed font-medium">
          A granular view of student scores by topic. Colors indicate mastery level:
          <span className="inline-flex items-center mx-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Mastered (≥85%)</span>
          <span className="inline-flex items-center mx-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Intermediate (60-84%)</span>
          <span className="inline-flex items-center mx-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Weak (&lt;60%)</span>
        </p>

        {insights.heatmap.topics.length === 0 || insights.heatmap.users.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No student attempts recorded for topics yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/2 border-b border-white/5">
                  <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Topic</th>
                  {insights.heatmap.users.map((user, idx) => (
                    <th
                      key={idx}
                      className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center min-w-[120px]"
                    >
                      {user}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {insights.heatmap.topics.map((topic, tIdx) => (
                  <tr key={tIdx} className="hover:bg-white/2 transition-colors">
                    <td className="p-4 text-sm font-semibold text-white capitalize">{topic}</td>
                    {insights.heatmap.users.map((user, uIdx) => {
                      const accuracy = insights.heatmap.data[topic]?.[user];
                      return (
                        <td key={uIdx} className="p-4 text-center">
                          <span
                            className={`inline-block w-14 py-1.5 text-xs font-bold rounded-lg border text-center font-mono ${getAccuracyColorClass(
                              accuracy
                            )}`}
                          >
                            {accuracy !== undefined ? `${accuracy}%` : '—'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default AdminAIInsights;
