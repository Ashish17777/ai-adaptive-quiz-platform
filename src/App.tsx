import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Layouts
import ProtectedLayout from './layouts/ProtectedLayout';
import AdminLayout from './layouts/AdminLayout';
import StudentLayout from './layouts/StudentLayout';

// Public Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentJoin from './pages/StudentJoin';
import StudentLobby from './pages/StudentLobby';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import AdminQuestions from './pages/AdminQuestions';
import AdminQuizzes from './pages/AdminQuizzes';
import HostLobby from './pages/HostLobby';

// Student Pages
import StudentDashboard from './pages/StudentDashboard';
import QuizPage from './pages/QuizPage';
import ResultPage from './pages/ResultPage';
import StudentAnalytics from './pages/StudentAnalytics';
import AdminAnalytics from './pages/AdminAnalytics';
import AIReportCard from './pages/AIReportCard';
import LearningPath from './pages/LearningPath';
import PracticeQuiz from './pages/PracticeQuiz';
import AITutor from './pages/AITutor';
import AdminAIInsights from './pages/AdminAIInsights';
import AdminAIQuestionGenerator from './pages/AdminAIQuestionGenerator';
import AdminAIQuizGenerator from './pages/AdminAIQuizGenerator';
import AdminSecurityDashboard from './pages/AdminSecurityDashboard';
import AdminIntelligenceDashboard from './pages/AdminIntelligenceDashboard';
import LiveDashboard from './pages/LiveDashboard';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/multiplayer/join" element={<StudentJoin />} />
            <Route path="/multiplayer/lobby/:roomCode" element={<StudentLobby />} />

            {/* Student Protected Routes */}
            <Route element={<ProtectedLayout allowedRoles={['student', 'admin']} />}>
              <Route element={<StudentLayout />}>
                <Route path="/dashboard" element={<StudentDashboard />} />
                <Route path="/dashboard/analytics" element={<StudentAnalytics />} />
                <Route path="/dashboard/report/:attemptId" element={<AIReportCard />} />
                <Route path="/dashboard/learning-path" element={<LearningPath />} />
                <Route path="/dashboard/practice" element={<PracticeQuiz />} />
                <Route path="/dashboard/ai-tutor" element={<AITutor />} />
                <Route path="/quiz/:quizId" element={<QuizPage />} />
                <Route path="/result/:attemptId" element={<ResultPage />} />
              </Route>
            </Route>

            {/* Admin Protected Routes */}
            <Route element={<ProtectedLayout allowedRoles={['admin']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/questions" element={<AdminQuestions />} />
                <Route path="/admin/quizzes" element={<AdminQuizzes />} />
                <Route path="/admin/ai-insights" element={<AdminAIInsights />} />
                <Route path="/admin/ai-question-generator" element={<AdminAIQuestionGenerator />} />
                <Route path="/admin/ai-quiz-generator" element={<AdminAIQuizGenerator />} />
                <Route path="/admin/security" element={<AdminSecurityDashboard />} />
                <Route path="/admin/intelligence" element={<AdminIntelligenceDashboard />} />
                <Route path="/admin/live" element={<LiveDashboard />} />
              </Route>
              <Route path="/admin/lobby/:roomCode" element={<HostLobby />} />
            </Route>

            {/* Fallback Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
