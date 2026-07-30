import React, { useState, useEffect, useRef } from 'react';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import {
  Activity, Users, Trophy, CheckCircle, Clock, Zap,
  RefreshCw, Radio, TrendingUp,
} from 'lucide-react';

interface LiveData {
  activeStudents: number;
  completedToday: number;
  avgScoreToday: number;
  leaderboard: Array<{ name: string; score: number; quiz: string; time: string }>;
  feed: Array<{ student: string; quiz: string; status: string; score: number | null; time: string }>;
  lastUpdated: string;
}

const REFRESH_INTERVAL = 10000; // 10 seconds

const LiveDashboard: React.FC = () => {
  const [live, setLive] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(10);
  const [scoreHistory, setScoreHistory] = useState<Array<{ time: string; score: number }>>([]);
  const [activityHistory, setActivityHistory] = useState<Array<{ time: string; active: number; completed: number }>>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLive = async () => {
    try {
      const res = await API.get('/analytics/live');
      if (res.data.success) {
        const data = res.data.live;
        setLive(data);
        setLastRefresh(new Date());
        setCountdown(REFRESH_INTERVAL / 1000);

        // Append to sparkline history
        const now = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setScoreHistory((prev) => [...prev.slice(-19), { time: now, score: data.avgScoreToday }]);
        setActivityHistory((prev) => [...prev.slice(-19), { time: now, active: data.activeStudents, completed: data.completedToday }]);
      }
    } catch {
      // silently fail on live refresh
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLive();
    intervalRef.current = setInterval(fetchLive, REFRESH_INTERVAL);
    countdownRef.current = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const timeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Radio className="w-10 h-10 text-indigo-400 animate-pulse mx-auto" />
          <p className="text-sm text-gray-400">Connecting to live feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <Radio className="w-7 h-7 text-emerald-400 animate-pulse" />
            </div>
            <span>Live Dashboard</span>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-extrabold uppercase tracking-wider animate-pulse">
              LIVE
            </span>
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1 ml-12">
            Real-time platform activity · Auto-refreshes every {REFRESH_INTERVAL / 1000}s
          </p>
        </div>
        <div className="flex items-center space-x-3 self-start">
          <div className="text-xs text-gray-500 text-right">
            <p>Last updated: <span className="text-white">{lastRefresh.toLocaleTimeString()}</span></p>
            <p>Next refresh in: <span className="text-emerald-400 font-bold">{countdown}s</span></p>
          </div>
          <button
            onClick={fetchLive}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-white/10 text-xs font-semibold text-gray-300 hover:bg-white/5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Now</span>
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Right Now',
            value: live?.activeStudents || 0,
            icon: Users,
            color: 'emerald',
            pulse: (live?.activeStudents || 0) > 0,
            sub: 'students in-progress',
          },
          {
            label: 'Completed Today',
            value: live?.completedToday || 0,
            icon: CheckCircle,
            color: 'indigo',
            pulse: false,
            sub: 'quiz attempts today',
          },
          {
            label: "Today's Avg Score",
            value: `${live?.avgScoreToday || 0}%`,
            icon: Trophy,
            color: 'amber',
            pulse: false,
            sub: 'across all today\'s attempts',
          },
          {
            label: 'Leaderboard Entries',
            value: live?.leaderboard?.length || 0,
            icon: TrendingUp,
            color: 'blue',
            pulse: false,
            sub: 'top performers today',
          },
        ].map((card, i) => (
          <GlassCard key={i} className={`border ${card.pulse ? 'border-emerald-500/20' : 'border-white/5'} p-4 space-y-2`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{card.label}</span>
              <div className={`p-1.5 rounded-lg bg-${card.color}-500/10 text-${card.color}-400 ${card.pulse ? 'animate-pulse' : ''}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <span className={`text-3xl font-black text-${card.color}-400 block`}>{card.value}</span>
            <span className="text-[10px] text-gray-600 block">{card.sub}</span>
          </GlassCard>
        ))}
      </div>

      {/* ─── Sparkline Charts ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="border border-white/5 p-5 space-y-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Score Trend (Last 20 Polls)</h3>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scoreHistory} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#374151" fontSize={7} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#374151" fontSize={8} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 6 }} itemStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="score" stroke="#f59e0b" fill="url(#scoreGrad)" strokeWidth={2} dot={false} name="Avg Score %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="border border-white/5 p-5 space-y-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Activity Trend (Last 20 Polls)</h3>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityHistory} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#374151" fontSize={7} tickLine={false} />
                <YAxis stroke="#374151" fontSize={8} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: 6 }} itemStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="active" stroke="#10b981" fill="url(#activeGrad)" strokeWidth={2} dot={false} name="Active" />
                <Area type="monotone" dataKey="completed" stroke="#6366f1" fill="url(#completedGrad)" strokeWidth={2} dot={false} name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* ─── Leaderboard + Activity Feed ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Leaderboard */}
        <GlassCard className="border border-white/5 p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-white/5 pb-3">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Today's Leaderboard</h3>
          </div>
          <div className="space-y-2">
            {(live?.leaderboard || []).length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-500">No completed quizzes today yet.</div>
            ) : (
              (live?.leaderboard || []).slice(0, 8).map((entry, i) => (
                <div key={i} className="flex items-center space-x-3 bg-white/3 rounded-xl px-3 py-2.5">
                  <span className={`text-sm font-black w-6 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-gray-600'}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{entry.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{entry.quiz}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-sm font-black ${entry.score >= 80 ? 'text-emerald-400' : entry.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {entry.score}%
                    </span>
                    <p className="text-[9px] text-gray-600">{timeSince(entry.time)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Activity Feed */}
        <GlassCard className="border border-white/5 p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-white/5 pb-3">
            <Activity className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Live Activity Feed</h3>
            <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(live?.feed || []).length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-500">No recent activity in the last hour.</div>
            ) : (
              (live?.feed || []).map((item, i) => (
                <div key={i} className="flex items-center space-x-3 px-3 py-2 bg-white/2 rounded-lg border border-white/3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'completed' ? 'bg-emerald-400' : 'bg-indigo-400 animate-pulse'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-white truncate">{item.student}</p>
                    <p className="text-[10px] text-gray-500 truncate">{item.quiz}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {item.status === 'completed' ? (
                      <span className={`text-xs font-bold ${item.score && item.score >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {item.score}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-indigo-400 font-semibold">In Progress</span>
                    )}
                    <p className="text-[9px] text-gray-600">{timeSince(item.time)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <div className="text-center text-[10px] text-gray-600 py-2">
        <Clock className="w-3 h-3 inline mr-1" />
        Auto-refreshing every {REFRESH_INTERVAL / 1000} seconds · Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
};

export default LiveDashboard;
