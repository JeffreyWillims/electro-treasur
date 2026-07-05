/* eslint-disable */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister } from '@/api/client';
import { queryClient } from '@/lib/queryClient';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  monthly_income: number | null;
  role: 'user' | 'consultant';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (payload: { email: string; password: string; full_name?: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Состояние авторизации определяется НАЛИЧИЕМ user (cookie не читается из JS).
  // На старте пробуем получить профиль по cookie; 401 → пользователь не залогинен.
  const refreshUser = useCallback(async () => {
    try {
      const userData = await fetchMe();
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, pass: string) => {
    // CRITICAL: Clear ALL cached data from previous user session
    // This prevents data leakage between user accounts
    queryClient.clear();

    await apiLogin(email, pass); // бэкенд ставит httpOnly-cookie
    const userData = await fetchMe(); // подтягиваем профиль → пользователь залогинен
    setUser(userData);
  };

  const register = async (payload: { email: string; password: string; full_name?: string; phone?: string }) => {
    // CRITICAL: Clear cache before new user session
    queryClient.clear();

    await apiRegister(payload);
    await login(payload.email, payload.password);
  };

  const logout = async () => {
    try {
      await apiLogout(); // бэкенд отзывает refresh и чистит cookie
    } catch {
      // Даже если запрос не прошёл — локально разлогиниваемся.
    }
    setUser(null);
    // CRITICAL: Purge all cached query data to prevent data leakage
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
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
