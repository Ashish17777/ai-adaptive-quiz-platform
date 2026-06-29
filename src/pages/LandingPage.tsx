import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Brain, Sparkles, Trophy, Award, Sun, Moon } from 'lucide-react';
import GlassCard from '../components/GlassCard';

const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-md text-white">
              <Brain className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              AdaptiveQuiz
            </span>
          </div>
          <div className="flex items-center space-x-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Dark</span>
                </>
              )}
            </button>

            {user ? (
              <Link
                to={user.role === 'admin' ? '/admin' : '/dashboard'}
                className="text-sm font-semibold px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-16 sm:py-24 flex flex-col items-center justify-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI-Powered Learning</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight max-w-3xl">
          Test Your Skills with{' '}
          <span className="text-blue-600">
            Adaptive Difficulty
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
          An intelligent quiz platform that evaluates your performance in real-time. Answer correctly to unlock harder challenges, or receive easier questions to solidify core concepts.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {user ? (
            <Link
              to={user.role === 'admin' ? '/admin' : '/dashboard'}
              className="w-full sm:w-auto px-8 py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold shadow-sm transition-colors text-center"
            >
              Enter Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold shadow-sm transition-colors text-center"
              >
                Register for Free
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-3 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-base font-semibold transition-colors text-center"
              >
                Sign In
              </Link>
            </>
          )}
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full">
          <GlassCard hoverable className="border border-gray-200 text-left bg-white shadow-sm">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-md w-fit">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mt-4">Adaptive Algorithm</h3>
            <p className="text-gray-600 text-sm mt-2 leading-relaxed">
              Dynamically recalibrates questions based on answers, providing custom learning pathways for every student.
            </p>
          </GlassCard>

          <GlassCard hoverable className="border border-gray-200 text-left bg-white shadow-sm">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-md w-fit">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mt-4">Detailed Analytics</h3>
            <p className="text-gray-600 text-sm mt-2 leading-relaxed">
              Gain visual insights into your progression with customized progress graphs showing scores over historical sessions.
            </p>
          </GlassCard>

          <GlassCard hoverable className="border border-gray-200 text-left bg-white shadow-sm">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-md w-fit">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mt-4">Question Bank Management</h3>
            <p className="text-gray-600 text-sm mt-2 leading-relaxed">
              Allows administrators to easily import, edit, delete, and group questions by difficulty and topic.
            </p>
          </GlassCard>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-gray-500 border-t border-gray-200 bg-white">
        <p>© 2026 AI Adaptive Quiz Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
