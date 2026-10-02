import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  exportStudentReportCSV,
  exportStudentReportPDF,
  type StudentReportData
} from '../utils/reportExport';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import {
  ArrowLeft,
  Award,
  TrendingUp,
  BrainCircuit,
  Compass,
  CheckCircle,
  HelpCircle,
  FileSpreadsheet,
  FileDown,
  Users
} from 'lucide-react';

interface Stats {
  overallAccuracy: number;
  averageConfidence: number;
  confidenceAccuracyIndex: number;
  adaptiveScore: number;
  currentDifficulty: string;
}

interface TopicMastery {
  topic: string;
  accuracy: number;
  averageConfidence: number;
  status: 'Mastered' | 'Needs Improvement' | 'Weak Area';
  totalQuestions: number;
}

interface ChartsData {
  accuracyByTopic: Array<{ topic: string; accuracy: number }>;
  confidenceByTopic: Array<{ topic: string; confidence: number }>;
  difficultyProgression: Array<{ name: string; level: number; difficulty: string }>;
  timeTakenTrend: Array<{ name: string; time: number; topic: string }>;
}

interface BehaviorData {
  quizFrequency: number;
  avgSessionLength: number;
  engagementScore: number;
  preferredTopics: Array<{ topic: string; count: number }>;
  confidenceTrend: string;
  studyStreak: number;
  activeHours: Array<{ hour: number; count: number }>;
  behaviorProfile: string;
  totalAttempts: number;
  recentAttempts: number;
  uniqueDaysActive: number;
}

interface BenchmarkData {
  myAvgScore: number;
  classAvgScore: number;
  top10AvgScore: number;
  percentileRank: number;
  totalStudents: number;
  topicComparison: Array<{ topic: string; myAccuracy: number; classAccuracy: number }>;
  performanceGap: number;
}

interface InsightCard {
  type: 'success' | 'warning' | 'info' | 'critical';
  title: string;
  message: string;
  icon?: string;
  priority?: number;
}

const StudentAnalytics: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  const [stats, setStats] = useState<Stats>({
    overallAccuracy: 0,
    averageConfidence: 0,
    confidenceAccuracyIndex: 0,
    adaptiveScore: 0,
    currentDifficulty: 'medium',
  });

  const [topicMastery, setTopicMastery] = useState<TopicMastery[]>([]);
  const [charts, setCharts] = useState<ChartsData>({
    accuracyByTopic: [],
    confidenceByTopic: [],
    difficultyProgression: [],
    timeTakenTrend: [],
  });

  const [behavior, setBehavior] = useState<BehaviorData | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);

  const radarData = topicMastery.slice(0, 8).map((r) => ({
    topic: r.topic.length > 12 ? r.topic.substring(0, 12) + '…' : r.topic,
    accuracy: r.accuracy,
  }));

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;
      try {
        const [studentRes, behaviorRes, insightsRes, benchmarkRes] = await Promise.all([
          API.get(`/analytics/student/${user._id}`),
          API.get(`/analytics/behavior/${user._id}`).catch(() => ({ data: { success: false } })),
          API.get(`/analytics/insights/${user._id}`).catch(() => ({ data: { success: false } })),
          API.get(`/analytics/benchmark/${user._id}`).catch(() => ({ data: { success: false } })),
        ]);

        if (studentRes.data.hasData) {
          setStats(studentRes.data.stats);
          setTopicMastery(studentRes.data.topicMastery);
          setCharts(studentRes.data.charts);
          setHasData(true);
        } else {
          setHasData(false);
        }

        if (behaviorRes.data.success) {
          setBehavior(behaviorRes.data.behavior);
        }
        if (insightsRes.data.success) {
          setInsights(insightsRes.data.insights || []);
          setProfile(insightsRes.data.profile);
        }
        if (benchmarkRes.data.success) {
          setBenchmark(benchmarkRes.data.benchmark);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading analytics metrics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [user]);

  const handleExportCSV = () => {
    if (!user) return;
    const reportData: StudentReportData = {
      studentName: user.name,
      studentEmail: user.email,
      overallAccuracy: stats.overallAccuracy,
      averageConfidence: stats.averageConfidence,
      confidenceAccuracyIndex: stats.confidenceAccuracyIndex,
      adaptiveScore: stats.adaptiveScore,
      currentDifficulty: stats.currentDifficulty,
      topicMastery: topicMastery,
    };
    exportStudentReportCSV(reportData);
  };

  const handleExportPDF = () => {
    if (!user) return;
    exportStudentReportPDF(user._id, setPdfStatus);
  };

  const getStudentSegment = () => {
    if (!profile) return 'Consistent Learner';
    const attemptsCount = profile.totalAttempts || 0;
    const avgAccuracy = profile.overallAccuracy || 0;
    const avgConfidence = profile.avgConfidence || 0;
    const velocity = profile.learningVelocity || 0;
    const trend = profile.accuracyTrend || [];
    
    const scores = trend.map((t: any) => t.accuracy);
    let consistency = 70;
    if (scores.length >= 2) {
      const mean = scores.reduce((s: number, v: number) => s + v, 0) / scores.length;
      const variance = scores.reduce((s: number, v: number) => s + Math.pow(v - mean, 2), 0) / scores.length;
      consistency = Math.max(0, Math.round(100 - variance));
    }

    if (avgAccuracy >= 82 && consistency >= 70) return 'High Performer';
    if (velocity >= 12 && attemptsCount >= 3) return 'Fast Improver';
    if (avgAccuracy < 50 || (velocity < -5 && attemptsCount >= 3)) return 'At-Risk Student';
    if (avgConfidence < 35 && avgAccuracy >= 55) return 'Low Confidence Learner';
    return 'Consistent Learner';
  };

  const segment = getStudentSegment();

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-300">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <span>Student Analytics Dashboard</span>
            <BrainCircuit className="w-6 h-6 text-indigo-400 animate-pulse" />
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider
              ${segment === 'High Performer' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                segment === 'Fast Improver' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                segment === 'At-Risk Student' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                segment === 'Low Confidence Learner' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
              Segment: {segment}
            </span>
            {behavior?.behaviorProfile && (
              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider
                ${behavior.behaviorProfile === 'Dedicated Student' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  behavior.behaviorProfile === 'Consistent Practitioner' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                  behavior.behaviorProfile === 'Occasional Visitor' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                  behavior.behaviorProfile === 'Disengaged' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                  'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                Profile: {behavior.behaviorProfile}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-2 font-medium">
            Detailed view of your knowledge mastery, metacognition accuracy, and difficulty progression.
          </p>
        </div>

        {hasData && (
          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white rounded-xl transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/10 transition-all"
            >
              <FileDown className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {!hasData ? (
        <GlassCard className="border border-white/5 py-24 text-center text-gray-500">
          <Award className="w-16 h-16 text-indigo-400 mx-auto mb-4 opacity-50" />
          <p className="font-bold text-lg text-white">No evaluation data available</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Complete at least one standard or adaptive quiz to view detailed analytics profiles and topic mastery records.
          </p>
        </GlassCard>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <GlassCard className="border border-white/5 p-4 text-center">
              <span className="block text-2xl font-black text-indigo-400 font-mono">
                {stats.overallAccuracy}%
              </span>
              <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                Overall Accuracy
              </span>
            </GlassCard>

            <GlassCard className="border border-white/5 p-4 text-center">
              <span className="block text-2xl font-black text-emerald-400 font-mono">
                {stats.averageConfidence}%
              </span>
              <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                Avg Confidence
              </span>
            </GlassCard>

            <GlassCard className="border border-white/5 p-4 text-center">
              <span className="block text-2xl font-black text-purple-400 font-mono">
                {stats.confidenceAccuracyIndex}%
              </span>
              <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                Confidence Accuracy
              </span>
            </GlassCard>

            <GlassCard className="border border-white/5 p-4 text-center">
              <span className="block text-2xl font-black text-amber-400 font-mono">
                {stats.adaptiveScore}
              </span>
              <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                Adaptive Score
              </span>
            </GlassCard>

            <GlassCard className="border border-white/5 p-4 text-center col-span-2 md:col-span-1">
              <span className="block text-2xl font-black text-pink-400 font-mono uppercase">
                {stats.currentDifficulty}
              </span>
              <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1.5 block tracking-wider">
                Current difficulty
              </span>
            </GlassCard>
          </div>

          {/* AI Insights & Predictions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Insight Cards */}
            <GlassCard className="border border-white/5 p-6 lg:col-span-2 space-y-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
                <BrainCircuit className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span>AI Tutor Insights & Recommendations</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {insights.length === 0 ? (
                  <div className="col-span-2 text-center py-12 text-xs text-gray-500 italic">
                    Complete more attempts to unlock AI recommendations and learning insights.
                  </div>
                ) : (
                  insights.map((insight, idx) => {
                    const isSuccess = insight.type === 'success';
                    const isWarning = insight.type === 'warning' || insight.type === 'critical';
                    const colorClass = isSuccess 
                      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' 
                      : isWarning
                        ? 'border-red-500/20 bg-red-500/5 text-red-400'
                        : 'border-blue-500/20 bg-blue-500/5 text-blue-400';
                    
                    return (
                      <div key={idx} className={`p-4 rounded-xl border ${colorClass} space-y-2`}>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded">
                            {insight.type}
                          </span>
                          <span className="text-sm font-bold text-white truncate">{insight.title}</span>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">{insight.message}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>

            {/* Predictive Learning Outlook */}
            <GlassCard className="border border-white/5 p-6 space-y-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span>Predictive Learning Outlook</span>
              </h3>
              
              <div className="space-y-4">
                {/* Readiness Score */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-medium">Exam Readiness Score</span>
                    <span className="text-indigo-400 font-bold font-mono">{profile?.readinessScore || 0}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${profile?.readinessScore || 0}%` }}
                    />
                  </div>
                </div>

                {/* Learning Velocity */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-xs text-gray-400 font-medium">Learning Velocity</span>
                  <span className={`text-xs font-black font-mono ${(profile?.learningVelocity || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(profile?.learningVelocity || 0) >= 0 ? `+${profile?.learningVelocity || 0}` : profile?.learningVelocity} pts / attempt
                  </span>
                </div>

                {/* Predicted Score */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-xs text-gray-400 font-medium">Predicted Exam Score</span>
                  <span className="text-xs font-black font-mono text-purple-400">
                    {profile?.prediction?.predictedScore ? `${profile?.prediction.predictedScore}%` : 'N/A'}
                  </span>
                </div>

                {/* Predicted Difficulty */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-xs text-gray-400 font-medium">Target Readiness Level</span>
                  <span className="text-xs font-black font-mono text-pink-400 uppercase">
                    {profile?.prediction?.readinessLevel || 'Developing'}
                  </span>
                </div>

                {/* Study Streak */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">Consecutive Day Streak</span>
                  <span className="text-xs font-black font-mono text-amber-400">
                    {behavior?.studyStreak || 0} days
                  </span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Benchmarking Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bar chart comparison */}
            <GlassCard className="border border-white/5 p-6 lg:col-span-2">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Overall Score Comparison</span>
              </h3>
              
              <div className="h-60">
                {benchmark ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'My Average', score: benchmark.myAvgScore },
                        { name: 'Class Average', score: benchmark.classAvgScore },
                        { name: 'Top 10% Average', score: benchmark.top10AvgScore }
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
                        formatter={(value: any) => [`${value}%`, 'Score']}
                      />
                      <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                        {[0, 1, 2].map((_entry, index) => {
                          const colors = ['#6366f1', '#4b5563', '#10b981'];
                          return <Cell key={`cell-${index}`} fill={colors[index]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-gray-500 italic">
                    No comparison data available
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Performance gap KPI card / stats */}
            <GlassCard className="border border-white/5 p-6 flex flex-col justify-between">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Benchmarking Insights</span>
              </h3>

              {benchmark ? (
                <div className="space-y-4 my-auto">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Percentile Rank</span>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-4xl font-black text-indigo-400 font-mono">{benchmark.percentileRank}th</span>
                      <span className="text-xs text-gray-400 font-medium">percentile</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      You scored higher than {benchmark.percentileRank}% of {benchmark.totalStudents} total students.
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Performance Gap</span>
                    <div className="flex items-baseline space-x-1.5">
                      <span className={`text-4xl font-black font-mono ${benchmark.performanceGap >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {benchmark.performanceGap >= 0 ? `+${benchmark.performanceGap}` : benchmark.performanceGap}%
                      </span>
                      <span className="text-xs text-gray-400 font-medium">vs class average</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {benchmark.performanceGap >= 0 
                        ? "You are performing ahead of the class average. Keep it up!" 
                        : "You are currently trailing the class average. Focus on weak topics."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-gray-500 italic">
                  No comparison data available
                </div>
              )}
              
              <div className="text-[9px] text-gray-600 border-t border-white/5 pt-3">
                Comparative analysis is updated dynamically based on peer attempts.
              </div>
            </GlassCard>
          </div>

          {/* Charts Row 1: Skill Profile (Radar Chart), Strengths & Confidence */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Radar Chart */}
            <GlassCard className="border border-white/5 p-6">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
                <BrainCircuit className="w-4 h-4 text-purple-400" />
                <span>Skill Mastery Profile</span>
              </h3>
              <div className="h-64 flex items-center justify-center">
                {radarData.length === 0 ? (
                  <span className="text-xs text-gray-500 italic">No topic data logged yet</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.05)" />
                      <PolarAngleAxis dataKey="topic" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Accuracy"
                        dataKey="accuracy"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.25}
                        dot={{ fill: '#8b5cf6', r: 3 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: 'rgba(255,255,255,0.1)',
                          color: '#fff',
                        }}
                        formatter={(v: any) => [`${v}%`, 'Accuracy']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </GlassCard>

            <GlassCard className="border border-white/5 p-6">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-indigo-400" />
                <span>Accuracy by Topic</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.accuracyByTopic}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="topic" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
                      labelClassName="text-white font-bold"
                    />
                    <Bar dataKey="accuracy" name="Accuracy (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="border border-white/5 p-6">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                <span>Confidence level by Topic</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.confidenceByTopic}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="topic" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
                      labelClassName="text-white font-bold"
                    />
                    <Bar dataKey="confidence" name="Confidence (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          {/* Charts Row 2: Difficulty progression and response duration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard className="border border-white/5 p-6">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
                <Compass className="w-4 h-4 text-purple-400" />
                <span>Adaptive Difficulty Progression (Last 20 questions)</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.difficultyProgression}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis
                      ticks={[1, 2, 3, 4]}
                      tickFormatter={(value) => {
                        if (value === 1) return 'Easy';
                        if (value === 2) return 'Med';
                        if (value === 3) return 'Hard';
                        if (value === 4) return 'Expert';
                        return '';
                      }}
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
                      formatter={(_value, _name, props) => [props.payload.difficulty.toUpperCase(), 'Tier']}
                    />
                    <Line type="monotone" dataKey="level" stroke="#a855f7" strokeWidth={3} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="border border-white/5 p-6">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-pink-400" />
                <span>Time Taken Trend (Last 20 questions)</span>
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.timeTakenTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)' }}
                      formatter={(value) => [`${value} seconds`, 'Duration']}
                    />
                    <Area type="monotone" dataKey="time" name="Duration (s)" stroke="#ec4899" fill="rgba(236,72,153,0.1)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          {/* Topic Mastery Lists */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
              <Award className="w-5 h-5 text-indigo-400" />
              <span>Topic Mastery Status</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Mastered */}
              <GlassCard className="border border-emerald-500/20 p-5 space-y-4 bg-emerald-500/1">
                <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
                  <h4 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider">
                    Mastered (&ge;85%)
                  </h4>
                  <span className="text-xs bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-400 font-bold">
                    {topicMastery.filter(t => t.status === 'Mastered').length}
                  </span>
                </div>
                <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                  {topicMastery.filter(t => t.status === 'Mastered').length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2 text-center">No topics mastered yet</p>
                  ) : (
                    topicMastery.filter(t => t.status === 'Mastered').map(t => (
                      <div key={t.topic} className="flex justify-between items-center bg-white/2 p-2.5 rounded-lg border border-white/5">
                        <span className="text-xs text-white font-bold">{t.topic}</span>
                        <div className="text-right">
                          <span className="text-xs text-emerald-400 font-black font-mono">{t.accuracy}%</span>
                          <span className="text-[9px] text-gray-500 block">({t.totalQuestions} questions)</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>

              {/* Needs Improvement */}
              <GlassCard className="border border-amber-500/20 p-5 space-y-4 bg-amber-500/1">
                <div className="flex items-center justify-between border-b border-amber-500/10 pb-2">
                  <h4 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider">
                    Needs Improvement (50-84%)
                  </h4>
                  <span className="text-xs bg-amber-500/10 px-2 py-0.5 rounded text-amber-400 font-bold">
                    {topicMastery.filter(t => t.status === 'Needs Improvement').length}
                  </span>
                </div>
                <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                  {topicMastery.filter(t => t.status === 'Needs Improvement').length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2 text-center">No topics in review</p>
                  ) : (
                    topicMastery.filter(t => t.status === 'Needs Improvement').map(t => (
                      <div key={t.topic} className="flex justify-between items-center bg-white/2 p-2.5 rounded-lg border border-white/5">
                        <span className="text-xs text-white font-bold">{t.topic}</span>
                        <div className="text-right">
                          <span className="text-xs text-amber-400 font-black font-mono">{t.accuracy}%</span>
                          <span className="text-[9px] text-gray-500 block">({t.totalQuestions} questions)</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>

              {/* Weak Area */}
              <GlassCard className="border border-red-500/20 p-5 space-y-4 bg-red-500/1">
                <div className="flex items-center justify-between border-b border-red-500/10 pb-2">
                  <h4 className="text-sm font-extrabold text-red-400 uppercase tracking-wider">
                    Weak Area (&lt;50%)
                  </h4>
                  <span className="text-xs bg-red-500/10 px-2 py-0.5 rounded text-red-400 font-bold">
                    {topicMastery.filter(t => t.status === 'Weak Area').length}
                  </span>
                </div>
                <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                  {topicMastery.filter(t => t.status === 'Weak Area').length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2 text-center">No weak topics logged</p>
                  ) : (
                    topicMastery.filter(t => t.status === 'Weak Area').map(t => (
                      <div key={t.topic} className="flex justify-between items-center bg-white/2 p-2.5 rounded-lg border border-white/5">
                        <span className="text-xs text-white font-bold">{t.topic}</span>
                        <div className="text-right">
                          <span className="text-xs text-red-400 font-black font-mono">{t.accuracy}%</span>
                          <span className="text-[9px] text-gray-500 block">({t.totalQuestions} questions)</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
            </div>
          </div>
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

export default StudentAnalytics;
