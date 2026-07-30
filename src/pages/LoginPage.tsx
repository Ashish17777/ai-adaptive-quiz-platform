import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrainCircuit, GraduationCap, ShieldCheck, ArrowRight, Loader2, Mail, Lock, CheckCircle2 } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password, role);

      if (role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#070b11] text-gray-900 dark:text-gray-100 px-4 py-12 transition-colors">
      {/* Brand Header */}
      <Link to="/" className="flex items-center space-x-3 mb-8 group">
        <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform duration-200">
          <BrainCircuit className="w-7 h-7" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            AdaptiveQuiz
          </span>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            AI-Powered Assessment Platform
          </span>
        </div>
      </Link>

      <div className="w-full max-w-lg bg-white dark:bg-[#0d131f] border border-gray-200 dark:border-gray-800/80 shadow-xl rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome Back
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sign in and select your portal mode to continue
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-sm font-medium animate-fadeIn">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Selection Cards */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2.5">
              Sign In Portal <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Student Role Card */}
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`relative flex flex-col p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  role === 'student'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-2 ring-indigo-600/20 dark:ring-indigo-500/30'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                {role === 'student' && (
                  <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                )}
                <div className={`p-2 rounded-lg w-fit mb-2 ${
                  role === 'student' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="font-semibold text-base text-gray-900 dark:text-white">
                  Student Portal
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                  Access student dashboard, quizzes & AI tutor.
                </span>
              </button>

              {/* Faculty / Admin Role Card */}
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`relative flex flex-col p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  role === 'admin'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-2 ring-indigo-600/20 dark:ring-indigo-500/30'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                {role === 'admin' && (
                  <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                )}
                <div className={`p-2 rounded-lg w-fit mb-2 ${
                  role === 'admin' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="font-semibold text-base text-gray-900 dark:text-white">
                  Faculty / Admin Portal
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                  Access control panel, quiz manager & AI tools.
                </span>
              </button>
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700/80 rounded-xl focus-within:ring-2 focus-within:ring-indigo-600 dark:focus-within:ring-indigo-500 transition-colors">
              <Mail className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@university.edu"
                className="w-full bg-transparent border-none text-sm text-gray-900 dark:text-white focus:outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900/80 border border-gray-300 dark:border-gray-700/80 rounded-xl focus-within:ring-2 focus-within:ring-indigo-600 dark:focus-within:ring-indigo-500 transition-colors">
              <Lock className="w-4 h-4 text-gray-400 mr-3 shrink-0" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent border-none text-sm text-gray-900 dark:text-white focus:outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In as {role === 'admin' ? 'Faculty / Admin' : 'Student'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
