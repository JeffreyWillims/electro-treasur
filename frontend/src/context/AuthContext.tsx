/* eslint-disable */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchMe, login as apiLogin, register as apiRegister } from '@/api/client';
import { queryClient } from '@/lib/queryClient';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  monthly_income: number | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (payload: { email: string; password: string; full_name?: string; phone?: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('aura_token'));
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const userData = await fetchMe();
      setUser(userData);
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, pass: string) => {
    // CRITICAL: Clear ALL cached data from previous user session
    // This prevents data leakage between user accounts
    queryClient.clear();

    const data = await apiLogin(email, pass);
    localStorage.setItem('aura_token', data.access_token);
    setToken(data.access_token);
  };

  const register = async (payload: { email: string; password: string; full_name?: string; phone?: string }) => {
    // CRITICAL: Clear cache before new user session
    queryClient.clear();

    await apiRegister(payload);
    await login(payload.email, payload.password);
  };

  const logout = () => {
    localStorage.removeItem('aura_token');
    setToken(null);
    setUser(null);
    // CRITICAL: Purge all cached query data to prevent data leakage
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
