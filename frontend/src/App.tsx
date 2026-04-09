/**
 * App.tsx — Root application layout for Citrine Vault.
 * CSS Grid for responsive dashboard (floating sidebar + main content area).
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
import { InsightModal } from '@/components/insights/InsightModal';
import { useState } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { motion } from 'framer-motion';

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
    <div className="flex min-h-screen bg-[#FDFBF7] dark:bg-[#050505] transition-colors duration-500 relative overflow-hidden">
      <div className="absolute left-[-2%] -top-[5%] h-[110%] w-32 bg-[#1C3F35]/30 filter blur-[80px] animate-liquid-interference pointer-events-none z-0" />
      <div className="absolute left-0 -top-[10%] h-[120%] w-48 bg-[#3A8248]/50 filter blur-[80px] animate-liquid-pillar pointer-events-none z-0" />
      <Sidebar />

      {/* Main Content Area — accounts for floating sidebar margins */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function Overview() {
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
        {/* V.I.A. Command Center */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-2">
          <div className="flex items-center gap-5">
            {/* Strict Geometric Logo */}
            <div className="relative w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#1C3F35] to-[#0A1A12] dark:from-[#050505] dark:to-[#111111] shadow-lg shadow-emerald-900/10 overflow-hidden border border-white/10">
              <svg viewBox="0 0 100 100" className="w-14 h-14 drop-shadow-[0_0_8px_rgba(255,122,0,0.8)] z-10" fill="none" strokeWidth="3.5">
                <circle cx="50" cy="50" r="30" stroke="#FF7A00" strokeOpacity="0.3" />
                <path d="M 50 10 L 50 90 M 10 50 L 90 50" stroke="#FF7A00" strokeOpacity="0.3" />
                <path d="M 28 28 L 72 72 M 28 72 L 72 28" stroke="#FF7A00" strokeOpacity="0.15" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="32"
                  stroke="#FF7A00"
                  strokeDasharray="15 173"
                  strokeLinecap="round"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  style={{ transformOrigin: "50px 50px", filter: "drop-shadow(0 0 8px #FF7A00)" }}
                />
              </svg>
            </div>
            <div>
              <h1 className="text-[2.5rem] font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
                V.I.A.
              </h1>
              <p className="text-[#1C3F35]/70 dark:text-white/60 text-[11px] font-bold font-mono tracking-widest uppercase mt-1">Value Insight Aggregator</p>
            </div>
          </div>
          
          {/* Glass Control Panel */}
          <div className="flex flex-wrap items-center gap-3 bg-white/60 dark:bg-[#111111]/80 backdrop-blur-xl border border-vault-pine/10 dark:border-white/5 rounded-full p-1.5 shadow-sm">
            <div className="flex items-center gap-2 px-3">
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="appearance-none bg-transparent text-vault-pine dark:text-white/80 text-sm font-semibold outline-none cursor-pointer"
                style={{ colorScheme: 'light dark' }}
              />
              <span className="text-vault-pine/20 dark:text-white/20 font-medium text-sm">—</span>
               <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="appearance-none bg-transparent text-vault-pine dark:text-white/80 text-sm font-semibold outline-none cursor-pointer"
                style={{ colorScheme: 'light dark' }}
              />
            </div>
            
            <button 
              className="flex items-center gap-2 bg-[#1C3F35] dark:bg-[#FF7A00] hover:bg-[#1C3F35]/90 dark:hover:bg-[#FF7A00]/90 text-white font-semibold py-2 px-5 rounded-full shadow-lg transition-transform duration-300 active:scale-[0.98]"
              onClick={() => setIsInsightOpen(true)}
            >
              <motion.div
                animate={{ rotate: [0, 180, 360], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
              <span className="text-sm">Анализ потоков</span>
            </button>
          </div>
        </div>

        <InsightModal 
          isOpen={isInsightOpen} 
          onClose={() => setIsInsightOpen(false)} 
          startDate={startDate} 
          endDate={endDate} 
        />

        <BalanceCards startDate={startDate} endDate={endDate} />
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
  if (isLoading) return <div className="flex items-center justify-center min-h-screen font-sans font-bold text-[#FF7A00] animate-pulse text-xl">Инициализация Citrine Vault...</div>;
  if (!token) return <Navigate to="/login" />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen font-sans font-bold text-[#FF7A00] animate-pulse text-xl">Инициализация Citrine Vault...</div>;
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
