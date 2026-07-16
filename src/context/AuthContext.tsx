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
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: 'student' | 'admin') => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session, isPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Don't update state while session is still loading
    if (isPending) return;

    if (session?.user) {
      const mappedUser: User = {
        _id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: ((session.user as any).role as 'student' | 'admin') || 'student',
      };
      const sessionToken = session.session?.token || '';

      setUser(mappedUser);
      setToken(sessionToken);
      localStorage.setItem('token', sessionToken);
      localStorage.setItem('user', JSON.stringify(mappedUser));
    } else {
      // Confirmed logged out
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }, [session, isPending]);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const res = await authClient.signIn.email({ email, password });
      if (res?.error) {
        throw new Error(res.error.message || 'Login failed');
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
      const res = await authClient.signUp.email({ name, email, password, role } as any);
      if (res?.error) {
        throw new Error(res.error.message || 'Registration failed');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Registration failed. Try again.';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const logout = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error('Logout error:', err);
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
