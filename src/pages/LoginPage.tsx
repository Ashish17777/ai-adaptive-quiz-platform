import React from 'react';
import { Link } from 'react-router-dom';
import { SignInForm, authLocalization } from '@daveyplate/better-auth-ui';
import { BrainCircuit } from 'lucide-react';

const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-black px-4 py-12">
      {/* Brand Header */}
      <Link to="/" className="flex items-center space-x-2.5 mb-8 group">
        <div className="bg-indigo-600 p-2.5 rounded-md text-white shadow-sm transition-colors">
          <BrainCircuit className="w-6 h-6" />
        </div>
        <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          AdaptiveQuiz
        </span>
      </Link>

      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-250 dark:border-zinc-800 shadow-sm p-6 rounded-xl">
        <SignInForm localization={authLocalization} />
      </div>
    </div>
  );
};

export default LoginPage;
