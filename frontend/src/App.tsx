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
import { Sparkles, Wallet } from 'lucide-react';
import { FeedbackWidget } from '@/components/layout/FeedbackWidget';
import { InsightModal } from '@/components/insights/InsightModal';
import { useState } from 'react';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

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
    <div className="flex min-h-screen bg-white dark:bg-[#0A0A0A] transition-colors duration-500">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function Overview() {
  const { isDarkMode } = useTheme();
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0] as string;
  });
  
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().split('T')[0] as string;
  });

  const [isInsightOpen, setIsInsightOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto pt-12 pb-24">
      <div className="flex flex-col gap-16">
        {/* Hero Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <Wallet className="w-10 h-10 text-emerald-600 drop-shadow-sm" strokeWidth={2} />
              <h1 
                className="text-[2.5rem] font-extrabold text-slate-800 dark:text-slate-100 tracking-tight transition-colors duration-500" 
                style={{ 
                  textShadow: isDarkMode 
                    ? "1px 1px 0px rgba(0,0,0,0.8), -1px -1px 0px rgba(255,255,255,0.1), 0px 4px 10px rgba(0,0,0,0.5)" 
                    : "1px 1px 0px rgba(255,255,255,1), 0px 4px 12px rgba(0,0,0,0.06)" 
                }}
              >
                Electro Treasur
              </h1>
            </div>
          </div>
          
          <button 
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 px-6 rounded-full shadow-lg dark:shadow-emerald-500/20 transition-all active:scale-[0.98]"
            onClick={() => setIsInsightOpen(true)}
          >
            <Sparkles className="animate-pulse w-5 h-5" />
            AI Анализ потоков
          </button>
        </div>

        <InsightModal 
          isOpen={isInsightOpen} 
          onClose={() => setIsInsightOpen(false)} 
          startDate={startDate} 
          endDate={endDate} 
        />

        <BalanceCards startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} />
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
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
