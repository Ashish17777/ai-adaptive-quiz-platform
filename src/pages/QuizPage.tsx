import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useExamSecurity } from '../hooks/useExamSecurity';
import socket from '../services/socket';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ShieldAlert,
  Sparkles,
  BrainCircuit,
  Shield,
  Video,
  AlertTriangle,
  Eye,
  Copy,
  Maximize,
  Camera,
  Monitor,
  Timer,
  Lock,
} from 'lucide-react';

interface Question {
  _id: string;
  questionText: string;
  options: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  topic: string;
}

interface SecuritySettings {
  enforceSecurity: boolean;
  allowedTabSwitches: number;
  fullScreenEnforced: boolean;
  cameraMonitoring: boolean;
  violationLimits: number;
}

interface Quiz {
  _id: string;
  title: string;
  description: string;
  isAdaptive: boolean;
  topic?: string;
  questions?: Question[];
  securitySettings?: SecuritySettings;
}

const QuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active quiz playing states
  const [quizStarted, setQuizStarted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(1);

  // Static quiz variables
  const [staticAnswers, setStaticAnswers] = useState<number[]>([]);
  const [currentStaticIndex, setCurrentStaticIndex] = useState(0);
  const [totalQuestionsState, setTotalQuestionsState] = useState(0);

  // General selection
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Phase 4 Confidence and Time Tracking
  const [confidenceLevel, setConfidenceLevel] = useState<'low' | 'medium' | 'high' | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [staticConfidences, setStaticConfidences] = useState<(string | null)[]>([]);
  const [staticTimes, setStaticTimes] = useState<number[]>([]);

  // Security warning state and auto-submit state
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [autoSubmitReason, setAutoSubmitReason] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuizDetails = async () => {
      try {
        const response = await API.get(`/quizzes/${quizId}`);
        setQuiz(response.data.quiz);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading quiz details');
      } finally {
        setLoading(false);
      }
    };
    fetchQuizDetails();
  }, [quizId]);

  const securitySettings = quiz?.securitySettings;

  // Integrate custom security monitoring hook
  const {
    isFullscreen,
    tabSwitches,
    violationsCount,
    riskScore,
    riskCategory,
    cameraActive,
    requestFullscreen,
    securityAlerts,
    setViolationsCount,
    setRiskScore,
    setRiskCategory,
    setSecurityAlerts,
  } = useExamSecurity({
    attemptId,
    quizId: quiz?._id || null,
    settings: securitySettings,
    onAutoSubmitTriggered: (reason) => {
      setAutoSubmitReason(reason);
      // Trigger redirect to results page after a brief notification delay
      setTimeout(() => {
        if (attemptId) {
          navigate(`/result/${attemptId}`);
        }
      }, 5000);
    },
    onViolationWarning: (msg) => {
      setWarningMessage(msg);
      setTimeout(() => setWarningMessage(null), 5500);
    },
    isActive: quizStarted && !autoSubmitReason,
  });

  // Socket connection and real-time security synchronization
  useEffect(() => {
    if (!attemptId) return;

    socket.connect();
    socket.emit('join-attempt', { attemptId });

    socket.on('violation_detected', (data: any) => {
      if (data.violationsCount !== undefined) {
        setViolationsCount(data.violationsCount);
      }
      if (data.securityAlerts) {
        setSecurityAlerts(data.securityAlerts);
      }
    });

    socket.on('risk_score_updated', (data: any) => {
      if (data.riskScore !== undefined) {
        setRiskScore(data.riskScore);
      }
      if (data.riskCategory) {
        setRiskCategory(data.riskCategory);
      }
    });

    socket.on('security-auto-submit', (data: any) => {
      setAutoSubmitReason(data.reason || 'Excessive security violations');
      setTimeout(() => {
        navigate(`/result/${attemptId}`);
      }, 5000);
    });

    socket.on('exam_terminated', (data: any) => {
      setAutoSubmitReason(data.reason || 'Exam terminated by system');
      setTimeout(() => {
        navigate(`/result/${attemptId}`);
      }, 5000);
    });

    return () => {
      socket.off('violation_detected');
      socket.off('risk_score_updated');
      socket.off('security-auto-submit');
      socket.off('exam_terminated');
      socket.disconnect();
    };
  }, [attemptId, navigate, setViolationsCount, setRiskScore, setRiskCategory, setSecurityAlerts]);

  // Handle static question shuffles dynamically when index moves
  useEffect(() => {
    if (!quizStarted || quiz?.isAdaptive || !attemptId) return;

    const fetchQuestion = async () => {
      try {
        setLoadingQuestion(true);
        const response = await API.get(`/attempts/${attemptId}/question/${currentStaticIndex}`);
        setActiveQuestion(response.data.question);

        // Restore previously selected answers/confidences and reset timer
        const prevAnswer = staticAnswers[currentStaticIndex];
        setSelectedOptionIndex(prevAnswer !== -1 ? prevAnswer : null);
        setConfidenceLevel(staticConfidences[currentStaticIndex] as any);
        setQuestionStartTime(Date.now());
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading secure question');
      } finally {
        setLoadingQuestion(false);
      }
    };
    fetchQuestion();
  }, [quizStarted, currentStaticIndex, attemptId, quiz?.isAdaptive]);

  const handleStart = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await API.post('/attempts', { quizId });
      const data = response.data;
      setAttemptId(data.attemptId);

      setQuestionStartTime(Date.now());
      setConfidenceLevel(null);

      if (data.isAdaptive) {
        setQuizStarted(true);
        setActiveQuestion(data.question);
        setActiveQuestionIndex(data.currentQuestionIndex);
      } else {
        // Static Quiz loading
        const totalQ = data.totalQuestions || (quiz?.questions?.length || 0);
        setTotalQuestionsState(totalQ);
        setStaticAnswers(new Array(totalQ).fill(-1));
        setStaticConfidences(new Array(totalQ).fill(null));
        setStaticTimes(new Array(totalQ).fill(0));
        setCurrentStaticIndex(0);
        setQuizStarted(true);
      }

      // Automatically request fullscreen if lock mode is enforced
      if (quiz?.securitySettings?.enforceSecurity && quiz?.securitySettings?.fullScreenEnforced) {
        setTimeout(() => {
          requestFullscreen();
        }, 300);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start secure quiz session');
    } finally {
      setLoading(false);
    }
  };

  // Static Quiz navigation handlers
  const handleStaticOptionSelect = (idx: number) => {
    setSelectedOptionIndex(idx);
    const updatedAnswers = [...staticAnswers];
    updatedAnswers[currentStaticIndex] = idx;
    setStaticAnswers(updatedAnswers);
  };

  const handleStaticConfidenceSelect = (level: 'low' | 'medium' | 'high') => {
    setConfidenceLevel(level);
    const updatedConfidences = [...staticConfidences];
    updatedConfidences[currentStaticIndex] = level;
    setStaticConfidences(updatedConfidences);
  };

  const handleStaticNext = () => {
    if (currentStaticIndex < totalQuestionsState - 1) {
      const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
      const updatedTimes = [...staticTimes];
      updatedTimes[currentStaticIndex] += elapsed;
      setStaticTimes(updatedTimes);

      setCurrentStaticIndex((prev) => prev + 1);
    }
  };

  const handleStaticPrev = () => {
    if (currentStaticIndex > 0) {
      const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
      const updatedTimes = [...staticTimes];
      updatedTimes[currentStaticIndex] += elapsed;
      setStaticTimes(updatedTimes);

      setCurrentStaticIndex((prev) => prev - 1);
    }
  };

  const handleStaticSubmit = async () => {
    if (staticAnswers.some((ans) => ans === -1)) {
      return setError('You have unanswered questions. Please complete all choices.');
    }
    if (staticConfidences.some((conf) => !conf)) {
      return setError('Please select a confidence level for all questions.');
    }

    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    const finalTimes = [...staticTimes];
    finalTimes[currentStaticIndex] += elapsed;

    setSubmittingAction(true);
    try {
      const finalResponses = staticAnswers.map((_, idx) => ({
        answerIndex: staticAnswers[idx],
        confidenceLevel: staticConfidences[idx],
        timeTaken: finalTimes[idx],
      }));

      // Exit fullscreen before routing
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      const response = await API.post('/attempts/submit-static', {
        attemptId,
        answers: staticAnswers,
        responses: finalResponses,
      });

      if (response.data.isCompleted) {
        navigate(`/result/${attemptId}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error submitting quiz answers');
      setSubmittingAction(false);
    }
  };

  // Adaptive Quiz submit handler
  const handleAdaptiveSubmitAnswer = async () => {
    if (selectedOptionIndex === null) {
      return setError('Please choose an answer option before submitting');
    }
    if (confidenceLevel === null) {
      return setError('Please select your confidence level before submitting');
    }

    setError(null);
    setSubmittingAction(true);

    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);

    try {
      const response = await API.post('/attempts/submit-answer', {
        attemptId,
        answerIndex: selectedOptionIndex,
        confidenceLevel,
        timeTaken: elapsed,
      });

      const data = response.data;
      if (data.isCompleted) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        navigate(`/result/${attemptId}`);
      } else {
        // Display next dynamic question
        setActiveQuestion(data.question);
        setActiveQuestionIndex(data.currentQuestionIndex);
        setSelectedOptionIndex(null);
        setConfidenceLevel(null);
        setQuestionStartTime(Date.now());
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error submitting answer');
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error && !quizStarted) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <Card className="border border-red-200 dark:border-red-900/50 p-6 text-center space-y-4 bg-white dark:bg-zinc-900">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Quiz Page Error</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <Button
            onClick={() => navigate('/dashboard')}
            className="w-full mt-2"
          >
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (!quiz) return null;

  // Enforce fullscreen gate check inside layout
  const needsFullscreenBlock =
    quizStarted &&
    securitySettings?.enforceSecurity &&
    securitySettings?.fullScreenEnforced &&
    !isFullscreen &&
    !autoSubmitReason;

  const currentQuestion = quiz.isAdaptive ? activeQuestion : activeQuestion;
  const questionNumber = quiz.isAdaptive ? activeQuestionIndex : currentStaticIndex + 1;
  const totalQuestionsCount = quiz.isAdaptive ? 8 : totalQuestionsState;

  const difficultyBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
    easy: 'success',
    medium: 'warning',
    hard: 'destructive',
    expert: 'default',
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 flex flex-col lg:flex-row gap-6 relative select-none">
      {/* ⚠️ Suspicious Violations Notification Banner */}
      {warningMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md bg-amber-500/90 backdrop-blur-md text-black px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-3 transition-all duration-300">
          <AlertTriangle className="w-6 h-6 flex-shrink-0 animate-bounce" />
          <div>
            <p className="text-sm font-extrabold">Exam Violation Warning</p>
            <p className="text-xs font-semibold">{warningMessage}</p>
          </div>
        </div>
      )}

      {/* 🛑 Auto-Submission Lockout Modal */}
      {autoSubmitReason && (
        <div className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-300">
          <Card className="max-w-md w-full border-red-500/20 text-center p-6 space-y-6">
            <div className="inline-flex p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full mx-auto">
              <ShieldAlert className="w-12 h-12 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Assessment Suspended</h3>
              <p className="text-sm text-red-500 font-semibold mt-2">
                This attempt is being auto-submitted due to security policy breaches:
              </p>
              <div className="bg-gray-105 dark:bg-zinc-950 border border-gray-250 dark:border-zinc-800 p-3 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300 mt-4">
                {autoSubmitReason}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Redirecting to the exam summary page in 5 seconds...
            </p>
          </Card>
        </div>
      )}

      {/* 🔒 Fullscreen Lockdown Gate */}
      {needsFullscreenBlock && (
        <div className="fixed inset-0 z-40 bg-zinc-950/95 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
          <Card className="max-w-md w-full text-center p-6 space-y-6">
            <div className="inline-flex p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full animate-bounce mx-auto">
              <Shield className="w-12 h-12" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Fullscreen Mode Required</h3>
              <p className="text-sm text-gray-550 dark:text-gray-400 mt-2">
                To prevent cheating, this assessment can only be taken in full screen mode.
              </p>
            </div>
            <Button
              onClick={requestFullscreen}
              className="w-full h-11 font-bold text-sm shadow-md"
            >
              Resume Lockdown Full Screen
            </Button>
          </Card>
        </div>
      )}

      {/* Left Column: Exam Card Display */}
      <div className="flex-1 space-y-6">
        {/* Render Start screen */}
        {!quizStarted ? (
          <Card className="p-8 text-center space-y-6 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <div className="inline-flex p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl mx-auto">
              <BrainCircuit className="w-10 h-10 animate-pulse" />
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {quiz.title}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-3 leading-relaxed">
                {quiz.description || 'No description available for this assessment.'}
              </p>
            </div>

            {/* Security Config Warnings */}
            {quiz.securitySettings?.enforceSecurity && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-500/20 space-y-3 text-left">
                <h4 className="text-xs font-extrabold text-red-600 dark:text-red-400 flex items-center space-x-1.5 uppercase tracking-wider">
                  <Shield className="w-4 h-4" />
                  <span>Exam Security Lockdown Enforced</span>
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                  This is a proctored exam. Anti-cheating mechanisms are active and all activity is logged. Violations are reported to your instructor.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {[
                    { icon: <Maximize className="w-3 h-3" />, label: 'Fullscreen Required', active: !!quiz.securitySettings?.fullScreenEnforced },
                    { icon: <Camera className="w-3 h-3" />, label: 'Camera Proctoring', active: !!quiz.securitySettings?.cameraMonitoring },
                    { icon: <Copy className="w-3 h-3" />, label: 'Copy/Paste Blocked', active: true },
                    { icon: <Eye className="w-3 h-3" />, label: 'Tab Switch Detection', active: true },
                    { icon: <Monitor className="w-3 h-3" />, label: 'Screenshot Detection', active: true },
                    { icon: <Timer className="w-3 h-3" />, label: `Auto-Submit at ${quiz.securitySettings?.violationLimits || 4} Violations`, active: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center space-x-2 text-[10px]">
                      <div className={`p-1 rounded ${item.active ? 'text-red-500 bg-red-500/10' : 'text-gray-400 bg-gray-100 dark:bg-zinc-800'}`}>
                        {item.icon}
                      </div>
                      <span className={item.active ? 'text-gray-700 dark:text-gray-300 font-semibold' : 'text-gray-400 line-through'}>
                        {item.label}
                      </span>
                      {item.active && <span className="text-red-500 font-bold">✓</span>}
                    </div>
                  ))}
                </div>
                <div className="flex items-start space-x-2 mt-3 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    By clicking Start, you agree that all your exam activity is monitored and violations will be logged to the instructor.
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-50 dark:bg-zinc-950 rounded-xl border border-gray-255 dark:border-zinc-800 space-y-3 text-left">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Quiz Details &amp; Rules:</h4>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-2 list-disc list-inside">
                {quiz.isAdaptive ? (
                  <>
                    <li className="text-indigo-650 dark:text-indigo-400 font-semibold list-none flex items-center space-x-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Adaptive Mode Active</span>
                    </li>
                    <li>Questions adapt in difficulty based on correctness.</li>
                    <li>Questions are served one by one. You cannot navigate back.</li>
                    <li>The session ends after 8 questions or when matching questions are exhausted.</li>
                  </>
                ) : (
                  <>
                    <li>Static assessment with fixed, pre-selected questions.</li>
                    <li>You can navigate back and forth to review your answers.</li>
                    <li>Verify all choices before selecting "Submit Quiz" at the end.</li>
                  </>
                )}
              </ul>
            </div>

            <div className="flex space-x-4 pt-4 justify-center">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStart}
                className="px-8"
              >
                Start Assessment
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Quiz Progress Header */}
            <Card className="border-gray-200 dark:border-zinc-800 p-4 sm:p-6 bg-white dark:bg-zinc-900">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{quiz.title}</h3>
                  <div className="flex items-center space-x-2.5 mt-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      Question {questionNumber} of {totalQuestionsCount}
                    </span>
                    <span className="text-gray-300 dark:text-zinc-700">•</span>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold capitalize">
                      Topic: {currentQuestion?.topic || 'General'}
                    </span>
                  </div>
                </div>

                {currentQuestion && (
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                      Difficulty:
                    </span>
                    <Badge variant={difficultyBadgeVariant[currentQuestion.difficulty]}>
                      {currentQuestion.difficulty}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2 rounded-full mt-6 overflow-hidden">
                <div
                  className="bg-indigo-650 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(questionNumber / totalQuestionsCount) * 100}%` }}
                />
              </div>
            </Card>

            {loadingQuestion || !currentQuestion ? (
              <Card className="border-gray-200 dark:border-zinc-800 p-8 flex flex-col items-center justify-center min-h-[300px] bg-white dark:bg-zinc-900">
                <LoadingSpinner />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 font-semibold">Loading secure question delivery...</p>
              </Card>
            ) : (
              <Card className="border-gray-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 relative bg-white dark:bg-zinc-900">
                {error && (
                  <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs px-4 py-2.5 rounded-lg font-medium">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                    Prompt
                  </Badge>
                  <h4 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-relaxed mt-2">
                    {currentQuestion.questionText}
                  </h4>
                </div>

                {/* Options list */}
                <div className="space-y-3 pt-4">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOptionIndex === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setError(null);
                          if (quiz.isAdaptive) {
                            setSelectedOptionIndex(idx);
                          } else {
                            handleStaticOptionSelect(idx);
                          }
                        }}
                        className={`w-full flex items-center space-x-4 px-4 py-3.5 rounded-xl border text-left text-sm font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-600 dark:border-indigo-500 text-indigo-900 dark:text-indigo-300 ring-2 ring-indigo-500/15'
                            : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-305 hover:bg-gray-50 dark:hover:bg-zinc-800/40'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold border transition-all ${
                            isSelected
                              ? 'bg-indigo-600 border-transparent text-white'
                              : 'bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1 leading-snug">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Confidence level selector */}
                <div className="border-t border-gray-200 dark:border-zinc-800 pt-6 space-y-3">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                    Confidence Level:
                  </span>
                  <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2.5 sm:space-y-0">
                    {['low', 'medium', 'high'].map((level) => {
                      const isSelected = confidenceLevel === level;
                      const levelColors = {
                        low: 'border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/10',
                        medium: 'border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/10',
                        high: 'border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/10',
                      };
                      const selectedBgColors = {
                        low: 'bg-blue-50 dark:bg-blue-950/20 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/10',
                        medium: 'bg-amber-50 dark:bg-amber-950/20 border-amber-600 dark:border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/10',
                        high: 'bg-rose-50 dark:bg-rose-950/20 border-rose-600 dark:border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/10',
                      };

                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => {
                            setError(null);
                            if (quiz.isAdaptive) {
                              setConfidenceLevel(level as any);
                            } else {
                              handleStaticConfidenceSelect(level as any);
                            }
                          }}
                          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all cursor-pointer ${
                            isSelected
                              ? selectedBgColors[level as 'low' | 'medium' | 'high']
                              : 'bg-white dark:bg-zinc-900 text-gray-500 dark:text-gray-400 ' + levelColors[level as 'low' | 'medium' | 'high']
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-current' : 'border-gray-305 dark:border-gray-600'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 bg-current rounded-full" />}
                          </span>
                          <span>{level} Confidence</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* Footer Navigation Panel */}
            <div className="flex items-center justify-between">
              {!quiz.isAdaptive ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleStaticPrev}
                    disabled={currentStaticIndex === 0 || loadingQuestion}
                    className="flex items-center space-x-2 px-4 font-bold"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </Button>

                  {currentStaticIndex === totalQuestionsState - 1 ? (
                    <Button
                      onClick={handleStaticSubmit}
                      disabled={
                        staticAnswers.some((ans) => ans === -1) ||
                        staticConfidences.some((conf) => !conf) ||
                        submittingAction ||
                        loadingQuestion
                      }
                      className="flex items-center space-x-2 px-6 font-bold"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{submittingAction ? 'Submitting...' : 'Submit Quiz'}</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStaticNext}
                      disabled={selectedOptionIndex === null || confidenceLevel === null || loadingQuestion}
                      className="flex items-center space-x-2 px-4 font-bold"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (window.confirm('Quit quiz? Active attempts will be marked incomplete.')) {
                        navigate('/dashboard');
                      }
                    }}
                    className="px-4 font-bold"
                  >
                    Quit Quiz
                  </Button>

                  <Button
                    onClick={handleAdaptiveSubmitAnswer}
                    disabled={selectedOptionIndex === null || confidenceLevel === null || submittingAction || loadingQuestion}
                    className="flex items-center space-x-2 px-6 font-bold shadow-md shadow-indigo-500/10"
                  >
                    <span>{submittingAction ? 'Evaluating...' : 'Submit Answer'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right Column: Security Proctor Widgets */}
      {quizStarted && securitySettings?.enforceSecurity && (
        <div className="w-full lg:w-72 space-y-6">
          {/* Live Proctoring Webcam preview */}
          {securitySettings.cameraMonitoring && (
            <Card className="border-gray-200 dark:border-zinc-800 p-4 space-y-3 bg-white dark:bg-zinc-900">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
                <Video className="w-4 h-4 text-rose-500 animate-pulse" />
                <span>Live Proctor Stream</span>
              </h4>
              <div className="aspect-video w-full rounded-lg bg-gray-100 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 flex items-center justify-center relative overflow-hidden">
                {cameraActive ? (
                  <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest animate-pulse">
                    Webcam Active
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-gray-505 uppercase tracking-wider text-center p-3">
                    Initializing Video Feed...
                  </div>
                )}
              </div>
              <p className="text-[10px] text-gray-500 leading-snug">
                Camera is active. Periodic frame verification runs in the background. Keep your face centered in the camera.
              </p>
            </Card>
          )}

          {/* Security Integrity report */}
          <Card className="border-gray-200 dark:border-zinc-800 p-4 space-y-4 bg-white dark:bg-zinc-900">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5 border-b border-gray-200 dark:border-zinc-800 pb-2">
              <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Integrity Monitor</span>
            </h4>

            <div className="space-y-2.5">
              {/* Fullscreen status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Fullscreen Lock</span>
                </div>
                <Badge variant={isFullscreen ? 'success' : 'destructive'} className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                  {isFullscreen ? 'Active' : 'Required'}
                </Badge>
              </div>

              {/* Tab switches */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Tab Switches</span>
                </div>
                <span className={`font-mono text-xs font-bold ${
                  tabSwitches >= securitySettings.allowedTabSwitches ? 'text-red-650 dark:text-red-400' : 'text-gray-900 dark:text-white'
                }`}>
                  {tabSwitches} / {securitySettings.allowedTabSwitches}
                </span>
              </div>

              {/* Total violations */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Violations</span>
                </div>
                <span className={`font-mono text-xs font-bold ${
                  violationsCount >= securitySettings.violationLimits ? 'text-red-500 animate-pulse' : violationsCount > securitySettings.violationLimits / 2 ? 'text-amber-500' : 'text-gray-900 dark:text-white'
                }`}>
                  {violationsCount} / {securitySettings.violationLimits}
                </span>
              </div>

              {/* Remaining Attempts */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Remaining Attempts</span>
                </div>
                <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                  {Math.max(0, securitySettings.violationLimits - violationsCount)}
                </span>
              </div>

              {/* Violation bar */}
              <div className="w-full bg-gray-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    violationsCount >= securitySettings.violationLimits ? 'bg-red-500' :
                    violationsCount > securitySettings.violationLimits / 2 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, (violationsCount / securitySettings.violationLimits) * 100)}%` }}
                />
              </div>
            </div>

            {/* Risk score */}
            <div className="border-t border-gray-200 dark:border-zinc-800 pt-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Risk Score</span>
                <span className={`text-sm font-bold ${
                  riskCategory === 'High Risk' ? 'text-red-500 animate-pulse' : riskCategory === 'Medium Risk' ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {riskScore}%
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    riskScore > 70 ? 'bg-red-500' : riskScore > 35 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${riskScore}%` }}
                />
              </div>
              <div className={`text-[9px] font-extrabold uppercase text-center mt-1 ${
                riskCategory === 'High Risk' ? 'text-red-500' : riskCategory === 'Medium Risk' ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                {riskCategory}
              </div>
            </div>

            {/* Recent Violations History List */}
            <div className="border-t border-gray-200 dark:border-zinc-800 pt-3 space-y-1.5">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Recent Violations</span>
              <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-3 max-h-24 overflow-y-auto text-[10px] font-mono space-y-1 text-gray-650 dark:text-gray-400 scrollbar-thin">
                {securityAlerts.length === 0 ? (
                  <p className="text-gray-500 text-center py-2">No proctoring violations recorded.</p>
                ) : (
                  securityAlerts.map((alert: { message: string; timestamp: string }, idx: number) => (
                    <div key={idx} className="flex justify-between items-start gap-2 border-b border-gray-100 dark:border-zinc-800/40 pb-1 last:border-0 last:pb-0">
                      <span className="text-amber-500 leading-snug">{alert.message}</span>
                      <span className="text-gray-500 whitespace-nowrap">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Active protections */}
            <div className="border-t border-gray-200 dark:border-zinc-800 pt-3 space-y-1.5">
              <span className="text-[9px] text-gray-500 dark:text-gray-500 font-bold uppercase tracking-wider">Active Protections</span>
              {[
                { label: 'Copy/Paste Blocked', active: true, icon: <Copy className="w-3 h-3" /> },
                { label: 'Right-Click Blocked', active: true, icon: <Eye className="w-3 h-3" /> },
                { label: 'Screenshot Detected', active: true, icon: <Camera className="w-3 h-3" /> },
                { label: 'Camera Proctoring', active: !!securitySettings.cameraMonitoring, icon: <Video className="w-3 h-3" /> },
              ].map((item, i) => (
                <div key={i} className="flex items-center space-x-1.5">
                  <div className={`p-0.5 rounded ${item.active ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-600'}`}>{item.icon}</div>
                  <span className={`text-[10px] font-medium ${item.active ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`}>{item.label}</span>
                  <span className={`text-[9px] ml-auto font-bold ${item.active ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-600'}`}>
                    {item.active ? 'ON' : 'OFF'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default QuizPage;
