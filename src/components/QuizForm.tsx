import React, { useState, useEffect } from 'react';
import { X, Search, Shield, Video, Eye, AlertTriangle } from 'lucide-react';
import API from '../services/api';

interface Question {
  _id: string;
  questionText: string;
  difficulty: 'easy' | 'medium' | 'hard';
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
  _id?: string;
  title: string;
  description: string;
  isAdaptive: boolean;
  topic?: string;
  questions?: any[];
  securitySettings?: SecuritySettings;
}

interface QuizFormProps {
  quiz?: Quiz | null;
  onClose: () => void;
  onSave: () => void;
}

const defaultSecurity: SecuritySettings = {
  enforceSecurity: false,
  allowedTabSwitches: 2,
  fullScreenEnforced: true,
  cameraMonitoring: false,
  violationLimits: 4,
};

const QuizForm: React.FC<QuizFormProps> = ({ quiz, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAdaptive, setIsAdaptive] = useState(false);
  const [topic, setTopic] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [questionBank, setQuestionBank] = useState<Question[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Security settings state
  const [security, setSecurity] = useState<SecuritySettings>(defaultSecurity);

  // Load all questions from bank
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await API.get('/questions');
        setQuestionBank(response.data.questions || []);
      } catch (err) {
        console.error('Error fetching question bank', err);
      }
    };
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (quiz) {
      setTitle(quiz.title);
      setDescription(quiz.description || '');
      setIsAdaptive(quiz.isAdaptive);
      setTopic(quiz.topic || '');
      setSelectedQuestions(quiz.questions ? quiz.questions.map((q) => (typeof q === 'string' ? q : q._id)) : []);
      if (quiz.securitySettings) {
        setSecurity({ ...defaultSecurity, ...quiz.securitySettings });
      }
    }
  }, [quiz]);

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!title.trim()) return setError('Title is required');
    if (isAdaptive && !topic.trim()) return setError('Topic is required for adaptive quizzes');
    if (!isAdaptive && selectedQuestions.length === 0) {
      return setError('Please select at least 1 question for this static quiz');
    }

    setLoading(true);
    try {
      const payload = {
        title,
        description,
        isAdaptive,
        topic: isAdaptive ? topic : undefined,
        questions: isAdaptive ? [] : selectedQuestions,
        securitySettings: security,
      };

      if (quiz?._id) {
        await API.put(`/quizzes/${quiz._id}`, payload);
      } else {
        await API.post('/quizzes', payload);
      }

      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error saving quiz');
    } finally {
      setLoading(false);
    }
  };

  // Filter question bank for static quiz selectors
  const filteredQuestions = questionBank.filter((q) =>
    q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const difficultyColors = {
    easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    hard: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-white/10 my-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {quiz ? 'Edit Quiz' : 'Create New Quiz'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Quiz Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. JavaScript Closures & Scope"
                className="w-full px-4 py-2.5 glass-input text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Quiz Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of quiz contents"
                className="w-full px-4 py-2.5 glass-input text-sm"
              />
            </div>
          </div>

          {/* Adaptive Toggle */}
          <div className="flex items-center space-x-3 p-3 bg-white/3 rounded-lg border border-white/5">
            <input
              type="checkbox"
              id="isAdaptive"
              checked={isAdaptive}
              onChange={(e) => setIsAdaptive(e.target.checked)}
              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-600 bg-gray-700 rounded-sm"
            />
            <label htmlFor="isAdaptive" className="cursor-pointer">
              <span className="block text-sm font-semibold text-white">AI Adaptive Mode</span>
              <span className="block text-xs text-gray-400">
                Difficulty dynamically adjusts based on student performance.
              </span>
            </label>
          </div>

          {isAdaptive ? (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Target Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. javascript"
                className="w-full px-4 py-2.5 glass-input text-sm"
                required={isAdaptive}
              />
              <p className="text-xs text-indigo-400 mt-1.5 font-medium">
                The engine will serve topic questions starting at Medium difficulty.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Select Questions ({selectedQuestions.length} selected)
                </label>
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search bank..."
                    className="w-full pl-9 pr-3 py-1.5 glass-input text-xs"
                  />
                </div>
              </div>

              {/* Question Selection Box */}
              <div className="border border-white/5 rounded-lg bg-black/20 h-40 overflow-y-auto p-2 space-y-2">
                {filteredQuestions.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-10">No questions found</p>
                ) : (
                  filteredQuestions.map((q) => (
                    <div
                      key={q._id}
                      onClick={() => toggleQuestionSelection(q._id)}
                      className={`flex items-start space-x-3 p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        selectedQuestions.includes(q._id)
                          ? 'bg-indigo-600/10 border-indigo-500/30'
                          : 'bg-transparent border-transparent hover:bg-white/3'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(q._id)}
                        onChange={() => {}} // handled by div click
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{q.questionText}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[10px] uppercase font-bold text-indigo-400">
                            {q.topic}
                          </span>
                          <span
                            className={`text-[9px] uppercase font-bold border px-1.5 py-0.25 rounded-md ${
                              difficultyColors[q.difficulty]
                            }`}
                          >
                            {q.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─── EXAM SECURITY SETTINGS ─── */}
          <div className="border border-white/5 rounded-xl overflow-hidden">
            {/* Header toggle */}
            <div
              className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                security.enforceSecurity
                  ? 'bg-red-500/10 border-b border-red-500/20'
                  : 'bg-white/3 border-b border-white/5'
              }`}
              onClick={() => setSecurity((s) => ({ ...s, enforceSecurity: !s.enforceSecurity }))}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-1.5 rounded-lg ${security.enforceSecurity ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-400'}`}>
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <span className={`block text-sm font-bold ${security.enforceSecurity ? 'text-red-400' : 'text-white'}`}>
                    Exam Security Lockdown
                  </span>
                  <span className="block text-xs text-gray-500">
                    Enable anti-cheating mechanisms for this assessment
                  </span>
                </div>
              </div>
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${security.enforceSecurity ? 'bg-red-500' : 'bg-white/10'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${security.enforceSecurity ? 'translate-x-4' : 'translate-x-1'}`} />
              </div>
            </div>

            {/* Expanded security options */}
            {security.enforceSecurity && (
              <div className="p-4 bg-red-950/10 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Fullscreen Enforcement */}
                  <label className="flex items-center justify-between p-3 bg-white/3 rounded-lg border border-white/5 cursor-pointer hover:border-white/10 transition-colors">
                    <div className="flex items-center space-x-2.5">
                      <Eye className="w-4 h-4 text-indigo-400" />
                      <div>
                        <span className="block text-xs font-semibold text-white">Fullscreen Required</span>
                        <span className="block text-[10px] text-gray-500">Lock exam to full-browser view</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={security.fullScreenEnforced}
                      onChange={(e) => setSecurity((s) => ({ ...s, fullScreenEnforced: e.target.checked }))}
                      className="w-4 h-4 text-indigo-500 border-gray-600 bg-gray-700 rounded"
                    />
                  </label>

                  {/* Camera Monitoring */}
                  <label className="flex items-center justify-between p-3 bg-white/3 rounded-lg border border-white/5 cursor-pointer hover:border-white/10 transition-colors">
                    <div className="flex items-center space-x-2.5">
                      <Video className="w-4 h-4 text-rose-400" />
                      <div>
                        <span className="block text-xs font-semibold text-white">Camera Proctoring</span>
                        <span className="block text-[10px] text-gray-500">Enable webcam face detection</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={security.cameraMonitoring}
                      onChange={(e) => setSecurity((s) => ({ ...s, cameraMonitoring: e.target.checked }))}
                      className="w-4 h-4 text-rose-500 border-gray-600 bg-gray-700 rounded"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Allowed Tab Switches */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Allowed Tab Switches</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={security.allowedTabSwitches}
                      onChange={(e) => setSecurity((s) => ({ ...s, allowedTabSwitches: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 glass-input text-sm"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Tab switches before flagging (0 = none allowed)</p>
                  </div>

                  {/* Violation Limit */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                      <Shield className="w-3 h-3 text-red-400" />
                      <span>Auto-Submit Limit</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={security.violationLimits}
                      onChange={(e) => setSecurity((s) => ({ ...s, violationLimits: parseInt(e.target.value) || 4 }))}
                      className="w-full px-4 py-2 glass-input text-sm"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Total violations before auto-submitting exam</p>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Security mode shuffles question & answer order, detects copy-paste/right-click, logs all violations, and requires students to confirm security terms before starting.</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/10 transition-all"
            >
              {loading ? 'Saving...' : quiz ? 'Update Quiz' : 'Create Quiz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuizForm;
