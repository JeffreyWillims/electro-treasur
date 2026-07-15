import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sidebar } from '@/components/layout/Sidebar';
import { BalanceCards } from '@/components/dashboard/BalanceCards';
import { QuickEntry } from '@/components/dashboard/QuickEntry';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { Sparkles } from 'lucide-react';
import { FeedbackWidget } from '@/components/layout/FeedbackWidget';
import { InsightModal } from '@/components/insights/InsightModal';
import { lazy, Suspense, useState } from 'react';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { getLocalDateString, getMoscowDate } from '@/lib/dateUtils';
import { motion } from 'framer-motion';
import { GlassDateRangePicker } from '@/components/ui/GlassDateRangePicker';

// Единый инстанс с AuthContext: логин/логаут чистят именно этот кеш,
// иначе данные (цели, транзакции) прошлого аккаунта переживают смену пользователя.
import { queryClient } from '@/lib/queryClient';

function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-[#FDFBF7] dark:bg-[#050505] relative overflow-hidden">
      <Sidebar />

      {/* Основная область контента — с учётом отступов плавающего сайдбара.
          pt-16 на мобильном: фиксированная кнопка-гамбургер (top-4, ~40px)
          не должна перекрывать заголовки страниц; на десктопе её нет. */}
      <main className="flex-1 p-4 pt-16 lg:p-8 lg:pt-8 overflow-y-auto">
        <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh] font-sans font-bold text-[#FF7A00] animate-pulse text-xl">Загрузка...</div>}>
          <Outlet />
        </Suspense>

      </main>
    </div>
  );
}

function Overview() {
  const [startDate, setStartDate] = useState<string>(() => {
    const d = getMoscowDate(); // БЕРЕМ МОСКОВСКОЕ ВРЕМЯ
    d.setDate(1);
    return getLocalDateString(d);
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const d = getMoscowDate(); // БЕРЕМ МОСКОВСКОЕ ВРЕМЯ
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return getLocalDateString(d);
  });

  const [isInsightOpen, setIsInsightOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto pt-12 pb-24">
      <div className="flex flex-col gap-16">
        {/* V.I.A. Command Center */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-2">
          <div className="flex items-center gap-5">
            {/* Строгий геометричный логотип */}
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
              <p className="text-[11px] md:text-[12px] font-mono text-[#1C3F35] dark:text-emerald-400 uppercase tracking-[0.25em] font-bold mt-2">Value Insight Aggregator</p>
            </div>
          </div>
          
          {/* Стеклянная панель управления */}
          <div className="flex flex-wrap items-center gap-3">
            <GlassDateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
              align="right"
            />
            
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
              <span className="text-sm">AI Анализ</span>
            </button>
          </div>
        </div>

        <InsightModal 
          isOpen={isInsightOpen} 
          onClose={() => setIsInsightOpen(false)} 
          startDate={startDate} 
          endDate={endDate} 
        />

        <div className="flex flex-col items-stretch w-full max-w-[1400px] mx-auto gap-8 px-4 lg:px-8">
          <BalanceCards startDate={startDate} endDate={endDate} />
          <QuickEntry />
        </div>
      </div>
    </div>
  );
}

// Lazy: обе страницы тянут recharts (~самый тяжёлый чанк) — не грузим его при старте.
const MainAnalytics = lazy(() =>
  import('@/components/analytics/MainAnalytics').then((m) => ({ default: m.MainAnalytics }))
);
const SavingsNavigator = lazy(() =>
  import('@/components/analytics/SavingsNavigator').then((m) => ({ default: m.SavingsNavigator }))
);
const MyClients = lazy(() =>
  import('@/components/consultant/MyClients').then((m) => ({ default: m.MyClients }))
);
const GamesHub = lazy(() =>
  import('@/components/games/GamesHub').then((m) => ({ default: m.GamesHub }))
);
import { BudgetList } from '@/components/budgets/BudgetList';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { ProfileSettings } from '@/components/profile/ProfileSettings';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen font-sans font-bold text-[#FF7A00] animate-pulse text-xl">Инициализация Citrine Vault...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen font-sans font-bold text-[#FF7A00] animate-pulse text-xl">Инициализация Citrine Vault...</div>;
  if (user) return <Navigate to="/" />;
  return <>{children}</>;
}

function ThemeAwareToaster() {
  const { isDarkMode } = useTheme();
  return (
    <Toaster
      position="top-right"
      theme={isDarkMode ? 'dark' : 'light'}
      toastOptions={{
        classNames: {
          // Оранжевый фон, белые буквы, стеклянный эффект
          toast: '!bg-[#FF7A00] !backdrop-blur-3xl !border !border-white/20 !shadow-2xl !rounded-2xl !font-sans !text-white',
          title: '!font-extrabold !tracking-tight !text-[15px]',
          description: '!font-mono !uppercase !tracking-widest !text-[10px] !opacity-90',
          // Иконки и акценты тоже белые
          success: '!text-white',
          error: '!bg-rose-500 !text-white !border-white/20',
          info: '!bg-[#1C3F35] !text-white !border-white/20',
          icon: '!text-white',
        }
      }}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Публичные роуты авторизации */}
              <Route path="/login" element={<PublicRoute><LoginForm /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><RegisterForm /></PublicRoute>} />

              {/* Защищённые роуты приложения (убраны лишние div) */}
              <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route path="/" element={<Overview />} />
                <Route path="/transactions" element={<TransactionList />} />
                <Route path="/budgets" element={<BudgetList />} />
                <Route path="/analytics" element={<MainAnalytics />} />
                <Route path="/savings-navigator" element={<SavingsNavigator />} />
                <Route path="/consultant" element={<MyClients />} />
                <Route path="/games" element={<GamesHub />} />
                <Route path="/settings/profile" element={<ProfileSettings />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <FeedbackWidget />
          <ThemeAwareToaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}