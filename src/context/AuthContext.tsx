import React, { createContext, useContext, useState, useEffect } from 'react';
import authClient from '../utils/auth-client';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, role?: 'student' | 'admin') => Promise<void>;
  register: (name: string, email: string, password: string, role: 'student' | 'admin') => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const getApiUrl = (endpoint: string) => {
  const envUrl = import.meta.env.VITE_API_URL;
  const baseUrl = envUrl ? (envUrl.endsWith('/api') ? envUrl.slice(0, -4) : envUrl) : `${window.location.protocol}//${window.location.hostname}:5000`;
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
};

const safeFetchJson = async (url: string, options: RequestInit = {}) => {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    if (!text || text.trim() === '') return { ok: res.ok, data: {} };
    try {
      return { ok: res.ok, data: JSON.parse(text) };
    } catch (_) {
      return { ok: res.ok, data: { message: text } };
    }
  } catch (err: any) {
    return { ok: false, data: { message: err.message || 'Network error' } };
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, isPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;

    if (session?.user) {
      const savedUserStr = localStorage.getItem('user');
      let sessionRole = ((session.user as any).role as 'student' | 'admin') || 'student';
      if (savedUserStr) {
        try {
          const saved = JSON.parse(savedUserStr);
          if (saved.role) sessionRole = saved.role;
        } catch (_) {}
      }

      const mappedUser: User = {
        _id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: sessionRole,
      };
      const sessionToken = session.session?.token || localStorage.getItem('token') || '';

      setUser(mappedUser);
      setToken(sessionToken);
      localStorage.setItem('token', sessionToken);
      localStorage.setItem('user', JSON.stringify(mappedUser));
    } else {
      // Check if local token fallback exists
      const savedUserStr = localStorage.getItem('user');
      const savedToken = localStorage.getItem('token');
      if (savedUserStr && savedToken) {
        try {
          setUser(JSON.parse(savedUserStr));
          setToken(savedToken);
        } catch (_) {}
      } else {
        setUser(null);
        setToken(null);
      }
    }
  }, [session, isPending]);

  const login = async (email: string, password: string, role?: 'student' | 'admin') => {
    setError(null);
    try {
      // Direct login to backend API to authenticate and update role in DB before session change
      const { ok, data } = await safeFetchJson(getApiUrl('/api/legacy-auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });

      if (ok && data.success && data.token) {
        const mappedUser: User = {
          _id: data._id,
          name: data.name,
          email: data.email,
          role: role || data.role || 'student',
        };
        setUser(mappedUser);
        setToken(data.token);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(mappedUser));

        // Also trigger Better Auth signIn asynchronously for cookie synchronization
        authClient.signIn.email({ email, password }).catch(() => {});
        return;
      }

      // If backend login fails, try authClient
      const res = await authClient.signIn.email({ email, password });
      if (res?.error) {
        throw new Error(res.error.message || data?.message || 'Login failed. Invalid credentials.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Login failed. Please check credentials.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const register = async (name: string, email: string, password: string, role: 'student' | 'admin') => {
    setError(null);
    try {
      const { ok, data } = await safeFetchJson(getApiUrl('/api/legacy-auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });

      if (ok && data.success && data.token) {
        const mappedUser: User = {
          _id: data._id,
          name: data.name,
          email: data.email,
          role: role || data.role || 'student',
        };
        setUser(mappedUser);
        setToken(data.token);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(mappedUser));

        authClient.signUp.email({ name, email, password, role } as any).catch(() => {});
        return;
      }

      const res = await authClient.signUp.email({ name, email, password, role } as any);
      if (res?.error) {
        throw new Error(res.error.message || data?.message || 'Registration failed.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Registration failed. Try again.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const logout = async () => {
    try {
      await authClient.signOut().catch(() => {});
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, token, loading: isPending, error, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
