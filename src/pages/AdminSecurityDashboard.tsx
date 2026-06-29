import React, { useState, useEffect, useCallback } from 'react';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import socket from '../services/socket';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import {
  Shield,
  AlertTriangle,
  Users,
  Search,
  RefreshCw,
  Clock,
  X,
  TrendingUp,
  Eye,
  Activity,
  BarChart3,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Camera,
  Monitor,
  Copy,
  Maximize,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface Incident {
  _id: string;
  userId: { _id: string; name: string; email: string };
  quizId: { _id: string; title: string };
  eventType: string;
  timestamp: string;
  metadata?: any;
}

interface SuspiciousStudent {
  _id: string;
  userId: { _id: string; name: string; email: string };
  quizId: { title: string };
  riskScore: number;
  riskCategory: string;
  calculatedAt: string;
}

interface SecuritySummary {
  totalSessions: number;
  riskDistribution: { low: number; medium: number; high: number };
  violations: {
    totalTabSwitches: number;
    totalFocusLoss: number;
    totalCopyPaste: number;
    totalRightClicks: number;
    totalScreenshots: number;
    totalFullscreenExits: number;
    totalCameraViolations: number;
  };
}

interface TrendDay {
  date: string;
  total: number;
  tabSwitches: number;
  focusLoss: number;
  fullscreenExits: number;
  copyPaste: number;
  cameraEvents: number;
  avgRisk: number;
  maxRisk: number;
}

interface StudentReport {
  summary: {
    totalExams: number;
    averageRisk: number;
    highRiskExams: number;
    tabSwitches?: number;
    focusLoss?: number;
    copyPaste?: number;
    screenshots?: number;
    fullscreenExits?: number;
    cameraViolations?: number;
  };
  assessments: any[];
  violations: any[];
  recentLogs: any[];
}

// ─── Constants ────────────────────────────────────────────────
const EVENT_COLORS: Record<string, string> = {
  TAB_SWITCH: '#6366f1',
  FOCUS_LOSS: '#818cf8',
  COPY_ATTEMPT: '#eab308',
  PASTE_ATTEMPT: '#ca8a04',
  CUT_ATTEMPT: '#a16207',
  SCREENSHOT_ATTEMPT: '#f59e0b',
  FULLSCREEN_EXIT: '#ef4444',
  FACE_NOT_DETECTED: '#dc2626',
  MULTIPLE_FACES_DETECTED: '#a855f7',
  AUTO_SUBMISSION: '#be123c',
};

const EVENT_LABELS: Record<string, string> = {
  TAB_SWITCH: 'Tab Swapped',
  FOCUS_LOSS: 'Focus Lost',
  COPY_ATTEMPT: 'Clipboard Copy',
  PASTE_ATTEMPT: 'Clipboard Paste',
  CUT_ATTEMPT: 'Clipboard Cut',
  SCREENSHOT_ATTEMPT: 'Screenshot Attempt',
  FULLSCREEN_EXIT: 'Fullscreen Exit',
  FACE_NOT_DETECTED: 'Face Lost (Camera)',
  MULTIPLE_FACES_DETECTED: 'Multiple Faces',
  AUTO_SUBMISSION: 'Auto Submitted',
};

type Tab = 'overview' | 'trends' | 'students' | 'incidents';

// ─── Component ────────────────────────────────────────────────
const AdminSecurityDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Overview data
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [suspiciousList, setSuspiciousList] = useState<SuspiciousStudent[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);

  // Trends data
  const [trends, setTrends] = useState<TrendDay[]>([]);
  const [trendDays, setTrendDays] = useState(7);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('ALL');
  const [riskSort, setRiskSort] = useState<'desc' | 'asc'>('desc');

  // Student drill-down modal
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchSecurityData = useCallback(async () => {
    try {
      setError(null);
      const [cohortRes, trendsRes] = await Promise.all([
        API.get('/security/analytics/cohort'),
        API.get(`/security/analytics/trends?days=${trendDays}`),
      ]);

      if (cohortRes.data.success) {
        setSummary(cohortRes.data.summary);
        setSuspiciousList(cohortRes.data.suspiciousList || []);
        setRecentIncidents(cohortRes.data.recentIncidents || []);
      }
      if (trendsRes.data.success) {
        setTrends(trendsRes.data.trends || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error fetching security diagnostics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [trendDays]);

  useEffect(() => {
    fetchSecurityData();
  }, [fetchSecurityData]);

  // Real-time security events synchronization via socket.io
  useEffect(() => {
    socket.connect();
    socket.emit('join-admin-security');

    socket.on('security_status_updated', (newIncident: Incident) => {
      console.log('Received real-time incident event:', newIncident);
      setRecentIncidents((prev) => [newIncident, ...prev].slice(0, 100));

      // Synchronously increment live metric summaries locally
      setSummary((prev) => {
        if (!prev) return null;
        const type = newIncident.eventType;
        return {
          ...prev,
          violations: {
            totalTabSwitches: prev.violations.totalTabSwitches + (type === 'TAB_SWITCH' ? 1 : 0),
            totalFocusLoss: prev.violations.totalFocusLoss + (type === 'FOCUS_LOSS' ? 1 : 0),
            totalCopyPaste: prev.violations.totalCopyPaste + (['COPY_ATTEMPT', 'PASTE_ATTEMPT', 'CUT_ATTEMPT'].includes(type) ? 1 : 0),
            totalRightClicks: prev.violations.totalRightClicks + (type === 'RIGHT_CLICK_ATTEMPT' ? 1 : 0),
            totalScreenshots: prev.violations.totalScreenshots + (type === 'SCREENSHOT_ATTEMPT' ? 1 : 0),
            totalFullscreenExits: prev.violations.totalFullscreenExits + (type === 'FULLSCREEN_EXIT' ? 1 : 0),
            totalCameraViolations: prev.violations.totalCameraViolations + (['FACE_NOT_DETECTED', 'MULTIPLE_FACES_DETECTED', 'CAMERA_DISCONNECT', 'CAMERA_PERMISSION_DENIED'].includes(type) ? 1 : 0),
          }
        };
      });
    });

    return () => {
      socket.off('security_status_updated');
      socket.disconnect();
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSecurityData();
  };

  const openStudentReport = async (userId: string, name: string) => {
    setSelectedStudentId(userId);
    setSelectedStudentName(name);
    setStudentReport(null);
    setReportLoading(true);
    try {
      const res = await API.get(`/security/student-report/${userId}`);
      if (res.data.success) setStudentReport(res.data.report);
    } catch (err: any) {
      console.error('Failed to load student report:', err);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  // ─── Chart data ──────────────────────────────────────────────
  const pieData = summary
    ? [
        { name: 'Low Risk', value: summary.riskDistribution.low || 0, color: '#10b981' },
        { name: 'Medium Risk', value: summary.riskDistribution.medium || 0, color: '#f59e0b' },
        { name: 'High Risk', value: summary.riskDistribution.high || 0, color: '#ef4444' },
      ].filter((d) => d.value > 0)
    : [];

  const barData = summary
    ? [
        { name: 'Tab', count: summary.violations.totalTabSwitches || 0, fill: '#6366f1' },
        { name: 'Focus', count: summary.violations.totalFocusLoss || 0, fill: '#818cf8' },
        { name: 'Copy', count: summary.violations.totalCopyPaste || 0, fill: '#eab308' },
        { name: 'Click', count: summary.violations.totalRightClicks || 0, fill: '#3b82f6' },
        { name: 'Screenshot', count: summary.violations.totalScreenshots || 0, fill: '#f59e0b' },
        { name: 'Fullscreen', count: summary.violations.totalFullscreenExits || 0, fill: '#ef4444' },
        { name: 'Camera', count: summary.violations.totalCameraViolations || 0, fill: '#ec4899' },
      ]
    : [];

  const radarData = barData.map((d) => ({ subject: d.name, value: d.count }));

  const sortedStudents = [...suspiciousList].sort((a, b) =>
    riskSort === 'desc' ? b.riskScore - a.riskScore : a.riskScore - b.riskScore
  );

  const filteredIncidents = recentIncidents.filter((incident) => {
    const matchesSearch =
      incident.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.userId?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.quizId?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedEventType === 'ALL' || incident.eventType === selectedEventType;
    return matchesSearch && matchesType;
  });

  const trendShortDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const totalViolationsToday = trends.length > 0 ? trends[trends.length - 1]?.total || 0 : 0;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'trends', label: 'Trends', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'students', label: 'Students', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'incidents', label: 'Incidents', icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2.5">
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl">
              <Shield className="w-7 h-7 text-red-400" />
            </div>
            <span>Exam Security & Integrity</span>
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1 ml-12">
            Real-time anti-cheating analytics, proctoring logs, and cohort risk monitoring.
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

      {/* ─── KPI Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Sessions',
            value: summary?.totalSessions || 0,
            icon: <Monitor className="w-5 h-5" />,
            color: 'indigo',
          },
          {
            label: 'High Risk Attempts',
            value: summary?.riskDistribution.high || 0,
            icon: <AlertTriangle className="w-5 h-5" />,
            color: 'red',
            pulse: true,
          },
          {
            label: 'Medium Risk',
            value: summary?.riskDistribution.medium || 0,
            icon: <Eye className="w-5 h-5" />,
            color: 'amber',
          },
          {
            label: "Today's Violations",
            value: totalViolationsToday,
            icon: <Activity className="w-5 h-5" />,
            color: 'purple',
          },
        ].map((card, i) => (
          <GlassCard key={i} className="border border-white/5 p-4 flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl bg-${card.color}-500/10 border border-${card.color}-500/20 text-${card.color}-400 ${
                card.pulse ? 'animate-pulse' : ''
              } flex-shrink-0`}
            >
              {card.icon}
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                {card.label}
              </span>
              <span
                className={`text-2xl font-black mt-0.5 block text-${card.color}-400`}
              >
                {card.value}
              </span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ─── Tab Nav ─────────────────────────────────────────── */}
      <div className="flex space-x-1 bg-white/3 border border-white/5 p-1 rounded-xl w-fit">
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
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: OVERVIEW */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bar Chart — Violation Type Frequency */}
            <GlassCard className="border border-white/5 p-6 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Violation Type Frequency
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Comparative distribution of all logged violations across submissions.
                </p>
              </div>
              <div className="h-56 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                    <YAxis stroke="#6b7280" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }}
                      labelStyle={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}
                      itemStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Pie Chart — Risk Distribution */}
            <GlassCard className="border border-white/5 p-6 space-y-4 flex flex-col">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Cohort Risk Allocation
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Breakdown of submissions by risk classifications.
                </p>
              </div>
              <div className="h-44 relative mt-2">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-white">{summary?.totalSessions || 0}</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Sessions</span>
                </div>
              </div>
              <div className="space-y-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-gray-400">{d.name}</span>
                    </div>
                    <span className="text-white font-mono font-bold">{d.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Radar — Violation Profile */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                Violation Profile Radar
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Multi-dimensional view of violation category prevalence across all exams.
              </p>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fill: '#4b5563', fontSize: 9 }} />
                  <Radar
                    name="Violations"
                    dataKey="value"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }}
                    itemStyle={{ fontSize: 11 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: TRENDS */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Day Range Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400 font-semibold">Time range:</span>
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setTrendDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  trendDays === d
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Line Chart — Daily Violations Trend */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Daily Violation Volume ({trendDays}-Day Trend)</span>
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Breakdown of violation events per day across all monitored assessments.
              </p>
            </div>
            <div className="h-72 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={trendShortDate}
                    stroke="#6b7280"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis stroke="#6b7280" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }}
                    labelFormatter={(v) => trendShortDate(v)}
                    itemStyle={{ fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Line type="monotone" dataKey="tabSwitches" stroke="#6366f1" strokeWidth={2} dot={false} name="Tab Switches" />
                  <Line type="monotone" dataKey="focusLoss" stroke="#818cf8" strokeWidth={2} dot={false} name="Focus Loss" />
                  <Line type="monotone" dataKey="fullscreenExits" stroke="#ef4444" strokeWidth={2} dot={false} name="Fullscreen Exits" />
                  <Line type="monotone" dataKey="copyPaste" stroke="#eab308" strokeWidth={2} dot={false} name="Copy/Paste" />
                  <Line type="monotone" dataKey="cameraEvents" stroke="#ec4899" strokeWidth={2} dot={false} name="Camera Events" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Line Chart — Daily Avg Risk Score */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>Integrity Risk Score Trends</span>
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Average and peak cheating risk scores per day — higher scores indicate greater exam integrity concerns.
              </p>
            </div>
            <div className="h-56 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={trendShortDate}
                    stroke="#6b7280"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }}
                    labelFormatter={(v) => trendShortDate(v)}
                    itemStyle={{ fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Line type="monotone" dataKey="avgRisk" stroke="#f59e0b" strokeWidth={2.5} dot={false} name="Avg Risk Score" />
                  <Line type="monotone" dataKey="maxRisk" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Peak Risk Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Daily summary table */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Daily Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-gray-400 uppercase text-[9px] font-bold tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Total</th>
                    <th className="py-2.5 px-3 text-indigo-400">Tab</th>
                    <th className="py-2.5 px-3 text-blue-400">Focus</th>
                    <th className="py-2.5 px-3 text-red-400">Fullscreen</th>
                    <th className="py-2.5 px-3 text-amber-400">Copy</th>
                    <th className="py-2.5 px-3 text-pink-400">Camera</th>
                    <th className="py-2.5 px-3 text-amber-400">Avg Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[...trends].reverse().map((day) => (
                    <tr key={day.date} className="hover:bg-white/2 text-white transition-colors">
                      <td className="py-2.5 px-3 font-mono text-gray-300">{trendShortDate(day.date)}</td>
                      <td className="py-2.5 px-3 font-bold">{day.total}</td>
                      <td className="py-2.5 px-3 text-indigo-400">{day.tabSwitches}</td>
                      <td className="py-2.5 px-3 text-blue-400">{day.focusLoss}</td>
                      <td className="py-2.5 px-3 text-red-400">{day.fullscreenExits}</td>
                      <td className="py-2.5 px-3 text-amber-400">{day.copyPaste}</td>
                      <td className="py-2.5 px-3 text-pink-400">{day.cameraEvents}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-bold ${
                            day.avgRisk > 70 ? 'text-red-400' : day.avgRisk > 35 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {day.avgRisk}%
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

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: STUDENTS */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Student Risk Ranking */}
          <GlassCard className="border border-white/5 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                  <span>Student Risk Ranking</span>
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Students flagged with integrity concerns — click any row to view their full report.
                </p>
              </div>
              <button
                onClick={() => setRiskSort((s) => (s === 'desc' ? 'asc' : 'desc'))}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-gray-300 hover:bg-white/5 transition-all"
              >
                {riskSort === 'desc' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                <span>Risk {riskSort === 'desc' ? 'Highest First' : 'Lowest First'}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              {sortedStudents.length > 0 ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 uppercase font-bold text-[9px] tracking-wider">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Quiz</th>
                      <th className="py-3 px-4">Risk Score</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedStudents.map((student, idx) => (
                      <tr
                        key={student._id}
                        className="hover:bg-white/3 transition-colors text-white cursor-pointer group"
                        onClick={() => openStudentReport(student.userId?._id, student.userId?.name)}
                      >
                        <td className="py-3 px-4 text-gray-500 font-mono">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold">{student.userId?.name || 'Deleted'}</div>
                          <div className="text-[10px] text-gray-400">{student.userId?.email}</div>
                        </td>
                        <td className="py-3 px-4 text-gray-300 font-medium">
                          {student.quizId?.title || 'Unknown'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-white/5 rounded-full h-1.5 w-20">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  student.riskScore > 70 ? 'bg-red-500' : student.riskScore > 35 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${student.riskScore}%` }}
                              />
                            </div>
                            <span
                              className={`font-black text-sm ${
                                student.riskScore > 70 ? 'text-red-400' : student.riskScore > 35 ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              {student.riskScore}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                              student.riskCategory === 'High Risk'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : student.riskCategory === 'Medium Risk'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {student.riskCategory}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 font-mono">
                          {new Date(student.calculatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-400 transition-colors ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-xs text-gray-500 font-medium">
                  <Shield className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  No students flagged. All sessions are clean.
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: INCIDENTS */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === 'incidents' && (
        <GlassCard className="border border-white/5 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                Live Proctoring Audit Timeline
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Chronological log of all system warnings, tab swaps, and screen exit violations.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="bg-[#0f172a] border border-white/10 rounded-lg text-xs text-gray-300 px-3 py-2 outline-none font-semibold"
              >
                <option value="ALL">All Event Types</option>
                <option value="TAB_SWITCH">Tab Switches</option>
                <option value="FOCUS_LOSS">Focus Losses</option>
                <option value="COPY_ATTEMPT">Copy Attempts</option>
                <option value="PASTE_ATTEMPT">Paste Attempts</option>
                <option value="SCREENSHOT_ATTEMPT">Screenshot Captures</option>
                <option value="FULLSCREEN_EXIT">Fullscreen Exits</option>
                <option value="FACE_NOT_DETECTED">Camera: Face Lost</option>
                <option value="MULTIPLE_FACES_DETECTED">Camera: Extra Faces</option>
                <option value="AUTO_SUBMISSION">Auto Submissions</option>
              </select>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search student/email..."
                  className="bg-[#0f172a] border border-white/10 rounded-lg text-xs text-gray-300 pl-9 pr-4 py-2 outline-none w-48 focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredIncidents.length > 0 ? (
              filteredIncidents.map((incident) => (
                <div
                  key={incident._id}
                  className={`border-l-4 px-4 py-3 rounded-r-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs transition-all`}
                  style={{
                    borderColor: EVENT_COLORS[incident.eventType] || '#6b7280',
                    backgroundColor: `${EVENT_COLORS[incident.eventType] || '#6b7280'}0d`,
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span
                        className="font-extrabold uppercase text-[9px] tracking-wide px-2 py-0.5 rounded"
                        style={{
                          color: EVENT_COLORS[incident.eventType] || '#9ca3af',
                          backgroundColor: `${EVENT_COLORS[incident.eventType] || '#9ca3af'}20`,
                        }}
                      >
                        {EVENT_LABELS[incident.eventType] || incident.eventType}
                      </span>
                      <span className="text-white font-semibold">
                        {incident.userId?.name || 'Deleted'}
                      </span>
                      <span className="text-gray-500">({incident.userId?.email})</span>
                    </div>
                    <div className="text-[11px] text-gray-300">
                      Exam: <span className="font-semibold text-white">{incident.quizId?.title}</span>
                    </div>
                    {incident.metadata?.notes && (
                      <div className="text-[10px] text-gray-400">{incident.metadata.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-[10px] text-gray-500 font-mono self-start sm:self-center flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(incident.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-xs text-gray-500 font-medium">
                No incidents match current filter.
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* STUDENT REPORT MODAL */}
      {/* ═══════════════════════════════════════════════════════ */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-50 bg-[#070b11]/90 backdrop-blur-sm flex items-start justify-end p-4 overflow-y-auto">
          <div className="w-full max-w-2xl space-y-4 mt-4">
            {/* Modal Header */}
            <GlassCard className="border border-white/10 p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Security Report</h3>
                <p className="text-xs text-indigo-400 font-semibold mt-0.5">{selectedStudentName}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedStudentId(null);
                  setStudentReport(null);
                }}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </GlassCard>

            {reportLoading ? (
              <GlassCard className="border border-white/5 p-8 flex items-center justify-center">
                <LoadingSpinner />
              </GlassCard>
            ) : studentReport ? (
              <>
                {/* Summary KPIs */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Exams', value: studentReport.summary.totalExams, color: 'indigo' },
                    { label: 'Avg Risk Score', value: `${studentReport.summary.averageRisk}%`, color: studentReport.summary.averageRisk > 70 ? 'red' : studentReport.summary.averageRisk > 35 ? 'amber' : 'emerald' },
                    { label: 'High Risk Exams', value: studentReport.summary.highRiskExams, color: 'red' },
                  ].map((c, i) => (
                    <GlassCard key={i} className="border border-white/5 p-4 text-center">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{c.label}</span>
                      <span className={`text-xl font-black block mt-1 text-${c.color}-400`}>{c.value}</span>
                    </GlassCard>
                  ))}
                </div>

                {/* Violation Breakdown */}
                <GlassCard className="border border-white/5 p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wide">Lifetime Violation Breakdown</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Tab Switches', value: studentReport.summary.tabSwitches || 0, icon: <Monitor className="w-3.5 h-3.5" />, color: 'text-indigo-400' },
                      { label: 'Focus Losses', value: studentReport.summary.focusLoss || 0, icon: <Eye className="w-3.5 h-3.5" />, color: 'text-blue-400' },
                      { label: 'Copy/Paste', value: studentReport.summary.copyPaste || 0, icon: <Copy className="w-3.5 h-3.5" />, color: 'text-amber-400' },
                      { label: 'Screenshots', value: studentReport.summary.screenshots || 0, icon: <Camera className="w-3.5 h-3.5" />, color: 'text-amber-500' },
                      { label: 'Fullscreen Exits', value: studentReport.summary.fullscreenExits || 0, icon: <Maximize className="w-3.5 h-3.5" />, color: 'text-red-400' },
                      { label: 'Camera Violations', value: studentReport.summary.cameraViolations || 0, icon: <Camera className="w-3.5 h-3.5" />, color: 'text-pink-400' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/3 rounded-lg px-3 py-2 border border-white/5">
                        <div className={`flex items-center space-x-1.5 ${item.color}`}>
                          {item.icon}
                          <span className="text-xs text-gray-300 font-medium">{item.label}</span>
                        </div>
                        <span className={`font-black font-mono text-sm ${item.color}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                {/* Exam History */}
                <GlassCard className="border border-white/5 p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wide">Exam Risk History</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {studentReport.assessments.length > 0 ? (
                      studentReport.assessments.map((a: any) => (
                        <div key={a._id} className="flex items-center justify-between bg-white/2 rounded-lg px-3 py-2.5 border border-white/5">
                          <div>
                            <div className="text-xs font-semibold text-white">{a.quizId?.title || 'Unknown Quiz'}</div>
                            <div className="text-[10px] text-gray-400">{new Date(a.calculatedAt).toLocaleDateString()}</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-black ${a.riskScore > 70 ? 'text-red-400' : a.riskScore > 35 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {a.riskScore}%
                            </div>
                            <div className={`text-[9px] font-bold uppercase ${a.riskScore > 70 ? 'text-red-500' : a.riskScore > 35 ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {a.riskCategory}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-4">No exam history found.</p>
                    )}
                  </div>
                </GlassCard>

                {/* Recent Activity Log */}
                <GlassCard className="border border-white/5 p-5 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wide">Recent Activity Log</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {studentReport.recentLogs.slice(0, 20).map((log: any) => (
                      <div
                        key={log._id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ backgroundColor: `${EVENT_COLORS[log.eventType] || '#6b7280'}0d` }}
                      >
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: EVENT_COLORS[log.eventType] || '#9ca3af' }}
                        >
                          {EVENT_LABELS[log.eventType] || log.eventType}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                    {studentReport.recentLogs.length === 0 && (
                      <p className="text-xs text-gray-500 text-center py-4">No activity logs found.</p>
                    )}
                  </div>
                </GlassCard>
              </>
            ) : (
              <GlassCard className="border border-white/5 p-8 text-center text-xs text-gray-500">
                Failed to load student report.
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSecurityDashboard;
