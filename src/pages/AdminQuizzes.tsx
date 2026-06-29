import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import GlassCard from '../components/GlassCard';
import QuizForm from '../components/QuizForm';
import LoadingSpinner from '../components/LoadingSpinner';
import { Plus, Edit2, Trash2, Calendar, Clipboard, HelpCircle, Shuffle, Users, Shield } from 'lucide-react';

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
  questions?: any[];
  createdAt: string;
  securitySettings?: SecuritySettings;
}

const AdminQuizzes: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal controls
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);

  const handleHostMultiplayer = async (quizId: string) => {
    try {
      const response = await API.post('/rooms', { quizId });
      const room = response.data.room;
      navigate(`/admin/lobby/${room.roomCode}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create multiplayer room');
    }
  };

  const fetchQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.get('/quizzes');
      setQuizzes(response.data.quizzes || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error fetching quizzes list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleCreateClick = () => {
    setActiveQuiz(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this quiz?')) {
      try {
        await API.delete(`/quizzes/${id}`);
        fetchQuizzes();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to delete quiz');
      }
    }
  };

  const handleModalSave = () => {
    setIsModalOpen(false);
    setActiveQuiz(null);
    fetchQuizzes();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Quiz Management</h2>
          <p className="text-sm text-gray-400 font-medium mt-1">
            Build static quizzes with fixed questions or configure AI Adaptive topic evaluation paths.
          </p>
        </div>
        <button
          onClick={handleCreateClick}
          className="flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Quiz</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {/* Grid of Quizzes */}
      {loading ? (
        <LoadingSpinner />
      ) : quizzes.length === 0 ? (
        <GlassCard className="border border-white/5 py-16 text-center text-gray-500">
          <HelpCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="font-semibold text-lg text-white">No Quizzes Configured</p>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Create your first quiz using the question bank to start serving assessments to students.
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <GlassCard
              key={quiz._id}
              className="border border-white/5 hover:border-indigo-500/30 flex flex-col justify-between"
            >
              <div>
                {/* Badge Category Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`text-[10px] uppercase font-bold px-2.5 py-0.75 rounded-full border flex items-center space-x-1 ${
                      quiz.isAdaptive
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {quiz.isAdaptive ? (
                      <>
                        <Shuffle className="w-3 h-3 mr-1" />
                        <span>Adaptive</span>
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-3 h-3 mr-1" />
                        <span>Static</span>
                      </>
                    )}
                  </span>
                  <div className="flex items-center space-x-2">
                    {quiz.securitySettings?.enforceSecurity && (
                      <span className="flex items-center space-x-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                        <Shield className="w-2.5 h-2.5" />
                        <span>Secured</span>
                      </span>
                    )}
                    <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(quiz.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white mt-4 line-clamp-1">{quiz.title}</h3>
                <p className="text-sm text-gray-400 mt-1.5 line-clamp-2 min-h-[40px]">
                  {quiz.description || 'No description provided.'}
                </p>

                {/* Subtext info */}
                <div className="mt-4 pt-4 border-t border-white/5 text-xs">
                  {quiz.isAdaptive ? (
                    <p className="text-indigo-400 font-medium">
                      Target Topic:{' '}
                      <span className="bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded text-white uppercase text-[10px] ml-1.5 font-bold">
                        {quiz.topic}
                      </span>
                    </p>
                  ) : (
                    <p className="text-emerald-400 font-medium">
                      Questions Linked:{' '}
                      <span className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-white text-[10px] ml-1.5 font-bold">
                        {quiz.questions?.length || 0} items
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2.5 mt-6 pt-4 border-t border-white/5">
                <button
                  onClick={() => handleHostMultiplayer(quiz._id)}
                  className="mr-auto flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/10"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Host Lobby</span>
                </button>
                <button
                  onClick={() => handleEditClick(quiz)}
                  className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteClick(quiz._id)}
                  className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Form Dialog overlay */}
      {isModalOpen && (
        <QuizForm
          quiz={activeQuiz}
          onClose={() => setIsModalOpen(false)}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
};

export default AdminQuizzes;
