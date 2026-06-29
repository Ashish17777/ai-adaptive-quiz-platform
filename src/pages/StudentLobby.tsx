import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../services/api';
import socket from '../services/socket';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useExamSecurity } from '../hooks/useExamSecurity';
import {
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Trophy,
  Flame,
  Shield,
  ShieldAlert,
  Video,
  AlertTriangle,
  Lock,
  Monitor,
  Copy,
  Eye,
  Camera,
} from 'lucide-react';

interface SecuritySettings {
  enforceSecurity: boolean;
  allowedTabSwitches: number;
  fullScreenEnforced: boolean;
  cameraMonitoring: boolean;
  violationLimits: number;
}

interface Participant {
  _id: string;
  name: string;
  score: number;
  currentDifficulty: string;
  questionsAnswered: number;
  correctStreak: number;
  isCompleted?: boolean;
  violationsCount?: number;
  riskScore?: number;
  riskCategory?: string;
  answers?: Array<{
    isCorrect: boolean;
    confidenceLevel?: string;
    timeTaken?: number;
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
    securitySettings?: SecuritySettings;
  };
  participants: Participant[];
}

interface ActiveQuestion {
  _id: string;
  questionText: string;
  options: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  topic: string;
}

interface AnswerFeedback {
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string;
}

const StudentLobby: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [playerInfo, setPlayerInfo] = useState<{ name: string; userId: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active quiz states
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(8);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [quizFinished, setQuizFinished] = useState(false);
  const [finalScore, setFinalScore] = useState({ score: 0, adaptiveScore: 0 });
  const [confidenceLevel, setConfidenceLevel] = useState<'low' | 'medium' | 'high' | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [autoSubmitReason, setAutoSubmitReason] = useState<string | null>(null);

  const {
    isFullscreen,
    tabSwitches,
    violationsCount,
    riskScore,
    riskCategory,
    cameraActive,
    requestFullscreen,
    securityAlerts,
    setTabSwitches,
    setViolationsCount,
    setRiskScore,
    setRiskCategory,
    setSecurityAlerts,
  } = useExamSecurity({
    attemptId: null,
    quizId: room?.quizId?._id || null,
    settings: room?.quizId?.securitySettings,
    onAutoSubmitTriggered: (reason) => {
      setAutoSubmitReason(reason);
      setQuizFinished(true);
    },
    onViolationWarning: (msg) => {
      setWarningMessage(msg);
      setTimeout(() => setWarningMessage(null), 5000);
    },
    onSecurityEvent: (eventType, metadata) => {
      socket.emit('student-security-event', {
        roomCode,
        eventType,
        metadata,
      });
    },
    isActive: room?.status === 'active' && !quizFinished && !autoSubmitReason,
  });

  const handleFinishEarly = () => {
    if (!roomCode) return;
    if (window.confirm('Are you sure you want to finish the quiz early? Your progress will be submitted.')) {
      socket.emit('finish-multiplayer-quiz', { roomCode });
    }
  };

  useEffect(() => {
    if (!roomCode) return;

    // 1. Fetch player info from localStorage
    const savedPlayer = localStorage.getItem(`room_player_${roomCode}`);
    if (!savedPlayer) {
      navigate('/multiplayer/join');
      return;
    }

    const parsedPlayer = JSON.parse(savedPlayer);
    setPlayerInfo(parsedPlayer);

    // 2. Fetch initial room info
    const fetchRoom = async () => {
      try {
        const response = await API.get(`/rooms/${roomCode}`);
        setRoom(response.data.room);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Lobby connection failed');
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();

    // 3. Connect socket
    socket.connect();
    socket.emit('join-room', {
      roomCode,
      name: parsedPlayer.name,
      userId: parsedPlayer.userId,
      role: 'student',
    });

    // 4. Socket Listeners
    socket.on('room-updated', (updatedRoom: RoomData) => {
      setRoom(updatedRoom);
      
      // Auto-trigger get-next-question if the status turns active and we don't have a question yet
      if (updatedRoom.status === 'active' && !activeQuestion && !quizFinished) {
        socket.emit('get-next-question', { roomCode });
      }
    });

    socket.on('quiz-started', () => {
      socket.emit('get-next-question', { roomCode });
    });

    socket.on('next-question', (data: { question: ActiveQuestion; questionNumber: number; totalQuestions: number }) => {
      setActiveQuestion(data.question);
      setQuestionNumber(data.questionNumber);
      setTotalQuestions(data.totalQuestions);
      setSelectedOption(null);
      setConfidenceLevel(null);
      setQuestionStartTime(Date.now());
      setFeedback(null);
      setSubmittingAnswer(false);
    });

    socket.on('answer-feedback', (data: AnswerFeedback) => {
      setFeedback(data);
      setSubmittingAnswer(false);
    });

    socket.on('quiz-finished', (data: { score: number; adaptiveScore: number }) => {
      setQuizFinished(true);
      setFinalScore(data);
    });

    socket.on('security-auto-submit', (data: { reason: string }) => {
      setAutoSubmitReason(data.reason);
      setQuizFinished(true);
    });

    socket.on('violation_detected', (data: { eventType: string; violationsCount: number; maxViolations: number; securityAlerts?: any[] }) => {
      setViolationsCount(data.violationsCount);
      if (data.securityAlerts) {
        setSecurityAlerts(data.securityAlerts);
      }
    });

    socket.on('risk_score_updated', (data: { riskScore: number; riskCategory: string }) => {
      setRiskScore(data.riskScore);
      setRiskCategory(data.riskCategory);
    });

    socket.on('attempts_remaining_updated', (data: { attemptsRemaining: number }) => {
      // synced via violationsCount recalculations
    });

    socket.on('exam_terminated', (data: { reason: string }) => {
      setAutoSubmitReason(data.reason);
      setQuizFinished(true);
    });

    socket.on('quiz-ended', () => {
      // Refresh room data to transition to final podium/leaderboard
      API.get(`/rooms/${roomCode}`).then(res => {
        setRoom(res.data.room);
      }).catch(console.error);
    });

    socket.on('error', (errMsg: string) => {
      setError(errMsg);
    });

    return () => {
      socket.off('room-updated');
      socket.off('quiz-started');
      socket.off('next-question');
      socket.off('answer-feedback');
      socket.off('quiz-finished');
      socket.off('security-auto-submit');
      socket.off('violation_detected');
      socket.off('risk_score_updated');
      socket.off('attempts_remaining_updated');
      socket.off('exam_terminated');
      socket.off('quiz-ended');
      socket.off('error');
      socket.disconnect();
    };
  }, [roomCode, navigate, activeQuestion, quizFinished]);

  const handleSubmitAnswer = () => {
    if (selectedOption === null || !activeQuestion || submittingAnswer || confidenceLevel === null) return;
    setSubmittingAnswer(true);

    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);

    socket.emit('submit-multiplayer-answer', {
      roomCode,
      questionId: activeQuestion._id,
      answerIndex: selectedOption,
      confidenceLevel,
      timeTaken: elapsed,
    });
  };

  const handleNextQuestion = () => {
    socket.emit('get-next-question', { roomCode });
  };

  if (loading) return <LoadingSpinner fullPage />;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b11] px-4">
        <GlassCard className="w-full max-w-md border border-red-500/20 text-center p-8">
          <h2 className="text-xl font-bold text-red-400 mb-2">Lobby Error</h2>
          <p className="text-sm text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/multiplayer/join')}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition-all"
          >
            Go Back
          </button>
        </GlassCard>
      </div>
    );
  }

  // --- LEADERBOARD PODIUM SCREEN (When status is completed) ---
  if (room?.status === 'completed') {
    const sortedPlayers = [...(room.participants || [])].sort((a, b) => b.score - a.score);
    const playerRank = sortedPlayers.findIndex(p => p.name === playerInfo?.name) + 1;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b11] px-4 py-8">
        <GlassCard className="w-full max-w-2xl border border-indigo-500/30 p-8 text-center space-y-8 animate-fade-in">
          <div>
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Final Leaderboard</h2>
            <p className="text-sm text-gray-400 mt-2">
              The host has ended the quiz. Here is how everyone performed!
            </p>
          </div>

          {/* Player Rank Alert */}
          <div className="p-4 bg-indigo-600/15 border border-indigo-500/30 rounded-2xl">
            <p className="text-sm text-indigo-300 font-semibold">
              You finished at <span className="text-white text-lg font-black font-mono">#{playerRank}</span> place with <span className="text-white font-bold">{room.participants.find(p => p.name === playerInfo?.name)?.score}</span> points!
            </p>
          </div>

          {/* Leaders List */}
          <div className="space-y-3 text-left">
            {sortedPlayers.slice(0, 5).map((player, index) => {
              const corrects = player.answers?.filter((a: any) => a.isCorrect).length || 0;
              const accuracy = player.questionsAnswered > 0 ? Math.round((corrects / player.questionsAnswered) * 100) : 0;
              return (
                <div
                  key={player._id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    player.name === playerInfo?.name
                      ? 'bg-indigo-600/10 border-indigo-500/40 text-white font-bold'
                      : 'bg-white/2 border-white/5 text-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black font-mono ${
                      index === 0
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : index === 1
                        ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30'
                        : index === 2
                        ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30'
                        : 'bg-white/5 text-gray-500 border border-white/5'
                    }`}>
                      {index + 1}
                    </span>
                    <span>{player.name}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs font-mono">
                    <span className="text-emerald-400">{accuracy}% Acc</span>
                    <span className="text-gray-500">|</span>
                    <span className="text-white font-bold">{player.score} pts</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full py-3 mt-4 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            Return to Homepage
          </button>
        </GlassCard>
      </div>
    );
  }

  // --- DYNAMIC ACTIVE QUIZ SCREEN ---
  if (room?.status === 'active') {
    if (quizFinished) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b11] px-4">
          <GlassCard className="w-full max-w-lg border border-white/5 p-8 text-center space-y-6">
            {autoSubmitReason ? (
              <div className="inline-flex p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full">
                <ShieldAlert className="w-12 h-12 animate-pulse" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {autoSubmitReason ? 'Assessment Suspended' : 'Assessment Completed!'}
              </h2>
              <p className="text-sm text-gray-400 mt-2">
                {autoSubmitReason 
                  ? `This attempt was automatically submitted due to security policy breaches: ${autoSubmitReason}`
                  : 'Your answers have been submitted. Wait for the host to display final standings.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-white/2 p-4 rounded-xl border border-white/5 font-mono text-center">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Final Score</p>
                <p className="text-2xl font-black text-white mt-1">
                  {room.participants.find(p => p.name === playerInfo?.name)?.score || 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Adaptive Score</p>
                <p className="text-2xl font-black text-indigo-400 mt-1">
                  {room.participants.find(p => p.name === playerInfo?.name)?.adaptiveScore || 0}
                </p>
              </div>
            </div>

            <div className="flex justify-center space-x-2 items-center text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span>Waiting for host to close the room...</span>
            </div>
          </GlassCard>
        </div>
      );
    }

    if (!activeQuestion) return <LoadingSpinner fullPage />;

    const difficultyColors = {
      easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      hard: 'bg-red-500/10 text-red-400 border-red-500/20',
      expert: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };

    const currentPlayer = room.participants.find(p => p.name === playerInfo?.name);
    const securitySettings = room.quizId.securitySettings;

    const needsFullscreenBlock =
      securitySettings?.enforceSecurity &&
      securitySettings?.fullScreenEnforced &&
      !isFullscreen &&
      !autoSubmitReason;

    return (
      <div className="min-h-screen bg-[#070b11] px-4 py-8 relative select-none">
        {/* ⚠️ Suspicious Violations Notification Banner */}
        {warningMessage && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md bg-amber-500/90 backdrop-blur-md border border-amber-600 text-black px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-3 transition-all duration-300">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 animate-bounce" />
            <div>
              <p className="text-sm font-extrabold">Exam Violation Warning</p>
              <p className="text-xs font-semibold">{warningMessage}</p>
            </div>
          </div>
        )}

        {/* 🔒 Fullscreen Lockdown Gate */}
        {needsFullscreenBlock && (
          <div className="fixed inset-0 z-40 bg-[#070b11]/95 backdrop-blur-sm flex items-center justify-center p-4 select-none">
            <GlassCard className="max-w-md w-full border border-indigo-500/20 text-center p-8 space-y-6">
              <div className="inline-flex p-4 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full animate-bounce">
                <Shield className="w-12 h-12" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Fullscreen Mode Required</h3>
                <p className="text-sm text-gray-400 mt-2">
                  To prevent cheating, this assessment can only be taken in full screen mode.
                </p>
              </div>
              <button
                onClick={requestFullscreen}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white text-sm shadow-lg shadow-indigo-600/20 transition-all"
              >
                Resume Lockdown Full Screen
              </button>
            </GlassCard>
          </div>
        )}

        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
          {/* Left Column: Student Status & Integrity Monitor */}
          <div className="w-full lg:w-72 space-y-6">
            {/* Player details */}
            <GlassCard className="border border-white/5 p-6 space-y-4">
              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Participant</span>
                <h2 className="text-xl font-black text-white truncate mt-1">
                  {playerInfo?.name}
                </h2>
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Points</span>
                  <span className="text-lg font-mono font-black text-white">
                    {currentPlayer?.score || 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Streak</span>
                  <span className="text-lg font-mono font-black text-indigo-400 flex items-center space-x-1">
                    <Flame className="w-4 h-4 fill-indigo-500 mr-0.5" />
                    <span>{currentPlayer?.correctStreak || 0}</span>
                  </span>
                </div>
              </div>
              
              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-gray-400">Difficulty Tier:</span>
                <span className={`text-[10px] font-extrabold uppercase border px-2 py-0.5 rounded-full ${
                  difficultyColors[activeQuestion.difficulty]
                }`}>
                  {activeQuestion.difficulty}
                </span>
              </div>
            </GlassCard>

            {/* Integrity Monitor Card (webcam snap & logs) */}
            {securitySettings?.enforceSecurity && (
              <GlassCard className="border border-white/5 p-6 space-y-4">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center space-x-1.5 border-b border-white/5 pb-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>Integrity Monitor</span>
                </h3>

                {/* Webcam Status */}
                {securitySettings.cameraMonitoring && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Webcam Status</span>
                    <div className="aspect-video w-full rounded-lg bg-black/40 border border-white/5 flex items-center justify-center relative overflow-hidden">
                      {cameraActive ? (
                        <div className="absolute inset-0 bg-emerald-500/10 flex flex-col items-center justify-center text-[10px] font-bold text-emerald-400 uppercase tracking-widest animate-pulse">
                          <Video className="w-4 h-4 mb-1" />
                          <span>Camera Active</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider text-center p-3">
                          Initializing Camera...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fullscreen Status */}
                {securitySettings.fullScreenEnforced && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Fullscreen Lock</span>
                    </span>
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                      isFullscreen ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
                    }`}>
                      {isFullscreen ? 'Active' : 'Required'}
                    </span>
                  </div>
                )}

                {/* Tab switches */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Tab Switches</span>
                  </span>
                  <span className={`text-xs font-mono font-bold ${tabSwitches >= securitySettings.allowedTabSwitches ? 'text-red-400' : 'text-white'}`}>
                    {tabSwitches} / {securitySettings.allowedTabSwitches}
                  </span>
                </div>

                {/* Total violations */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Total Violations</span>
                  </span>
                  <span className={`text-xs font-mono font-bold ${
                    violationsCount >= securitySettings.violationLimits ? 'text-red-400' : 'text-white'
                  }`}>
                    {violationsCount} / {securitySettings.violationLimits}
                  </span>
                </div>

                {/* Remaining Attempts */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Remaining Attempts</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {Math.max(0, securitySettings.violationLimits - violationsCount)}
                  </span>
                </div>

                {/* Risk Level Badge */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-xs text-gray-400">Risk Assessment:</span>
                  <span className={`text-[10px] font-extrabold uppercase border px-2 py-0.5 rounded-full ${
                    riskCategory === 'High Risk'
                      ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
                      : riskCategory === 'Medium Risk'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {riskCategory} ({riskScore}%)
                  </span>
                </div>

                {/* Recent Violations History List */}
                <div className="pt-3 border-t border-white/5 space-y-1.5">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block">Recent Violations</span>
                  <div className="bg-black/35 border border-white/5 rounded-xl p-3 max-h-24 overflow-y-auto text-[10px] font-mono space-y-1 text-gray-400 scrollbar-thin font-sans">
                    {securityAlerts.length === 0 ? (
                      <p className="text-gray-600 text-center py-2">No proctoring violations recorded.</p>
                    ) : (
                      securityAlerts.map((alert, idx) => (
                        <div key={idx} className="flex justify-between items-start gap-2 border-b border-white/3 pb-1 last:border-0 last:pb-0">
                          <span className="text-amber-500 leading-snug">{alert.message}</span>
                          <span className="text-gray-600 whitespace-nowrap">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Finish Button */}
            <button
              onClick={handleFinishEarly}
              className="w-full py-3.5 bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 font-extrabold text-sm rounded-xl transition-all shadow-md shadow-red-950/20 flex items-center justify-center space-x-2"
            >
              <XCircle className="w-4 h-4" />
              <span>Finish Quiz</span>
            </button>
          </div>

          {/* Right Column: Question Card Panel */}
          <div className="flex-1 space-y-6">
            {/* Header Panel */}
            <GlassCard className="border border-white/5 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">{room?.quizId?.title}</h3>
                  <div className="flex items-center space-x-2.5 mt-2">
                    <span className="text-xs text-gray-400 font-medium">
                      Question {questionNumber} of {totalQuestions}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="text-xs text-indigo-400 font-medium uppercase font-mono">
                      {activeQuestion.topic}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/5 h-2 rounded-full mt-6 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
                />
              </div>
            </GlassCard>

            {/* Prompt Display Card */}
            <GlassCard className="border border-white/5 p-6 sm:p-8 space-y-6 relative">
              <div className="space-y-4">
                <span className="w-fit px-3 py-1 rounded bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                  Question Prompt
                </span>
                <h4 className="text-lg sm:text-xl font-bold text-white leading-relaxed mt-2">
                  {activeQuestion.questionText}
                </h4>
              </div>

              {/* Options grid */}
              <div className="space-y-3 pt-4">
                {activeQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  let optStyle = 'bg-transparent border-white/5 text-gray-300 hover:bg-white/3 hover:border-white/10';
                  let indicatorStyle = 'bg-white/5 border-white/5 text-gray-500';

                  if (feedback) {
                    const isCorrectAnswer = feedback.correctAnswer === idx;
                    if (isCorrectAnswer) {
                      optStyle = 'bg-emerald-500/10 border-emerald-500 text-emerald-400';
                      indicatorStyle = 'bg-emerald-500 border-emerald-400 text-white';
                    } else if (isSelected) {
                      optStyle = 'bg-red-500/10 border-red-500 text-red-400';
                      indicatorStyle = 'bg-red-500 border-red-400 text-white';
                    } else {
                      optStyle = 'bg-transparent border-white/5 text-gray-500 opacity-40';
                    }
                  } else if (isSelected) {
                    optStyle = 'bg-indigo-600/10 border-indigo-500 text-indigo-400 shadow-md shadow-indigo-500/5';
                    indicatorStyle = 'bg-indigo-600 border-indigo-400 text-white';
                  }

                  return (
                    <button
                      key={idx}
                      disabled={!!feedback || submittingAnswer}
                      onClick={() => setSelectedOption(idx)}
                      className={`w-full flex items-center space-x-4 px-4 py-4 rounded-xl border text-left text-sm font-semibold transition-all ${optStyle}`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold border transition-colors ${indicatorStyle}`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1 leading-snug">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Confidence level selector */}
              {!feedback && (
                <div className="border-t border-white/5 pt-6 space-y-3">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                    Confidence Level:
                  </span>
                  <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2.5 sm:space-y-0">
                    {['low', 'medium', 'high'].map((level) => {
                      const isSelected = confidenceLevel === level;
                      const levelColors = {
                        low: 'border-blue-500/10 text-blue-400 hover:bg-blue-500/5',
                        medium: 'border-amber-500/10 text-amber-400 hover:bg-amber-500/5',
                        high: 'border-rose-500/10 text-rose-400 hover:bg-rose-500/5',
                      };
                      const selectedBgColors = {
                        low: 'bg-blue-600/15 border-blue-500 text-blue-400',
                        medium: 'bg-amber-600/15 border-amber-500 text-amber-400',
                        high: 'bg-rose-600/15 border-rose-500 text-rose-400',
                      };

                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setConfidenceLevel(level as any)}
                          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border text-xs font-extrabold uppercase tracking-wide transition-all ${
                            isSelected
                              ? selectedBgColors[level as 'low' | 'medium' | 'high']
                              : 'bg-transparent border-white/5 text-gray-400 hover:border-white/10 ' + levelColors[level as 'low' | 'medium' | 'high']
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-current' : 'border-gray-600'
                            }`}
                          >
                            {isSelected && (
                              <span className="w-1.5 h-1.5 bg-current rounded-full" />
                            )}
                          </span>
                          <span>{level} Confidence</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Feedback & Actions Footer */}
            {feedback ? (
              <GlassCard className={`border p-6 space-y-4 animate-fade-in ${
                feedback.isCorrect ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
              }`}>
                <div className="flex items-center space-x-2.5">
                  {feedback.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <h4 className={`text-sm font-bold ${feedback.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                    {feedback.isCorrect ? 'Correct Answer!' : 'Incorrect Choice'}
                  </h4>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {feedback.explanation}
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={handleNextQuestion}
                    className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-md transition-all"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </GlassCard>
            ) : (
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitAnswer}
                  disabled={selectedOption === null || confidenceLevel === null || submittingAnswer}
                  className="flex items-center space-x-2 px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 transition-all"
                >
                  <span>{submittingAnswer ? 'Evaluating...' : 'Submit Choice'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- LOBBY WAITING SCREEN ---
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b11] px-4 py-8">
      {/* Lobby Header Card */}
      <GlassCard className="w-full max-w-2xl border border-white/5 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider bg-indigo-600/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400">
              Lobby Code
            </span>
            <h1 className="text-4xl font-black tracking-widest text-white mt-2 font-mono">
              {roomCode}
            </h1>
            <h2 className="text-lg font-bold text-gray-300 mt-2">
              {room?.quizId?.title}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {room?.quizId?.description}
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-white/3 border border-white/5 rounded-2xl p-4 self-start md:self-auto min-w-[150px] justify-center">
            <Users className="w-6 h-6 text-indigo-400" />
            <div>
              <p className="text-2xl font-black text-white">{room?.participants?.length || 0}</p>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Players In</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Main Wait Card */}
      <GlassCard className="w-full max-w-2xl border border-white/5 p-8 flex flex-col items-center">
        {/* Waiting Loader */}
        <div className="flex flex-col items-center space-y-3 mb-8">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm font-semibold text-gray-300">
            Waiting for host to start the quiz...
          </p>
          <p className="text-xs text-gray-500">
            Logged in as <span className="text-indigo-400 font-bold">{playerInfo?.name}</span>
          </p>
        </div>

        {/* Players List Section */}
        <div className="w-full">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
            Participants ({room?.participants?.length || 0})
          </h3>

          {room?.participants?.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Connecting you to the room list...</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {room?.participants?.map((participant) => (
                <div
                  key={participant._id}
                  className={`px-4 py-3 rounded-xl border text-center font-semibold text-sm transition-all truncate ${
                    participant.name === playerInfo?.name
                      ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300 shadow-md shadow-indigo-500/5'
                      : 'bg-white/2 border-white/5 text-gray-300'
                  }`}
                >
                  {participant.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default StudentLobby;
