import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Brain, Sparkles, Trophy, Award, Sun, Moon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black">
      {/* Navigation Header */}
      <header className="bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-6 py-3.5 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-md text-white">
              <Brain className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              AdaptiveQuiz
            </span>
          </div>
          <div className="flex items-center space-x-4">
            {/* Theme Toggle Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full w-9 h-9"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-blue-400" />
              )}
            </Button>

            {user ? (
              <Button asChild>
                <Link to={user.role === 'admin' ? '/admin' : '/dashboard'}>
                  Go to Dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-16 sm:py-24 flex flex-col items-center justify-center text-center">
        {/* Badge */}
        <Badge variant="secondary" className="mb-6 px-3 py-1 flex items-center space-x-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
          <Sparkles className="w-3.5 h-3.5 mr-1" />
          <span>AI-Powered Learning</span>
        </Badge>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight max-w-3xl">
          Test Your Skills with{' '}
          <span className="text-indigo-600 dark:text-indigo-400">
            Adaptive Difficulty
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
          An intelligent quiz platform that evaluates your performance in real-time. Answer correctly to unlock harder challenges, or receive easier questions to solidify core concepts.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          {user ? (
            <Button size="lg" className="w-full sm:w-auto px-8" asChild>
              <Link to={user.role === 'admin' ? '/admin' : '/dashboard'}>
                Enter Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button size="lg" className="w-full sm:w-auto px-8" asChild>
                <Link to="/register">Register for Free</Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </>
          )}
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full">
          <Card className="text-left bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg w-fit">
                <Brain className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                Adaptive Algorithm
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Dynamically recalibrates questions based on answers, providing custom learning pathways for every student.
              </p>
            </CardContent>
          </Card>

          <Card className="text-left bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg w-fit">
                <Trophy className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                Detailed Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Gain visual insights into your progression with customized progress graphs showing scores over historical sessions.
              </p>
            </CardContent>
          </Card>

          <Card className="text-left bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg w-fit">
                <Award className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                Question Bank Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Allows administrators to easily import, edit, delete, and group questions by difficulty and topic.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <p>© 2026 AI Adaptive Quiz Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
