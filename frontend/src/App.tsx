/**
 * App.tsx — Root application layout.
 * CSS Grid for responsive dashboard (sidebar + main content area).
 * TanStack QueryClientProvider wraps the entire tree.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sidebar } from '@/components/layout/Sidebar';
import { BalanceCards } from '@/components/dashboard/BalanceCards';
import { QuickEntry } from '@/components/dashboard/QuickEntry';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { Sparkles } from 'lucide-react';
import { FeedbackWidget } from '@/components/layout/FeedbackWidget';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function Overview() {
  return (
    <div className="max-w-7xl mx-auto pt-12 pb-24">
      <div className="flex flex-col gap-16">
        {/* Hero Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <h1 
              className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-500 pb-2"
            >
              Капитал
            </h1>
          </div>
          
          <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] h-fit">
            <Sparkles className="animate-[spin_4s_linear_infinite]" />
            AI Анализ года
          </button>
        </div>

        <BalanceCards />
        <QuickEntry />
      </div>
    </div>
  );
}

import { MainAnalytics } from '@/components/analytics/MainAnalytics';
import { SavingsNavigator } from '@/components/analytics/SavingsNavigator';
import { BudgetList } from '@/components/budgets/BudgetList';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { ProfileSettings } from '@/components/profile/ProfileSettings';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen font-serif font-bold text-aura-emerald animate-pulse text-xl">Инициализация Aura Wealth...</div>;
  if (!token) return <Navigate to="/login" />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen font-serif font-bold text-aura-emerald animate-pulse text-xl">Инициализация Aura Wealth...</div>;
  if (token) return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<PublicRoute><LoginForm /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterForm /></PublicRoute>} />

            {/* Protected Application Routes */}
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/" element={<Overview />} />
              <Route path="/transactions" element={<div className="p-4"><TransactionList /></div>} />
              <Route path="/budgets" element={<div className="p-4"><BudgetList /></div>} />
              <Route path="/analytics" element={<div className="p-4"><MainAnalytics /></div>} />
              <Route path="/savings-navigator" element={<div className="p-4"><SavingsNavigator /></div>} />
              <Route path="/settings/profile" element={<ProfileSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <FeedbackWidget />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
