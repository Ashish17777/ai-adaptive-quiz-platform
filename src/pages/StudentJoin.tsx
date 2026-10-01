import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import { BrainCircuit, KeyRound, User, ArrowRight } from 'lucide-react';

const StudentJoin: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  // Pre-fill display name if user is logged in and room code from query parameters
  useEffect(() => {
    if (user) {
      setDisplayName(user.name);
    }
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam && codeParam.length === 6 && !isNaN(Number(codeParam))) {
      setRoomCode(codeParam);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formattedCode = roomCode.trim();
    if (formattedCode.length !== 6 || isNaN(Number(formattedCode))) {
      return setError('Room code must be a 6-digit number');
    }

    if (!displayName.trim()) {
      return setError('Please enter a display name');
    }

    setLoading(true);
    try {
      // Call API to check if room exists and is in waiting state
      const response = await API.get(`/rooms/${formattedCode}`);
      const room = response.data.room;

      if (room.status !== 'waiting') {
        setError('This quiz lobby has already started or is completed');
        setLoading(false);
        return;
      }

      // Save player details in localStorage to persist on page loads
      localStorage.setItem(`room_player_${formattedCode}`, JSON.stringify({
        name: displayName.trim(),
        userId: user?._id || null,
      }));

      // Redirect to the waiting lobby page
      navigate(`/multiplayer/lobby/${formattedCode}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Quiz room not found. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b11] px-4 py-12">
      {/* Brand Header */}
      <Link to="/" className="flex items-center space-x-2.5 mb-8 group">
        <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-600/20 group-hover:bg-indigo-500 transition-colors">
          <BrainCircuit className="w-7 h-7" />
        </div>
        <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          AdaptiveQuiz
        </span>
      </Link>

      <GlassCard className="w-full max-w-md border border-white/5 shadow-2xl p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">Join Multiplayer Quiz</h2>
          <p className="text-sm text-gray-400 mt-1.5 font-medium">
            Enter the 6-digit room code to join your class lobby
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2.5 rounded-lg font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Room PIN Code
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500 pointer-events-none z-10" />
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={{ paddingLeft: '2.75rem' }}
                className="w-full pr-4 py-3 glass-input text-lg tracking-widest font-mono font-bold text-center"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Your Screen Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500 pointer-events-none z-10" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter nickname"
                style={{ paddingLeft: '2.75rem' }}
                className="w-full pr-4 py-3 glass-input text-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/10 transition-all flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Joining Room...' : 'Enter Lobby'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-white/5 pt-4">
          <Link to="/" className="text-xs text-gray-500 hover:text-gray-400 transition-colors font-medium">
            &larr; Back to Landing Page
          </Link>
        </div>
      </GlassCard>
    </div>
  );
};

export default StudentJoin;
