import React, { useState, useEffect, useCallback } from 'react';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Line, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  BrainCircuit, BarChart3, Users, BookOpen, GraduationCap, Activity,
  TrendingUp, AlertTriangle, CheckCircle, Star,
  Award, RefreshCw, Download, ChevronDown, ChevronUp, Info,
  HelpCircle, Globe, Trophy,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'questions' | 'quizzes' | 'segments' | 'institutional' | 'aimonitoring';

const SEGMENT_COLORS: Record<string, string> = {
  'High Performer': '#10b981',
  'Fast Improver': '#6366f1',
  'Consistent Learner': '#3b82f6',
  'Low Confidence Learner': '#f59e0b',
  'At-Risk Student': '#ef4444',
};

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981', B: '#6366f1', C: '#f59e0b', D: '#f97316', F: '#ef4444',
};

const INSIGHT_COLORS: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  success: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle },
  warning: { bg: 'bg-amber-500/8', border: 'border-amber-500/20', text: 'text-amber-400', icon: AlertTriangle },
  info: { bg: 'bg-indigo-500/8', border: 'border-indigo-500/20', text: 'text-indigo-400', icon: Info },
};

const PIE_COLORS = ['#10b981', '#6366f1', '#3b82f6', '#f59e0b', '#ef4444'];

// ─── Component ────────────────────────────────────────────────────────────────
const AdminIntelligenceDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Logs states
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsFilter, setLogsFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // AI Health state
  const [aiHealth, setAiHealth] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Data states
  const [institutional, setInstitutional] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionSummary, setQuestionSummary] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [segmentation, setSegmentation] = useState<any>(null);

  // UI states
  const [qSort, setQSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'totalAttempts', dir: 'desc' });
  const [qFilter, setQFilter] = useState<string>('ALL');
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [quizSort, setQuizSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'effectivenessScore', dir: 'desc' });

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [instRes, qRes, quizRes, segRes] = await Promise.all([
        API.get('/analytics/institutional'),
        API.get('/analytics/question-quality'),
        API.get('/analytics/quiz-effectiveness'),
        API.get('/analytics/segmentation'),
      ]);
      if (instRes.data.success) setInstitutional(instRes.data);
      if (qRes.data.success) { setQuestions(qRes.data.metrics || []); setQuestionSummary(qRes.data.summary); }
      if (quizRes.data.success) setQuizzes(quizRes.data.quizzes || []);
      if (segRes.data.success) setSegmentation(segRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    setLoadingHealth(true);
    try {
      const [logsRes, healthRes] = await Promise.all([
        API.get('/ai/logs'),
        API.get('/ai/health')
      ]);
      if (logsRes.data.success) {
        setAiLogs(logsRes.data.logs || []);
      }
      if (healthRes.data.success) {
        setAiHealth(healthRes.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch AI logs or health:', err);
    } finally {
      setLoadingLogs(false);
      setLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (activeTab === 'aimonitoring') {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
    if (activeTab === 'aimonitoring') {
      fetchLogs();
    }
  };

  const exportQuestionsCSV = () => {
    let csv = 'Question Quality Analytics Report\n';
    csv += 'Generated: ' + new Date().toLocaleDateString() + '\n\n';
    csv += 'Question,Topic,Difficulty,Correct Rate (%),Discrimination Index (%),Avg Time Taken (s),Confidence Score (%),Total Attempts,Flag\n';
    
    sortedQuestions.forEach((q) => {
      csv += `"${q.questionText.replace(/"/g, '""')}",`;
      csv += `"${q.topic}",`;
      csv += `"${q.difficulty || 'medium'}",`;
      csv += `${q.correctRate},`;
      csv += `${q.discriminationIndex},`;
      csv += `${q.avgTimeTaken},`;
      csv += `${q.confidenceScore || 0},`;
      csv += `${q.totalAttempts},`;
      csv += `"${q.flag || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `question_quality_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportQuizzesCSV = () => {
    let csv = 'Quiz Effectiveness Analytics Report\n';
    csv += 'Generated: ' + new Date().toLocaleDateString() + '\n\n';
    csv += 'Quiz Title,Topic,Adaptive,Total Attempts,Completed Attempts,Completion Rate (%),Avg Score (%),Avg Confidence (%),Learning Impact (%),Effectiveness Score (%),Grade\n';
    
    sortedQuizzes.forEach((quiz) => {
      csv += `"${quiz.title.replace(/"/g, '""')}",`;
      csv += `"${quiz.topic || 'General'}",`;
      csv += `${quiz.isAdaptive ? 'Yes' : 'No'},`;
      csv += `${quiz.totalAttempts},`;
      csv += `${quiz.completedAttempts},`;
      csv += `${quiz.completionRate},`;
      csv += `${quiz.avgScore},`;
      csv += `${quiz.avgConfidence},`;
      csv += `${quiz.learningImpact},`;
      csv += `${quiz.effectivenessScore},`;
      csv += `"${quiz.grade}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `quiz_effectiveness_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <LoadingSpinner fullPage />;

  // ── Derived / computed ────────────────────────────────────────────────────
  const sortedQuestions = [...questions]
    .filter((q) => qFilter === 'ALL' || q.flag === qFilter || (qFilter === 'Good' && !q.flag))
    .sort((a, b) => {
      const av = (a as any)[qSort.key] ?? 0;
      const bv = (b as any)[qSort.key] ?? 0;
      return qSort.dir === 'desc' ? bv - av : av - bv;
    });

  const sortedQuizzes = [...quizzes].sort((a, b) => {
    const av = (a as any)[quizSort.key] ?? 0;
    const bv = (b as any)[quizSort.key] ?? 0;
    return quizSort.dir === 'desc' ? bv - av : av - bv;
  });

  const segmentPieData = segmentation?.summary
    ? Object.entries(segmentation.summary).map(([name, value]) => ({ name, value: value as number }))
    : [];

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'questions', label: 'Question Quality', icon: BookOpen },
    { id: 'quizzes', label: 'Quiz Effectiveness', icon: GraduationCap },
    { id: 'segments', label: 'Student Segments', icon: Users },
    { id: 'institutional', label: 'Institutional', icon: Globe },
    { id: 'aimonitoring', label: 'AI Monitoring', icon: BrainCircuit },
  ];

  const QSort = ({ k, label }: { k: string; label: string }) => (
    <button
      onClick={() => setQSort((s) => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }))}
      className="flex items-center space-x-1 hover:text-white transition-colors"
    >
      <span>{label}</span>
      {qSort.key === k ? (qSort.dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <BrainCircuit className="w-7 h-7 text-indigo-400" />
            </div>
            <span>Educational Intelligence</span>
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1 ml-12">
            Advanced analytics, question quality, student segmentation, and institutional insights.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-300 hover:bg-white/5 disabled:opacity-50 transition-all self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* ─── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: institutional?.summary?.totalStudents || 0, icon: Users, color: 'indigo' },
          { label: 'Total Attempts', value: institutional?.summary?.totalAttempts || 0, icon: Activity, color: 'blue' },
          { label: 'Avg Score', value: `${institutional?.summary?.avgScore || 0}%`, icon: Award, color: 'amber' },
          { label: 'Questions Analyzed', value: questionSummary?.total || 0, icon: BookOpen, color: 'emerald' },
        ].map((card, i) => (
          <GlassCard key={i} className="border border-white/5 p-4 flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl bg-${card.color}-500/10 border border-${card.color}-500/20 text-${card.color}-400 flex-shrink-0`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{card.label}</span>
              <span className={`text-2xl font-black mt-0.5 block text-${card.color}-400`}>{card.value}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ─── Tab Navigation ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 bg-white/3 border border-white/5 p-1.5 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: OVERVIEW */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* AI Insight Cards */}
          {institutional?.insights && institutional.insights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {institutional.insights.map((insight: any, i: number) => {
                const style = INSIGHT_COLORS[insight.type] || INSIGHT_COLORS.info;
                const Icon = style.icon;
                return (
                  <GlassCard key={i} className={`border ${style.border} ${style.bg} p-4 space-y-2`}>
                    <div className={`flex items-center space-x-2 ${style.text}`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs font-bold">{insight.title}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{insight.message}</p>
                  </GlassCard>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Topic Performance Bar Chart */}
            <GlassCard className="border border-white/5 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Class Topic Accuracy</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Average accuracy across all students by topic</p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={institutional?.topicInsights?.slice(0, 8) || []}
                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="topic" stroke="#6b7280" fontSize={9} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }}
                      itemStyle={{ fontSize: 11 }}
                      formatter={(v: any) => [`${v}%`, 'Accuracy']}
                    />
                    <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                      {(institutional?.topicInsights || []).slice(0, 8).map((_: any, idx: number) => (
                        <Cell
                          key={idx}
                          fill={
                            institutional.topicInsights[idx]?.accuracy >= 70 ? '#10b981'
                            : institutional.topicInsights[idx]?.accuracy >= 45 ? '#f59e0b'
                            : '#ef4444'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Student Segment Pie */}
            <GlassCard className="border border-white/5 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Student Segmentation</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Distribution across performance categories</p>
              </div>
              <div className="h-44">
                {segmentPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={segmentPieData} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" paddingAngle={3}>
                        {segmentPieData.map((entry, i) => (
                          <Cell key={i} fill={SEGMENT_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }}
                        itemStyle={{ fontSize: 11 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500">No data yet</div>
                )}
              </div>
              <div className="space-y-1.5">
                {segmentPieData.map((d, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[d.name] || PIE_COLORS[i] }} />
                      <span className="text-gray-400">{d.name}</span>
                    </div>
                    <span className="text-white font-mono font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Question Quality Summary Cards */}
          {questionSummary && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Questions', value: questionSummary.total, color: 'indigo' },
                { label: 'Too Easy', value: questionSummary.tooEasy, color: 'emerald' },
                { label: 'Too Hard', value: questionSummary.tooHard, color: 'red' },
                { label: 'Poor Quality', value: questionSummary.poorQuality, color: 'amber' },
                { label: 'Avg Discrimination', value: `${questionSummary.avgDiscrimination}%`, color: 'blue' },
              ].map((card, i) => (
                <GlassCard key={i} className="border border-white/5 p-4 text-center">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{card.label}</span>
                  <span className={`text-xl font-black mt-1 block text-${card.color}-400`}>{card.value}</span>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: QUESTION QUALITY */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          {/* Charts row */}
          <div className="grid grid-cols-1 gap-6">
            {/* Discrimination vs Correct Rate scatter */}
            <GlassCard className="border border-white/5 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Discrimination vs Difficulty</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">High discrimination + medium difficulty = ideal question quality</p>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" dataKey="correctRate" name="Correct Rate %" domain={[0, 100]} stroke="#6b7280" fontSize={10} label={{ value: 'Correct Rate %', position: 'insideBottomRight', fill: '#6b7280', fontSize: 9 }} />
                    <YAxis type="number" dataKey="discriminationIndex" name="Discrimination %" domain={[-20, 100]} stroke="#6b7280" fontSize={10} />
                    <ZAxis range={[30, 80]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }}
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ payload }) => {
                        if (!payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="bg-[#0f172a] border border-white/10 rounded-lg p-2 text-[10px] text-white max-w-[200px]">
                            <p className="font-bold truncate">{d?.questionText?.slice(0, 40)}...</p>
                            <p>Correct: {d?.correctRate}% | Disc: {d?.discriminationIndex}%</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      data={questions.slice(0, 50)}
                      fill="#6366f1"
                    >
                      {questions.slice(0, 50).map((_, i) => (
                        <Cell key={i} fill="#6366f1" />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          {/* Sortable Question Table */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Question Quality Table</h3>
                <button
                  onClick={exportQuestionsCSV}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white rounded-md transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
              <div className="flex space-x-2">
                {['ALL', 'Too Easy', 'Too Hard', 'Poor Quality', 'Good'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setQFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      qFilter === f
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                    <th className="py-3 px-3">Question</th>
                    <th className="py-3 px-3 cursor-pointer"><QSort k="topic" label="Topic" /></th>
                    <th className="py-3 px-3 cursor-pointer"><QSort k="difficulty" label="Difficulty" /></th>
                    <th className="py-3 px-3 cursor-pointer"><QSort k="correctRate" label="Correct %" /></th>
                    <th className="py-3 px-3 cursor-pointer"><QSort k="discriminationIndex" label="Disc. %" /></th>
                    <th className="py-3 px-3 cursor-pointer"><QSort k="avgTimeTaken" label="Avg Time" /></th>
                    <th className="py-3 px-3 cursor-pointer"><QSort k="confidenceScore" label="Confidence" /></th>
                    <th className="py-3 px-3 cursor-pointer"><QSort k="totalAttempts" label="Attempts" /></th>
                    <th className="py-3 px-3">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedQuestions.slice(0, 30).map((q, i) => (
                    <tr key={i} className="hover:bg-white/2 text-white transition-colors">
                      <td className="py-2.5 px-3 text-gray-300 font-medium max-w-xs">
                        <span className="block truncate" title={q.questionText}>{q.questionText}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-indigo-400 font-semibold capitalize">{q.topic}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 uppercase font-bold text-[10px]">
                        {q.difficulty || 'medium'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-14 bg-white/5 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${q.correctRate > 70 ? 'bg-emerald-500' : q.correctRate > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${q.correctRate}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold">{q.correctRate}%</span>
                        </div>
                      </td>
                      <td className={`py-2.5 px-3 font-bold font-mono ${q.discriminationIndex >= 30 ? 'text-emerald-400' : q.discriminationIndex >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                        {q.discriminationIndex}%
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 font-mono">{q.avgTimeTaken}s</td>
                      <td className="py-2.5 px-3 text-gray-300 font-mono font-bold">{q.confidenceScore !== undefined ? `${q.confidenceScore}%` : '—'}</td>
                      <td className="py-2.5 px-3 text-gray-300">{q.totalAttempts}</td>
                      <td className="py-2.5 px-3">
                        {q.flag ? (
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            q.flag === 'Too Easy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : q.flag === 'Too Hard' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>{q.flag}</span>
                        ) : (
                          <span className="text-[9px] text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedQuestions.length === 0 && (
                <div className="text-center py-12 text-xs text-gray-500">No questions match the current filter.</div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: QUIZ EFFECTIVENESS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'quizzes' && (
        <div className="space-y-6">
          {/* Effectiveness Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard className="border border-white/5 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Quiz Effectiveness Scores</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Sorted by effectiveness — composite of completion, scores, and learning impact</p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedQuizzes.slice(0, 8).map((q) => ({ name: q.title?.slice(0, 15), score: q.effectivenessScore, impact: q.learningImpact }))}
                    margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={9} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }} itemStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="score" name="Effectiveness" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="impact" name="Learning Impact" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="border border-white/5 p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Completion Rate vs Avg Score</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Quizzes with high completion and high scores are most successful</p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis type="number" dataKey="completionRate" name="Completion %" domain={[0, 100]} stroke="#6b7280" fontSize={10} />
                    <YAxis type="number" dataKey="avgScore" name="Avg Score %" domain={[0, 100]} stroke="#6b7280" fontSize={10} />
                    <ZAxis range={[40, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }}
                      content={({ payload }) => {
                        if (!payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="bg-[#0f172a] border border-white/10 rounded-lg p-2 text-[10px] text-white">
                            <p className="font-bold">{d?.title}</p>
                            <p>Completion: {d?.completionRate}% | Avg: {d?.avgScore}%</p>
                            <p>Grade: <span style={{ color: GRADE_COLORS[d?.grade] }} className="font-bold">{d?.grade}</span></p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={quizzes} fill="#6366f1">
                      {quizzes.map((q, i) => (
                        <Cell key={i} fill={GRADE_COLORS[q.grade] || '#6366f1'} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </div>

          {/* Quiz Cards */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Quiz Effectiveness Report</h3>
                <button
                  onClick={exportQuizzesCSV}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white rounded-md transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
              <div className="flex space-x-2 text-xs text-gray-400">
                <span>Sort by:</span>
                {['effectivenessScore', 'completionRate', 'avgScore', 'learningImpact'].map((k) => (
                  <button
                    key={k}
                    onClick={() => setQuizSort((s) => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }))}
                    className={`capitalize px-2 py-0.5 rounded ${quizSort.key === k ? 'text-indigo-400 font-bold' : 'text-gray-500 hover:text-white'}`}
                  >
                    {k.replace(/([A-Z])/g, ' $1').trim()}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedQuizzes.map((quiz, i) => (
                <div key={i} className="bg-white/3 border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{quiz.title}</p>
                      <p className="text-[10px] text-indigo-400 capitalize">{quiz.topic || 'General'}</p>
                    </div>
                    <div className="ml-2 flex-shrink-0 flex flex-col items-end">
                      <span className="text-2xl font-black" style={{ color: GRADE_COLORS[quiz.grade] }}>{quiz.grade}</span>
                      {quiz.isAdaptive && <span className="text-[9px] text-indigo-400 font-bold uppercase">Adaptive</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Effectiveness', value: quiz.effectivenessScore, suffix: '%', max: 100 },
                      { label: 'Completion', value: quiz.completionRate, suffix: '%', max: 100 },
                      { label: 'Avg Score', value: quiz.avgScore, suffix: '%', max: 100 },
                    ].map((m) => (
                      <div key={m.label} className="space-y-0.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-400">{m.label}</span>
                          <span className="text-white font-mono font-bold">{m.value}{m.suffix}</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded-full">
                          <div
                            className={`h-1 rounded-full ${m.value >= 70 ? 'bg-emerald-500' : m.value >= 45 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${(m.value / m.max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-[10px] pt-1 border-t border-white/5">
                    <span className="text-gray-500">{quiz.totalAttempts} attempts</span>
                    <span className={`font-bold ${quiz.learningImpact > 0 ? 'text-emerald-400' : quiz.learningImpact < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      Impact: {quiz.learningImpact > 0 ? '+' : ''}{quiz.learningImpact}%
                    </span>
                  </div>
                </div>
              ))}
              {quizzes.length === 0 && (
                <div className="col-span-3 text-center py-8 text-xs text-gray-500">No quiz data available yet.</div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: STUDENT SEGMENTS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'segments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(SEGMENT_COLORS).map(([segment, color]) => {
              const students = segmentation?.grouped?.[segment] || [];
              const isExpanded = expandedSegment === segment;
              const segmentIcons: Record<string, any> = {
                'High Performer': Trophy,
                'Fast Improver': TrendingUp,
                'Consistent Learner': CheckCircle,
                'Low Confidence Learner': HelpCircle,
                'At-Risk Student': AlertTriangle,
              };
              const Icon = segmentIcons[segment] || Star;

              return (
                <GlassCard key={segment} className="border border-white/5 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15`, color }}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">{segment}</h3>
                        <p style={{ color }} className="text-xl font-black">{students.length}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedSegment(isExpanded ? null : segment)}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {students.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase">
                        <span>Avg Accuracy</span>
                        <span>{Math.round(students.reduce((s: number, st: any) => s + st.avgAccuracy, 0) / students.length)}%</span>
                      </div>
                      <div className="w-full bg-white/5 h-1 rounded-full">
                        <div
                          className="h-1 rounded-full transition-all"
                          style={{
                            backgroundColor: color,
                            width: `${Math.round(students.reduce((s: number, st: any) => s + st.avgAccuracy, 0) / students.length)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {isExpanded && students.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-white/5 max-h-48 overflow-y-auto">
                      {students.map((st: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[10px] bg-white/3 rounded-lg px-2.5 py-1.5">
                          <div>
                            <span className="text-white font-semibold">{st.name}</span>
                            <span className="text-gray-500 ml-1">({st.totalAttempts} attempts)</span>
                          </div>
                          <span className="font-bold font-mono" style={{ color }}>{st.avgAccuracy}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>

          {/* Segment Comparison Bar */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Segment Average Accuracy Comparison</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(SEGMENT_COLORS).map(([segment, color]) => {
                    const students = segmentation?.grouped?.[segment] || [];
                    const avg = students.length > 0
                      ? Math.round(students.reduce((s: number, st: any) => s + st.avgAccuracy, 0) / students.length)
                      : 0;
                    return { segment: segment.split(' ')[0], avg, color, fill: color };
                  })}
                  margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="segment" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }} itemStyle={{ fontSize: 11 }} />
                  <Bar dataKey="avg" radius={[4, 4, 0, 0]} name="Avg Accuracy">
                    {Object.values(SEGMENT_COLORS).map((color, i) => (
                      <Cell key={i} fill={color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: INSTITUTIONAL */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'institutional' && (
        <div className="space-y-6">
          {/* Growth Trend */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Platform Growth — 6-Month Trend</span>
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Monthly quiz attempts, average scores, and unique student engagement</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={institutional?.growth || []} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <YAxis stroke="#6b7280" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }} itemStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Area type="monotone" dataKey="attempts" stroke="#6366f1" fill="url(#grad1)" strokeWidth={2} name="Attempts" />
                  <Area type="monotone" dataKey="uniqueStudents" stroke="#10b981" fill="url(#grad2)" strokeWidth={2} name="Active Students" />
                  <Line type="monotone" dataKey="avgScore" stroke="#f59e0b" strokeWidth={2} dot={false} name="Avg Score %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hardest Topics */}
            <GlassCard className="border border-white/5 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>Most Challenging Topics</span>
              </h3>
              <div className="space-y-2.5">
                {(institutional?.summary?.hardestTopics || []).map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-[10px] font-bold text-red-400 w-4">{i + 1}</span>
                      <span className="text-xs text-gray-300 capitalize">{t.topic}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-white/5 h-1.5 rounded-full">
                        <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${t.accuracy}%` }} />
                      </div>
                      <span className="text-xs font-bold text-red-400 font-mono w-8 text-right">{t.accuracy}%</span>
                    </div>
                  </div>
                ))}
                {!(institutional?.summary?.hardestTopics?.length) && (
                  <p className="text-xs text-gray-500 text-center py-4">No topic data yet.</p>
                )}
              </div>
            </GlassCard>

            {/* Easiest Topics */}
            <GlassCard className="border border-white/5 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Strongest Topics</span>
              </h3>
              <div className="space-y-2.5">
                {(institutional?.summary?.easiestTopics || []).map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-[10px] font-bold text-emerald-400 w-4">{i + 1}</span>
                      <span className="text-xs text-gray-300 capitalize">{t.topic}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-white/5 h-1.5 rounded-full">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${t.accuracy}%` }} />
                      </div>
                      <span className="text-xs font-bold text-emerald-400 font-mono w-8 text-right">{t.accuracy}%</span>
                    </div>
                  </div>
                ))}
                {!(institutional?.summary?.easiestTopics?.length) && (
                  <p className="text-xs text-gray-500 text-center py-4">No topic data yet.</p>
                )}
              </div>
            </GlassCard>
          </div>

          {/* All topics table */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Complete Topic Performance Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                    <th className="py-2.5 px-3">Topic</th>
                    <th className="py-2.5 px-3">Accuracy</th>
                    <th className="py-2.5 px-3">Total Answers</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(institutional?.topicInsights || []).map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-white/2 text-white transition-colors">
                      <td className="py-2.5 px-3 capitalize font-medium text-gray-300">{t.topic}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-white/5 h-1.5 rounded-full">
                            <div
                              className={`h-1.5 rounded-full ${t.accuracy >= 70 ? 'bg-emerald-500' : t.accuracy >= 45 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${t.accuracy}%` }}
                            />
                          </div>
                          <span className={`font-bold font-mono ${t.accuracy >= 70 ? 'text-emerald-400' : t.accuracy >= 45 ? 'text-amber-400' : 'text-red-400'}`}>{t.accuracy}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-400">{t.totalAnswers}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                          t.accuracy >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : t.accuracy >= 45 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {t.accuracy >= 70 ? 'Strong' : t.accuracy >= 45 ? 'Moderate' : 'Needs Focus'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'aimonitoring' && (
        <div className="space-y-6">
          {/* Health check dashboard cards */}
          {aiHealth && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Connection Status */}
              <GlassCard className="border border-white/5 p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">AI Service Status</span>
                  <span className={`text-sm font-extrabold flex items-center gap-1.5 ${aiHealth.apiConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                    {aiHealth.apiConnected ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>✓ Connected</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        <span>✗ Disconnected</span>
                      </>
                    )}
                  </span>
                  <span className="text-[9px] text-gray-400 block max-w-xs">{aiHealth.details}</span>
                </div>
              </GlassCard>

              {/* Card 2: Last Successful Generation */}
              <GlassCard className="border border-white/5 p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">Last Successful Generation</span>
                  <span className="text-sm font-extrabold text-white">
                    {aiHealth.lastSuccessfulGeneration ? (
                      new Date(aiHealth.lastSuccessfulGeneration).toLocaleString()
                    ) : (
                      <span className="text-gray-500 font-medium">None Recorded</span>
                    )}
                  </span>
                  <span className="text-[9px] text-gray-400 block">Timestamp of last verified LLM output</span>
                </div>
              </GlassCard>

              {/* Card 3: Error Count */}
              <GlassCard className="border border-white/5 p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">Failed Generation Count</span>
                  <span className={`text-sm font-black ${aiHealth.errorCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {aiHealth.errorCount} Errors
                  </span>
                  <span className="text-[9px] text-gray-400 block">Total validation/API failures logged</span>
                </div>
              </GlassCard>
            </div>
          )}

          <GlassCard className="border border-white/5 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                  <BrainCircuit className="w-5 h-5 text-indigo-400" />
                  <span>AI Monitor Log History</span>
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Audit trail of prompts, API responses, execution times, and quality control validations.</p>
              </div>
              <div className="flex space-x-2">
                {(['all', 'success', 'failure'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setLogsFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider ${
                      logsFilter === f
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <button
                  onClick={fetchLogs}
                  disabled={loadingLogs}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1e293b] border border-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-white transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {loadingLogs ? (
              <div className="py-12 flex justify-center"><LoadingSpinner /></div>
            ) : (
              <div className="space-y-3">
                {aiLogs
                  .filter((log) => {
                    if (logsFilter === 'success') return log.success;
                    if (logsFilter === 'failure') return !log.success;
                    return true;
                  })
                  .map((log) => {
                    const isExpanded = expandedLogId === log._id;
                    return (
                      <div
                        key={log._id}
                        className={`bg-white/3 border rounded-xl transition-all ${
                          log.success ? 'border-white/5' : 'border-red-500/20 bg-red-950/5'
                        }`}
                      >
                        {/* Summary Header */}
                        <div
                          onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-white/2 select-none"
                        >
                          <div className="flex items-center space-x-3">
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                log.success
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}
                            >
                              {log.success ? 'Success' : 'Failure'}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-white capitalize">
                                {log.action?.replace(/_/g, ' ') || 'AI Action'}
                              </span>
                              <span className="text-[10px] text-gray-500 ml-2">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                User: <span className="font-semibold">{log.userId?.name || 'Unknown'}</span> ({log.userId?.email || 'N/A'})
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 self-end sm:self-center">
                            {log.topic && (
                              <div className="text-right">
                                <span className="text-[9px] text-gray-500 block uppercase font-bold">Topic</span>
                                <span className="text-[10px] text-indigo-400 font-bold capitalize">{log.topic}</span>
                              </div>
                            )}
                            {log.difficulty && (
                              <div className="text-right">
                                <span className="text-[9px] text-gray-500 block uppercase font-bold">Diff</span>
                                <span className="text-[10px] text-purple-400 font-bold uppercase">{log.difficulty}</span>
                              </div>
                            )}
                            <div className="text-right">
                              <span className="text-[9px] text-gray-500 block uppercase font-bold">Latency</span>
                              <span className="text-[10px] text-amber-400 font-bold font-mono">{log.generationTimeMs}ms</span>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                          </div>
                        </div>

                        {/* Collapsible Details */}
                        {isExpanded && (
                          <div className="border-t border-white/5 p-4 space-y-4 bg-black/20 rounded-b-xl">
                            {/* Validation results or error message */}
                            {!log.success && log.errorMessage && (
                              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg flex items-start space-x-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div className="space-y-1">
                                  <p className="font-bold">Execution Error</p>
                                  <p className="font-mono text-[10px]">{log.errorMessage}</p>
                                </div>
                              </div>
                            )}

                            {log.validationResults?.errors?.length > 0 && (
                              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs p-3 rounded-lg">
                                <p className="font-bold mb-1 flex items-center space-x-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>QC Validation Warnings ({log.validationResults.errors.length})</span>
                                </p>
                                <ul className="list-disc list-inside space-y-0.5 text-[10px] font-medium leading-relaxed max-h-24 overflow-y-auto">
                                  {log.validationResults.errors.map((errStr: string, idx: number) => (
                                    <li key={idx}>{errStr}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Prompt Block */}
                            {log.prompt && (
                              <div className="space-y-1">
                                <span className="text-[9px] text-gray-500 font-extrabold uppercase tracking-wider block">Constructed Prompt</span>
                                <pre className="bg-black/30 text-gray-400 text-[10px] p-3 rounded-xl border border-white/5 overflow-x-auto whitespace-pre-wrap max-h-40 font-mono">
                                  {log.prompt}
                                </pre>
                              </div>
                            )}

                            {/* Generated Questions List */}
                            {log.generatedQuestions && log.generatedQuestions.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[9px] text-gray-500 font-extrabold uppercase tracking-wider block">
                                  Generated Questions ({log.generatedQuestions.length})
                                </span>
                                <div className="space-y-2">
                                  {log.generatedQuestions.map((q: any, idx: number) => (
                                    <div key={idx} className="bg-white/2 border border-white/5 rounded-xl p-3 space-y-2">
                                      <p className="text-xs font-bold text-white flex items-start space-x-2">
                                        <span className="w-4.5 h-4.5 rounded bg-indigo-500/10 text-indigo-400 font-black text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                                        <span>{q.questionText}</span>
                                      </p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pl-6">
                                        {q.options?.map((opt: string, oIdx: number) => (
                                          <div
                                            key={oIdx}
                                            className={`px-2 py-1.5 rounded-lg border ${
                                              q.correctAnswer === oIdx
                                                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                                                : 'bg-transparent border-white/5 text-gray-400'
                                            }`}
                                          >
                                            <span className="font-bold mr-1.5">{String.fromCharCode(65 + oIdx)}:</span>
                                            {opt}
                                          </div>
                                        ))}
                                      </div>
                                      {q.explanation && (
                                        <p className="text-[10px] text-gray-400 italic pl-6 pt-1 border-t border-white/2">
                                          <span className="font-bold text-gray-500">Explanation:</span> {q.explanation}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                {aiLogs.length === 0 && (
                  <div className="text-center py-12 text-xs text-gray-500">No logs found. Run some AI operations first!</div>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      )}
      {loadingHealth && null}
    </div>
  );
};

export default AdminIntelligenceDashboard;
