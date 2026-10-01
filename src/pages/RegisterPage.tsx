import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import OTPVerificationModal from '../components/OTPVerificationModal';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { BrainCircuit, Mail, Lock, User } from 'lucide-react';
import API from '../services/api';

const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const { setUserInContext } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !email.trim() || !password) {
      return setFormError('All fields are required');
    }
    if (password.length < 6) {
      return setFormError('Password must be at least 6 characters');
    }
    if (password !== confirmPassword) {
      return setFormError('Passwords do not match');
    }

    setLoading(true);
    try {
      const response = await API.post('/auth/register', {
        name,
        email,
        password,
        role,
      });

      if (response.data.requiresVerification) {
        setRegisteredEmail(response.data.email);
        setShowOtpModal(true);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Registration failed. Email might already be taken.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSuccess = (userData: any) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userData.token);
    setUserInContext(userData);
    setShowOtpModal(false);
    navigate(userData.role === 'admin' ? '/admin' : '/dashboard');
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) return;

    setLoading(true);
    setFormError(null);

    try {
      const res = await API.post('/auth/google', {
        credential: credentialResponse.credential,
        role,
      });

      if (res.data.success) {
        localStorage.setItem('user', JSON.stringify(res.data));
        localStorage.setItem('token', res.data.token);
        setUserInContext(res.data);
        navigate(res.data.role === 'admin' ? '/admin' : '/dashboard');
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Google Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12">
      {/* Brand Header */}
      <Link to="/" className="flex items-center space-x-2.5 mb-8 group">
        <div className="bg-blue-600 p-2.5 rounded-md text-white shadow-sm transition-colors">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-gray-900">
          AdaptiveQuiz
        </span>
      </Link>

      <GlassCard className="w-full max-w-md border border-gray-200 bg-white shadow-sm p-8 rounded-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Create Account</h2>
          <p className="text-sm text-gray-500 mt-1.5 font-medium">
            Join the platform and start taking adaptive quizzes
          </p>
        </div>

        {formError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-md font-medium">
            {formError}
          </div>
        )}

        {/* Google OAuth Button */}
        <div className="mb-5 flex flex-col items-center justify-center w-full">
          <div className="w-full flex justify-center">
            <GoogleAuthButton
              onSuccess={handleGoogleSuccess}
              onError={() => setFormError('Google Login encountered an issue.')}
              text="signup_with"
            />
          </div>
          <div className="relative my-4 w-full text-center border-b border-gray-200 leading-[0.1em]">
            <span className="bg-white px-3 text-xs text-gray-400 font-semibold uppercase">Or with Email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none z-10" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                style={{ paddingLeft: '2.75rem' }}
                className="w-full pr-4 py-3 glass-input text-sm rounded-md border border-gray-300"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none z-10" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ paddingLeft: '2.75rem' }}
                className="w-full pr-4 py-3 glass-input text-sm rounded-md border border-gray-300"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
              Account Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`py-2 px-4 text-xs font-bold border rounded-md transition-all ${
                  role === 'student'
                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`py-2 px-4 text-xs font-bold border rounded-md transition-all ${
                  role === 'admin'
                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                Administrator
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  style={{ paddingLeft: '2.75rem' }}
                  className="w-full pr-4 py-3 glass-input text-sm rounded-md border border-gray-300"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••"
                  style={{ paddingLeft: '2.75rem' }}
                  className="w-full pr-4 py-3 glass-input text-sm rounded-md border border-gray-300"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 text-sm font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            {loading ? 'Registering Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-600 font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </GlassCard>

      {/* 6-Digit Email OTP Verification Modal */}
      <OTPVerificationModal
        email={registeredEmail}
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onSuccess={handleOtpSuccess}
      />
    </div>
  );
};

export default RegisterPage;
