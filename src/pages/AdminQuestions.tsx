import React, { useState, useEffect } from 'react';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import QuestionForm from '../components/QuestionForm';
import LoadingSpinner from '../components/LoadingSpinner';
import { Search, Plus, Filter, Edit2, Trash2 } from 'lucide-react';

interface Question {
  _id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
}

const AdminQuestions: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);

  const fetchQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.get('/questions', {
        params: {
          difficulty: difficultyFilter || undefined,
          topic: topicFilter || undefined,
          search: searchQuery || undefined,
        },
      });
      setQuestions(response.data.questions || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error fetching question bank');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [difficultyFilter, topicFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQuestions();
  };

  const handleAddClick = () => {
    setActiveQuestion(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (question: Question) => {
    setActiveQuestion(question);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await API.delete(`/questions/${id}`);
        fetchQuestions();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to delete question');
      }
    }
  };

  const handleModalSave = () => {
    setIsModalOpen(false);
    setActiveQuestion(null);
    fetchQuestions();
  };

  const difficultyColors = {
    easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    hard: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Question Bank</h2>
          <p className="text-sm text-gray-400 font-medium mt-1">
            Create, edit, search, and manage questions for adaptive quizzes.
          </p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Question</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions by text prompt..."
            className="w-full pl-11 pr-24 py-3 glass-input text-sm"
          />
          <button
            type="submit"
            className="absolute right-2 top-2 text-xs font-semibold px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Difficulty Dropdown */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-500 hidden sm:block" />
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-2.5 glass-input text-sm bg-[#121620] w-full sm:w-auto"
            >
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Topic Dropdown/Input */}
          <input
            type="text"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            placeholder="Filter by Topic..."
            className="px-4 py-2.5 glass-input text-sm w-full sm:w-auto"
          />
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <GlassCard className="border border-white/5 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/3 text-gray-400 border-b border-white/5 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4 w-[50%]">Question Prompt</th>
                  <th className="px-6 py-4">Topic</th>
                  <th className="px-6 py-4">Difficulty</th>
                  <th className="px-6 py-4">Correct Option</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                {questions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No questions found in bank matching criteria
                    </td>
                  </tr>
                ) : (
                  questions.map((q) => (
                    <tr key={q._id} className="hover:bg-white/2 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-white leading-relaxed">{q.questionText}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                          {q.options.map((opt, oIdx) => (
                            <p key={oIdx} className={q.correctAnswer === oIdx ? 'text-indigo-400 font-medium' : ''}>
                              {String.fromCharCode(65 + oIdx)}) {opt}
                            </p>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/5 uppercase">
                          {q.topic}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-bold border px-2.5 py-1 rounded-full uppercase ${
                            difficultyColors[q.difficulty]
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-indigo-400">
                        Option {String.fromCharCode(65 + q.correctAnswer)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2.5">
                          <button
                            onClick={() => handleEditClick(q)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(q._id)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <QuestionForm
          question={activeQuestion}
          onClose={() => setIsModalOpen(false)}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
};

export default AdminQuestions;
