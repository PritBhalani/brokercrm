import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.ts';

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  isActive: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const initAuth = async () => {
      let token = sessionStorage.getItem('token');
      // Backward compatibility: migrate old shared-token storage to tab-scoped storage.
      if (!token) {
        const legacyToken = localStorage.getItem('token');
        if (legacyToken) {
          sessionStorage.setItem('token', legacyToken);
          localStorage.removeItem('token');
          token = legacyToken;
        }
      }
      if (token) {
        try {
          const response = await api.get('/users/me');
          setUser(response.data);
        } catch (error) {
          console.error('Auth init failed:', error);
          sessionStorage.removeItem('token');
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
      setIsAuthReady(true);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/users/login', { email, password });
      const { token, ...userData } = response.data;
      sessionStorage.setItem('token', token);
      localStorage.removeItem('token');
      setUser(userData);
      navigate('/');
    } catch (error: any) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      sessionStorage.removeItem('token');
      localStorage.removeItem('token');
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAuthReady }}>
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
