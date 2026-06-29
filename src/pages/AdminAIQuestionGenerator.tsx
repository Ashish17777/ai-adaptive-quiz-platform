import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import {
  ArrowLeft,
  Sparkles,
  Zap,
  Trash2,
  Save,
  FileText,
  Image as ImageIcon,
  Edit2,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface GeneratedQuestion {
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topic: string;
  difficulty: string;
  generatedByAI?: boolean;
}

const AdminAIQuestionGenerator: React.FC = () => {
  const navigate = useNavigate();

  // Generator inputs
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const questionType = 'MCQ';

  // File uploads
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // PDF Extraction metrics
  const [pdfMetrics, setPdfMetrics] = useState<{
    pageCount: number;
    textLength: number;
    topicsIdentified: string[];
    snippet: string;
  } | null>(null);

  // Application states
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Generating Questions...');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Generated results
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Standard AI generation trigger
  const handleStandardGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Please specify a topic or subject category.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setPdfMetrics(null);
    setLoading(true);
    setLoadingText(`AI is constructing ${questionCount} questions on "${topic}"...`);

    try {
      const res = await API.post('/ai/generate-question', {
        topic,
        difficulty,
        numberOfQuestions: questionCount,
        questionType
      });
      setQuestions(res.data.questions || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error generating AI questions.');
    } finally {
      setLoading(false);
    }
  };

  // PDF notes text extraction trigger
  const handlePDFGenerate = async () => {
    if (!pdfFile) {
      setError('Please select a study notes PDF first.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setPdfMetrics(null);
    setLoading(true);
    setLoadingText('Parsing document layouts and extracting core concepts...');

    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('difficulty', difficulty);
    formData.append('numberOfQuestions', questionCount.toString());

    try {
      const res = await API.post('/ai/pdf-to-quiz', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setQuestions(res.data.questions || []);
      setTopic(res.data.topic || '');
      setSuccessMsg(`Extracted topic: "${res.data.topic}". Check the generated questions below.`);
      setPdfMetrics({
        pageCount: res.data.pageCount || 1,
        textLength: res.data.textLength || 0,
        topicsIdentified: res.data.topicsIdentified || [],
        snippet: res.data.textSnippet || ''
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error parsing PDF notes.');
    } finally {
      setLoading(false);
    }
  };

  // Image diagram trigger
  const handleImageGenerate = async () => {
    if (!imageFile) {
      setError('Please select an educational diagram or graph image.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setPdfMetrics(null);
    setLoading(true);
    setLoadingText('AI is analyzing diagram variables and graphing context...');

    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('difficulty', difficulty);
    formData.append('numberOfQuestions', questionCount.toString());

    try {
      const res = await API.post('/ai/image-to-quiz', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setQuestions(res.data.questions || []);
      setTopic(res.data.topic || '');
      setSuccessMsg(`AI analyzed diagram context: "${res.data.topic}". preview questions below.`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error extracting context from diagram image.');
    } finally {
      setLoading(false);
    }
  };

  // Inline edit operations
  const handleEditQuestion = (index: number) => {
    setEditingIndex(index);
  };

  const handleUpdateField = (index: number, field: keyof GeneratedQuestion, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleUpdateOption = (qIdx: number, oIdx: number, value: string) => {
    const updated = [...questions];
    const opts = [...updated[qIdx].options];
    opts[oIdx] = value;
    updated[qIdx] = { ...updated[qIdx], options: opts };
    setQuestions(updated);
  };

  const handleSaveEdit = () => {
    setEditingIndex(null);
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, idx) => idx !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  // Save reviewed questions to global Question Bank
  const handleSaveToBank = async () => {
    if (questions.length === 0) return;
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    setLoadingText('Saving reviewed questions to global Question Bank...');

    try {
      let savedCount = 0;
      // Loop to create questions individually utilizing existing POST /api/questions endpoint
      await Promise.all(
        questions.map(async (q) => {
          await API.post('/questions', {
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            difficulty: q.difficulty,
            topic: q.topic || topic || 'general',
            explanation: q.explanation,
            generatedByAI: true
          });
          savedCount++;
        })
      );

      setSuccessMsg(`Success! Saved ${savedCount} questions directly to the Question Bank.`);
      setQuestions([]); // Clear list after successful save
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save questions to the bank.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-300">
      {/* Header */}
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
            AI Question Generator
          </span>
          <Sparkles className="w-7 h-7 text-indigo-400 animate-pulse" />
        </h2>
        <p className="text-gray-400 text-sm mt-1.5 font-medium">
          Create premium evaluations from subjects, PDFs, or diagram images in seconds.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-2.5 rounded-lg flex items-center space-x-2">
          <CheckCircle className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080b11]/90 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center space-y-4 text-center px-4">
            <div
              className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"
              role="status"
            >
              <span className="sr-only">Loading...</span>
            </div>
            <p className="text-indigo-400 font-medium tracking-wide animate-pulse max-w-md">
              {loadingText}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings inputs */}
          <div className="lg:col-span-1 space-y-6">
            {/* Standard Subject Input */}
            <GlassCard className="border border-white/5 p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
                <Zap className="w-4.5 h-4.5 text-indigo-400" />
                <span>Text Generator</span>
              </h3>

              <form onSubmit={handleStandardGenerate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block">Topic / Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Algebra, Organic Chemistry"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full bg-white/2 border border-white/5 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block">Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-3 py-3 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block">Question Count</label>
                    <select
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-3 py-3 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    >
                      <option value="5">5 Questions</option>
                      <option value="10">10 Questions</option>
                      <option value="25">25 Questions</option>
                      <option value="50">50 Questions</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center space-x-1.5 py-3 text-xs font-bold bg-indigo-650 hover:bg-indigo-600 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-lg transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Questions</span>
                </button>
              </form>
            </GlassCard>

            {/* Document parser */}
            <GlassCard className="border border-white/5 p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4.5 h-4.5 text-purple-400" />
                <span>PDF to Quiz</span>
              </h3>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block">Select Lecture PDF</label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full text-xs font-semibold text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-white/5 file:bg-white/5 file:text-white file:text-xs file:font-bold hover:file:bg-white/10 file:transition-colors file:cursor-pointer"
                  />
                </div>

                <button
                  onClick={handlePDFGenerate}
                  disabled={!pdfFile}
                  className="w-full flex items-center justify-center space-x-1.5 py-3 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="w-4.5 h-4.5" />
                  <span>Generate from PDF</span>
                </button>
              </div>
            </GlassCard>

            {/* Image parser */}
            <GlassCard className="border border-white/5 p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
                <ImageIcon className="w-4.5 h-4.5 text-pink-400" />
                <span>Image to Question</span>
              </h3>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider block">Select Diagram or Graph</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full text-xs font-semibold text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-white/5 file:bg-white/5 file:text-white file:text-xs file:font-bold hover:file:bg-white/10 file:transition-colors file:cursor-pointer"
                  />
                </div>

                <button
                  onClick={handleImageGenerate}
                  disabled={!imageFile}
                  className="w-full flex items-center justify-center space-x-1.5 py-3 text-xs font-bold bg-pink-650 hover:bg-pink-600 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-50 hover:to-rose-500 text-white rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ImageIcon className="w-4.5 h-4.5" />
                  <span>Generate from Image</span>
                </button>
              </div>
            </GlassCard>
          </div>

          {/* Preview panel */}
          <div className="lg:col-span-2 space-y-6">
            {questions.length === 0 ? (
              <GlassCard className="border border-white/5 p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full min-h-[300px]">
                <HelpCircle className="w-12 h-12 text-indigo-400 opacity-40 mb-3" />
                <h4 className="text-white font-bold text-base">No questions generated yet</h4>
                <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
                  Select a topic, upload a PDF document, or insert a diagram graph on the left and trigger generation.
                </p>
              </GlassCard>
            ) : (
              <div className="space-y-6">
                {pdfMetrics && (
                  <GlassCard className="border border-purple-500/20 p-5 bg-purple-950/10 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-purple-400" />
                      <span>PDF Extraction Insights</span>
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <span className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wider block text-left">Pages Processed</span>
                        <span className="text-lg font-extrabold text-purple-400 mt-1 block text-left">{pdfMetrics.pageCount}</span>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <span className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wider block text-left">Character Count</span>
                        <span className="text-lg font-extrabold text-purple-400 mt-1 block text-left">{pdfMetrics.textLength}</span>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <span className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wider block text-left">Primary Topic</span>
                        <span className="text-xs font-bold text-purple-400 mt-1 block text-left truncate capitalize" title={pdfMetrics.topicsIdentified.join(', ')}>
                          {pdfMetrics.topicsIdentified.length > 0 ? pdfMetrics.topicsIdentified[0] : 'None'}
                        </span>
                      </div>
                    </div>
                    {pdfMetrics.topicsIdentified.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[10px] text-gray-400 font-bold block self-center mr-1">All Keywords:</span>
                        {pdfMetrics.topicsIdentified.map((topic, tIdx) => (
                          <span key={tIdx} className="text-[9px] font-bold px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-md">
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                    {pdfMetrics.snippet && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wider block">Text Snippet Preview</span>
                        <div className="bg-black/20 rounded-xl p-3 border border-white/5 text-[11px] font-medium text-gray-400 leading-relaxed font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                          {pdfMetrics.snippet}...
                        </div>
                      </div>
                    )}
                  </GlassCard>
                )}

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <span>Generated Previews</span>
                    <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-bold">
                      {questions.length} Questions
                    </span>
                  </h3>
                  <button
                    onClick={handleSaveToBank}
                    className="flex items-center space-x-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save to Question Bank</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {questions.map((q, idx) => {
                    const isEditing = editingIndex === idx;

                    return (
                      <GlassCard
                        key={idx}
                        className={`border ${isEditing ? 'border-indigo-500/30' : 'border-white/5'} p-5 space-y-4`}
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center font-bold text-xs text-indigo-400">
                            {idx + 1}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-[9px] uppercase font-extrabold px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-md">
                              {q.difficulty}
                            </span>
                            <span className="text-[9px] uppercase font-extrabold px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-md capitalize">
                              {q.topic}
                            </span>
                            {isEditing ? (
                              <button
                                onClick={handleSaveEdit}
                                className="flex items-center space-x-1 text-[10px] font-extrabold text-emerald-400 hover:text-emerald-300"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Done</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEditQuestion(idx)}
                                className="flex items-center space-x-1 text-[10px] font-extrabold text-indigo-400 hover:text-indigo-300"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteQuestion(idx)}
                              className="text-red-400 hover:text-red-300 flex items-center"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Question Text Box */}
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <label className="text-[9px] text-gray-500 font-extrabold uppercase block">Question Text</label>
                            <textarea
                              value={q.questionText}
                              onChange={(e) => handleUpdateField(idx, 'questionText', e.target.value)}
                              rows={2}
                              className="w-full bg-white/2 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>
                        ) : (
                          <h4 className="text-sm font-semibold text-white leading-relaxed">{q.questionText}</h4>
                        )}

                        {/* Options Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = q.correctAnswer === oIdx;
                            return (
                              <div
                                key={oIdx}
                                className={`flex items-center space-x-3 px-3.5 py-3 rounded-xl border text-xs font-semibold ${
                                  isCorrect
                                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                                    : 'bg-transparent border-white/5 text-gray-300'
                                }`}
                              >
                                <span className="w-5 h-5 rounded flex items-center justify-center font-bold bg-white/5 text-gray-400 border border-white/5">
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => handleUpdateOption(idx, oIdx, e.target.value)}
                                    className="flex-1 bg-white/2 border border-transparent rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                                  />
                                ) : (
                                  <span className="flex-1 truncate">{opt}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Answers, Explanations and Topics */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-3 text-xs">
                          <div className="space-y-1.5">
                            <span className="text-[9px] text-gray-500 font-extrabold uppercase block">Correct Option</span>
                            {isEditing ? (
                              <select
                                value={q.correctAnswer}
                                onChange={(e) => handleUpdateField(idx, 'correctAnswer', Number(e.target.value))}
                                className="w-full bg-[#0a0f1d] border border-white/5 rounded-lg px-2 py-1.5 text-xs font-semibold text-white"
                              >
                                <option value="0">A</option>
                                <option value="1">B</option>
                                <option value="2">C</option>
                                <option value="3">D</option>
                              </select>
                            ) : (
                              <p className="text-emerald-400 font-bold">
                                Option {String.fromCharCode(65 + q.correctAnswer)}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[9px] text-gray-500 font-extrabold uppercase block">Explanation / Solution</span>
                            {isEditing ? (
                              <input
                                type="text"
                                value={q.explanation}
                                onChange={(e) => handleUpdateField(idx, 'explanation', e.target.value)}
                                className="w-full bg-white/2 border border-white/5 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                              />
                            ) : (
                              <p className="text-gray-400 italic truncate">{q.explanation || 'No solution text.'}</p>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAIQuestionGenerator;
