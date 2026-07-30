import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { LogOut, BrainCircuit, Sun, Moon, LayoutDashboard, BarChart3, GraduationCap, Shield } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSwitchRole = async (newRole: 'student' | 'admin') => {
    try {
      const token = localStorage.getItem('token');
      const targetUrl = `${window.location.protocol}//${window.location.hostname}:5000/api/user/role`;
      const res = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        window.location.href = newRole === 'admin' ? '/admin' : '/dashboard';
      } else {
        const text = await res.text();
        let message = 'Failed to switch role';
        try { message = JSON.parse(text).message || message; } catch (_) {}
        alert(message);
      }
    } catch (err) {
      console.error('Failed to switch role:', err);
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 px-6 py-3.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="bg-indigo-600 p-2 rounded-md text-white transition-colors">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">
            AdaptiveQuiz
          </span>
        </Link>

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
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 focus:outline-none cursor-pointer">
                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-sm hover:opacity-90 transition-opacity">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-indigo-600 font-medium capitalize truncate">
                        {user.role === 'admin' ? 'Faculty / Admin Account' : 'Student Account'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === 'admin' ? (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="w-full flex items-center space-x-2">
                          <Shield className="w-4 h-4 text-indigo-600" />
                          <span className="font-medium">Admin Panel</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSwitchRole('student')} className="text-gray-600 hover:text-gray-900">
                        <GraduationCap className="w-4 h-4 mr-2" />
                        <span>Switch to Student View</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard" className="w-full flex items-center space-x-2">
                          <LayoutDashboard className="w-4 h-4" />
                          <span>Student Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard/analytics" className="w-full flex items-center space-x-2">
                          <BarChart3 className="w-4 h-4" />
                          <span>My Analytics</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard/ai-tutor" className="w-full flex items-center space-x-2 text-indigo-600 font-semibold">
                          <GraduationCap className="w-4 h-4" />
                          <span>AI Tutor</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleSwitchRole('admin')} className="text-indigo-600 font-medium">
                        <Shield className="w-4 h-4 mr-2" />
                        <span>Switch to Faculty / Admin</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:bg-red-50">
                    <LogOut className="w-4 h-4 mr-2" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Button variant="ghost" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Register</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
