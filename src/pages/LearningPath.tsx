import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Tooltip
} from 'recharts';
import {
  ArrowLeft, BrainCircuit, CheckCircle, Circle,
  TrendingUp, Lock, Zap, BookOpen
} from 'lucide-react';

interface LearningStep {
  topic: string;
  order: number;
  status: 'completed' | 'current' | 'upcoming';
  accuracy: number;
}

interface LearningPathData {
  currentLevel: 'beginner' | 'intermediate' | 'advanced';
  steps: LearningStep[];
  recommendedTopics: string[];
  weakTopics: string[];
  strengths: string[];
  lastUpdated: string;
}

interface MasteryRecord {
  topic: string;
  accuracy: number;
  status: string;
}

const levelConfig = {
  beginner: { label: 'Beginner', gradient: 'from-blue-500 to-cyan-500', textColor: 'text-blue-400' },
  intermediate: { label: 'Intermediate', gradient: 'from-amber-500 to-orange-500', textColor: 'text-amber-400' },
  advanced: { label: 'Advanced', gradient: 'from-emerald-500 to-teal-500', textColor: 'text-emerald-400' },
};

const LearningPath: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pathData, setPathData] = useState<LearningPathData | null>(null);
  const [masteryRecords, setMasteryRecords] = useState<MasteryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      try {
        const res = await API.get(`/ai/learning-path/${user._id}`);
        setPathData(res.data.path);
        setMasteryRecords(res.data.masteryRecords || []);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load learning path');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  // Radar chart data from mastery records
  const radarData = masteryRecords.slice(0, 8).map((r) => ({
    topic: r.topic.length > 12 ? r.topic.substring(0, 12) + '…' : r.topic,
    accuracy: r.accuracy,
  }));

  if (loading) return <LoadingSpinner fullPage />;

  const completedCount = pathData?.steps.filter(s => s.status === 'completed').length || 0;
  const totalCount = pathData?.steps.length || 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <span>Learning Path</span>
            <TrendingUp className="w-6 h-6 text-indigo-400" />
          </h2>
          <p className="text-gray-400 text-sm mt-1 font-medium">
            Your personalized AI-generated study roadmap.
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/practice')}
          className="flex items-center space-x-1.5 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Zap className="w-4 h-4" />
          <span>Practice Now</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {!pathData ? (
        <GlassCard className="border border-white/5 py-24 text-center">
          <BrainCircuit className="w-14 h-14 text-indigo-400 mx-auto mb-4 opacity-50" />
          <p className="text-white font-bold text-lg">No learning path yet</p>
          <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
            Complete your first quiz to generate a personalized AI learning roadmap.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 px-5 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all"
          >
            Find a Quiz
          </button>
        </GlassCard>
      ) : (
        <>
          {/* Level + Progress Banner */}
          <GlassCard className="border border-white/5 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Current Level</p>
                <div className="flex items-center space-x-3">
                  <span className={`text-2xl font-black ${levelConfig[pathData.currentLevel].textColor}`}>
                    {levelConfig[pathData.currentLevel].label}
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="text-sm text-gray-400">{completedCount} of {totalCount} topics mastered</span>
                </div>
              </div>
              <div className="sm:w-48">
                <div className="flex justify-between text-xs font-semibold text-gray-400 mb-1">
                  <span>Overall Progress</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-3 rounded-full bg-gradient-to-r ${levelConfig[pathData.currentLevel].gradient} transition-all duration-700`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Learning Roadmap Steps */}
            <div className="lg:col-span-2">
              <GlassCard className="border border-white/5 p-6 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>Your Roadmap</span>
                </h3>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-4 bottom-4 w-px bg-white/5" />
                  <div className="space-y-4">
                    {pathData.steps.map((step) => {
                      const isCompleted = step.status === 'completed';
                      const isCurrent = step.status === 'current';
                      const isUpcoming = step.status === 'upcoming';

                      return (
                        <div
                          key={step.topic}
                          className={`flex items-start space-x-4 relative transition-all ${isUpcoming ? 'opacity-40' : ''}`}
                        >
                          {/* Node icon */}
                          <div className={`z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                            isCompleted ? 'bg-emerald-500 border-emerald-500' :
                            isCurrent ? 'bg-indigo-600 border-indigo-400 animate-pulse' :
                            'bg-white/5 border-white/10'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4 text-white" />
                            ) : isCurrent ? (
                              <BrainCircuit className="w-4 h-4 text-white" />
                            ) : (
                              <Lock className="w-3 h-3 text-gray-600" />
                            )}
                          </div>

                          {/* Step content */}
                          <div className={`flex-1 pb-4 border-b border-white/5 last:border-0 ${isCurrent ? 'pb-6' : ''}`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-bold capitalize ${
                                isCompleted ? 'text-emerald-400' :
                                isCurrent ? 'text-white' : 'text-gray-500'
                              }`}>
                                {step.topic}
                              </span>
                              {isCompleted && (
                                <span className="text-xs font-bold text-emerald-400">{step.accuracy}%</span>
                              )}
                              {isCurrent && (
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                  Current
                                </span>
                              )}
                            </div>
                            {isCurrent && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  onClick={() => navigate('/dashboard')}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-all"
                                >
                                  Take Quiz →
                                </button>
                                <button
                                  onClick={() => navigate('/dashboard/practice')}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
                                >
                                  Practice
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Right panel: Radar + Recommendations */}
            <div className="space-y-6">
              {/* Skill Radar Chart */}
              {radarData.length > 0 && (
                <GlassCard className="border border-white/5 p-6">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center space-x-2">
                    <Circle className="w-4 h-4 text-purple-400" />
                    <span>Skill Profile</span>
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.05)" />
                      <PolarAngleAxis dataKey="topic" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Accuracy"
                        dataKey="accuracy"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.25}
                        dot={{ fill: '#6366f1', r: 3 }}
                      />
                      <Tooltip
                        contentStyle={{ background: '#0f1623', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        formatter={(v: any) => [`${v}%`, 'Accuracy']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </GlassCard>
              )}

              {/* Recommended Topics */}
              {pathData.recommendedTopics.length > 0 && (
                <GlassCard className="border border-white/5 p-6 space-y-3">
                  <h3 className="text-sm font-bold text-white">Focus Next</h3>
                  <div className="space-y-2">
                    {pathData.recommendedTopics.slice(0, 4).map((topic, i) => (
                      <div key={topic} className="flex items-center space-x-3">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-300 capitalize">{topic}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LearningPath;
