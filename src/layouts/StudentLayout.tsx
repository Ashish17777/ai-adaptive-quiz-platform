import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

const StudentLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#070b11]">
      <Navbar />
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
      <footer className="py-6 text-center text-xs text-gray-600 border-t border-white/5 bg-[#090d16]/30">
        <p>© 2026 AI Adaptive Quiz Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default StudentLayout;
