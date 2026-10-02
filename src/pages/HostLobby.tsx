import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';
import socket from '../services/socket';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { Users, Play, ArrowLeft, Award, ShieldAlert, Shield, History } from 'lucide-react';

interface Participant {
  _id: string;
  name: string;
  score: number;
  confidenceScore: number;
  confidenceAccuracyIndex: number;
  adaptiveScore: number;
  currentDifficulty: 'easy' | 'medium' | 'hard' | 'expert';
  questionsAnswered: number;
  correctStreak: number;
  wrongStreak: number;
  answers?: Array<{
    isCorrect: boolean;
  }>;
  isCompleted?: boolean;
  violationsCount?: number;
  riskScore?: number;
  riskCategory?: string;
  tabSwitchCount?: number;
  fullscreenExitCount?: number;
  cameraViolationCount?: number;
  securityAlerts?: Array<{
    eventType: string;
    message: string;
    timestamp: string;
  }>;
}

interface RoomData {
  _id: string;
  roomCode: string;
  status: string;
  quizId: {
    _id: string;
    title: string;
    description: string;
    isAdaptive?: boolean;
  };
  participants: Participant[];
  hostId: {
    _id: string;
    name: string;
  };
}

const HostLobby: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user } = useAuth();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'proctoring'>('leaderboard');

  useEffect(() => {
    if (!roomCode || !user) return;

    // 1. Fetch room details
    const fetchRoom = async () => {
      try {
        const response = await API.get(`/rooms/${roomCode}`);
        const roomData = response.data.room;

        // Verify authorization
        if (roomData.hostId._id !== user._id && user.role !== 'admin') {
          setError('You are not authorized to host this room');
          setLoading(false);
          return;
        }

        setRoom(roomData);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load quiz lobby');
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();

    // 2. Connect socket
    socket.connect();
    socket.emit('join-room', {
      roomCode,
      name: user.name,
      userId: user._id,
      role: 'host',
    });

    // 3. Socket Listeners
    socket.on('room-updated', (updatedRoom: RoomData) => {
      setRoom(updatedRoom);
    });

    socket.on('quiz-ended', () => {
      // Force reload of room details to trigger completed status UI
      API.get(`/rooms/${roomCode}`).then(res => {
        setRoom(res.data.room);
      }).catch(console.error);
    });

    socket.on('error', (errMsg: string) => {
      setError(errMsg);
    });

    return () => {
      socket.off('room-updated');
      socket.off('quiz-ended');
      socket.off('error');
      socket.disconnect();
    };
  }, [roomCode, user]);

  const handleStartQuiz = () => {
    if (!roomCode) return;
    socket.emit('start-quiz', { roomCode });
  };

  const handleEndQuiz = () => {
    if (!roomCode) return;
    if (window.confirm('Are you sure you want to end the quiz and show the final standings?')) {
      socket.emit('end-quiz', { roomCode });
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b11] px-4">
        <GlassCard className="w-full max-w-md border border-red-500/20 text-center p-8">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Unauthorized Host</h2>
          <p className="text-sm text-gray-400 mb-6">{error}</p>
          <Link
            to="/admin/quizzes"
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Quizzes</span>
          </Link>
        </GlassCard>
      </div>
    );
  }

  // --- 1. QUIZ COMPLETED VIEW (FINAL STANDINGS podium) ---
  if (room?.status === 'completed') {
    const sortedPlayers = [...(room.participants || [])].sort((a, b) => b.score - a.score);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b11] px-4 py-8">
        <div className="w-full max-w-4xl space-y-8 animate-fade-in">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-black text-white tracking-tight">Quiz Results</h1>
            <p className="text-sm text-gray-400 mt-2">
              Multiplayer Quiz session has concluded. Here is the final leaderboard podium!
            </p>
          </div>

          {/* Podiums Display */}
          <div className="flex flex-col md:flex-row items-end justify-center gap-6 pt-12 max-w-2xl mx-auto min-h-[250px]">
            {/* 2nd Place */}
            {sortedPlayers[1] && (
              <div className="flex flex-col items-center flex-1 order-2 md:order-1">
                <span className="text-sm font-bold text-gray-300 mb-2 truncate max-w-[120px]">
                  {sortedPlayers[1].name}
                </span>
                <div className="w-full bg-white/5 border border-white/10 rounded-t-2xl p-4 flex flex-col items-center justify-center min-h-[120px] shadow-lg">
                  <div className="w-10 h-10 bg-gray-400/20 text-gray-300 rounded-full flex items-center justify-center font-bold mb-2">2</div>
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Silver</span>
                  <span className="text-sm font-black text-white mt-1 font-mono">{sortedPlayers[1].score}</span>
                </div>
              </div>
            )}

            {/* 1st Place */}
            {sortedPlayers[0] && (
              <div className="flex flex-col items-center flex-1 order-1 md:order-2">
                <Award className="w-8 h-8 text-amber-400 animate-bounce mb-1" />
                <span className="text-base font-extrabold text-white mb-2 truncate max-w-[150px]">
                  {sortedPlayers[0].name}
                </span>
                <div className="w-full bg-indigo-600/10 border-2 border-indigo-500/40 rounded-t-2xl p-6 flex flex-col items-center justify-center min-h-[160px] shadow-xl shadow-indigo-600/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 rounded-full filter blur-xl" />
                  <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center font-extrabold mb-2 text-lg border border-amber-500/30">1</div>
                  <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">Champion</span>
                  <span className="text-lg font-black text-white mt-1 font-mono">{sortedPlayers[0].score}</span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {sortedPlayers[2] && (
              <div className="flex flex-col items-center flex-1 order-3">
                <span className="text-sm font-bold text-gray-300 mb-2 truncate max-w-[120px]">
                  {sortedPlayers[2].name}
                </span>
                <div className="w-full bg-white/5 border border-white/10 rounded-t-2xl p-4 flex flex-col items-center justify-center min-h-[90px] shadow-lg">
                  <div className="w-10 h-10 bg-amber-700/20 text-amber-600 rounded-full flex items-center justify-center font-bold mb-2">3</div>
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Bronze</span>
                  <span className="text-sm font-black text-white mt-1 font-mono">{sortedPlayers[2].score}</span>
                </div>
              </div>
            )}
          </div>

          {/* Full Leaderboard Listing */}
          <GlassCard className="border border-white/5 p-6 max-w-3xl mx-auto">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
              All Participants Standings
            </h3>
            <div className="divide-y divide-white/5">
              {sortedPlayers.map((player, idx) => {
                const corrects = player.answers?.filter(a => a.isCorrect).length || 0;
                const accuracy = player.questionsAnswered > 0 ? Math.round((corrects / player.questionsAnswered) * 100) : 0;
                return (
                  <div key={player._id} className="flex justify-between items-center py-3.5 text-sm text-gray-300">
                    <div className="flex items-center space-x-3">
                      <span className="w-6 font-black font-mono text-gray-500 text-center">{idx + 1}</span>
                      <span className="font-semibold text-white">{player.name}</span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                        ({player.questionsAnswered} ans)
                      </span>
                    </div>
                    <div className="flex items-center space-x-8">
                      <div className="text-right">
                        <span className="text-xs text-gray-500">Accuracy: </span>
                        <span className="font-mono text-emerald-400 font-bold">{accuracy}%</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500">Score: </span>
                        <span className="font-mono text-indigo-400 font-bold">{player.adaptiveScore}</span>
                      </div>
                      <span className="font-mono font-black text-white min-w-[100px] text-right">
                        {player.score} pts (Conf)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <div className="flex justify-center pt-4">
            <Link
              to="/admin/quizzes"
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-600/10 flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Management</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. ACTIVE LIVE MONITORING VIEW ---
  if (room?.status === 'active') {
    const sortedParticipants = [...(room.participants || [])].sort((a, b) => b.score - a.score);

    const difficultyLabels = {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      expert: 'Expert',
    };

    const difficultyTextColors = {
      easy: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
      medium: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
      hard: 'text-red-400 border-red-500/20 bg-red-500/5',
      expert: 'text-purple-400 border-purple-500/20 bg-purple-500/5',
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b11] px-4 py-8">
        <div className="w-full max-w-5xl space-y-6">
          {/* Header Panel */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400 bg-indigo-600/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                Live Session Active
              </span>
              <h1 className="text-2xl font-black text-white mt-2 leading-tight">
                {room.quizId.title}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Room PIN: <span className="font-mono font-bold text-indigo-300">{roomCode}</span> • Students are responding at their own pace.
              </p>
            </div>

            <button
              onClick={handleEndQuiz}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/10 transition-all flex items-center space-x-2"
            >
              <span>End Quiz & Show Standings</span>
            </button>
          </div>

          {/* Active Leaders monitoring dashboard */}
          <GlassCard className="border border-white/5 p-6 overflow-hidden">
            {/* Tab Selector */}
            <div className="flex border-b border-white/5 mb-6">
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 mr-6 flex items-center space-x-2 ${activeTab === 'leaderboard'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-400'
                  }`}
              >
                <Users className="w-4 h-4" />
                <span>Real-Time Leaderboard</span>
              </button>
              <button
                onClick={() => setActiveTab('proctoring')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center space-x-2 ${activeTab === 'proctoring'
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-400'
                  }`}
              >
                <Shield className="w-4 h-4" />
                <span>Live Proctoring Monitor</span>
              </button>
            </div>

            {activeTab === 'proctoring' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sortedParticipants.length === 0 ? (
                  <p className="text-gray-500 text-center py-12 col-span-2">No participants have joined the room yet.</p>
                ) : (
                  sortedParticipants.map((player) => {
                    return (
                      <div key={player._id} className="bg-white/2 border border-white/5 rounded-2xl p-5 space-y-4 hover:border-white/10 transition-all">
                        {/* Player Header Info */}
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h4 className="text-base font-bold text-white leading-tight truncate max-w-[180px]">{player.name}</h4>
                            <span className={`inline-block text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border mt-1.5 ${player.isCompleted
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse'
                              }`}>
                              {player.isCompleted ? 'Finished' : 'Answering'}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border inline-block ${player.riskCategory === 'High Risk'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
                                : player.riskCategory === 'Medium Risk'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                              {player.riskCategory || 'Low Risk'} ({player.riskScore || 0}%)
                            </span>
                          </div>
                        </div>

                        {/* Violation grid */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-white/3 border border-white/5 rounded-xl p-3 font-mono">
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Tab switches</p>
                            <p className="text-white font-bold">{player.tabSwitchCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Screen Exits</p>
                            <p className="text-white font-bold">{player.fullscreenExitCount || 0}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Camera Alert</p>
                            <p className="text-white font-bold">{player.cameraViolationCount || 0}</p>
                          </div>
                        </div>

                        {/* Recent log feed */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block flex items-center space-x-1">
                            <History className="w-3.5 h-3.5" />
                            <span>Incident Logs</span>
                          </span>
                          <div className="bg-black/35 border border-white/5 rounded-xl p-3 max-h-[110px] overflow-y-auto text-[10px] font-mono space-y-1 text-gray-400 scrollbar-thin">
                            {!player.securityAlerts || player.securityAlerts.length === 0 ? (
                              <p className="text-gray-600 text-center py-3">No proctoring violations recorded.</p>
                            ) : (
                              [...player.securityAlerts].reverse().map((alert, aIdx) => {
                                const time = new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                return (
                                  <div key={aIdx} className="flex justify-between items-start gap-2 border-b border-white/3 pb-1 last:border-0 last:pb-0">
                                    <span className="text-amber-500 leading-snug">{alert.message}</span>
                                    <span className="text-gray-600 whitespace-nowrap">{time}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/3 text-gray-400 border-b border-white/5 text-[10px] font-extrabold uppercase tracking-wider">
                      <th className="px-6 py-4">Rank & Player</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Difficulty Tier</th>
                      <th className="px-6 py-4 text-center">Accuracy %</th>
                      <th className="px-6 py-4 text-center">Confidence Score</th>
                      <th className="px-6 py-4 text-right">Adaptive Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm text-gray-300 font-medium">
                    {sortedParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          No participants are in this room
                        </td>
                      </tr>
                    ) : (
                      sortedParticipants.map((player, idx) => {
                        const corrects = player.answers?.filter(a => a.isCorrect).length || 0;
                        const accuracy = player.questionsAnswered > 0 ? Math.round((corrects / player.questionsAnswered) * 100) : 0;
                        return (
                          <tr key={player._id} className="hover:bg-white/2 transition-colors">
                            <td className="px-6 py-4 flex items-center space-x-3">
                              <span className="font-mono text-gray-500 text-xs font-bold">{idx + 1}</span>
                              <div>
                                <p className="font-bold text-white leading-tight">{player.name}</p>
                                <span className="text-[10px] text-gray-500 font-mono">
                                  {player.questionsAnswered} answered
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.75 rounded-full border ${player.isCompleted
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse'
                                }`}>
                                {player.isCompleted ? 'Finished' : 'Answering'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`text-[10px] font-extrabold uppercase border px-2.5 py-0.75 rounded-full ${difficultyTextColors[player.currentDifficulty]
                                }`}>
                                {difficultyLabels[player.currentDifficulty]}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-mono font-bold text-emerald-400">
                              {accuracy}%
                            </td>
                            <td className="px-6 py-4 text-center font-mono font-black text-indigo-400 text-base">
                              {player.score}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-white">
                              {player.adaptiveScore}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    );
  }

  // --- 3. WAITING LOBBY VIEW ---
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b11] px-4 py-8">
      {/* Top Navigation */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <Link
          to="/admin/quizzes"
          className="flex items-center space-x-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Leave Lobby</span>
        </Link>
        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
          Multiplayer Host Mode
        </span>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PIN Code and Info Panel */}
        <div className="lg:col-span-1 space-y-6">
          <GlassCard className="border border-white/5 p-6 text-center">
            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-400 bg-indigo-600/10 border border-indigo-500/20 px-3 py-1 rounded-full">
              Join Code
            </span>
            <h1 className="text-5xl font-black tracking-widest text-white mt-4 font-mono select-all">
              {roomCode}
            </h1>
            <p className="text-xs text-gray-400 mt-2">
              Share this PIN code with your students to let them join the quiz from their devices!
            </p>
            <div className="mt-4 pt-3 border-t border-white/5 text-left space-y-1.5">
              <span className="text-[10px] text-gray-500 font-bold uppercase block tracking-wider">Shareable Student Link</span>
              <div className="flex items-center bg-white/3 border border-white/5 rounded-lg px-2 py-1 justify-between gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/multiplayer/join?code=${roomCode}`}
                  className="bg-transparent text-[11px] text-indigo-300 font-mono focus:outline-none flex-1 truncate select-all"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/multiplayer/join?code=${roomCode}`);
                  }}
                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-[9px] text-white rounded font-bold transition-all active:scale-95 flex-shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="border border-white/5 p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Quiz Selected
            </h3>
            <h2 className="text-lg font-bold text-white leading-tight">
              {room?.quizId?.title}
            </h2>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              {room?.quizId?.description}
            </p>
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs">
              <span className="text-gray-500 font-medium">Topic Context</span>
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded uppercase font-bold text-[10px]">
                {room?.quizId?.isAdaptive ? 'Adaptive' : 'Static'}
              </span>
            </div>
          </GlassCard>

          <button
            onClick={handleStartQuiz}
            disabled={room?.participants?.length === 0}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/10 transition-all flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Multiplayer Quiz</span>
          </button>
        </div>

        {/* Players List Panel */}
        <div className="lg:col-span-2">
          <GlassCard className="h-full border border-white/5 p-8 flex flex-col justify-between min-h-[400px]">
            <div>
              <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Joined Players</span>
                </h3>
                <span className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full font-bold">
                  {room?.participants?.length || 0} Connected
                </span>
              </div>

              {room?.participants?.length === 0 ? (
                <div className="text-center py-16 text-gray-500 space-y-2">
                  <p className="font-semibold text-white">Waiting for players to connect...</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">
                    Students can enter the join code on the Student Join page to enter this waiting lobby.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {room?.participants?.map((participant) => (
                    <div
                      key={participant._id}
                      className="px-4 py-3 rounded-xl bg-white/3 border border-white/5 hover:border-indigo-500/30 text-center font-bold text-sm text-gray-200 transition-all truncate animate-fade-in"
                    >
                      {participant.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {room?.participants?.length === 0 && (
              <div className="text-center border-t border-white/5 pt-4 mt-6">
                <p className="text-xs text-gray-500 font-medium">
                  The start button will activate once at least one player has joined the room.
                </p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default HostLobby;
