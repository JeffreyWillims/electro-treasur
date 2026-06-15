import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import { fetchDashboard } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { CategoryRowSchema } from '@/types';
import { getLocalDateString, getMoscowDate } from '@/lib/dateUtils'; // 🔥 ИСПРАВЛЕНИЕ МСК
import { useState } from 'react';

export function SafeToSpend() {
  const { user } = useAuth();
  const [showTooltip, setShowTooltip] = useState(false);

  // 🔥 ИСПРАВЛЕНИЕ BUG-2 & BUG-3: Синхронизация ключей кэша и МСК
  const d = getMoscowDate();
  const start = getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
  const end = getLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', start, end],
    queryFn: () => fetchDashboard(start, end),
  });

  if (isLoading) {
    return (
      <div className="w-full bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl rounded-[2.5rem] p-12 min-h-[300px] flex items-center justify-center border border-black/5 dark:border-white/10 shadow-2xl">
         <motion.div
           className="w-10 h-10 border-2 border-[#1C3F35]/20 dark:border-white/20 border-t-[#FF7A00] rounded-full"
           animate={{ rotate: 360 }}
           transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
         />
      </div>
    );
  }

  const expenseRows = dashboard?.rows.filter((r) => Number(r.planned) > 0) || [];
  const totalPlanned = expenseRows.reduce((acc: number, row: CategoryRowSchema) => acc + Number(row.planned), 0);
  const overspent = expenseRows.reduce((acc: number, row: CategoryRowSchema) => acc + Math.max(0, Number(row.fact) - Number(row.planned)), 0);

  // 🔥 ИСПРАВЛЕНИЕ МСК ВРЕМЕНИ (BUG-3)
  const today = getMoscowDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(0, daysInMonth - today.getDate() + 1);

  const monthlyIncome = Number(user?.monthly_income) || Number(dashboard?.period_income) || 0;
  const limit = daysLeft > 0 ? Math.max(0, (monthlyIncome - totalPlanned - overspent) / daysLeft) : 0;

  return (
    <div className="w-full bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl transition-all duration-500 z-30">

      <div className="absolute left-6 top-6 w-24 h-24 pointer-events-none opacity-20 dark:opacity-30 z-0">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_rgba(255,122,0,0.4)]">
          <motion.circle
            cx="50" cy="50" r="45"
            stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4"
            className="text-[#1C3F35] dark:text-emerald-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M50 20L80 50L50 80L20 50L50 20Z"
            fill="url(#citrineGradient)"
            animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <defs>
            <linearGradient id="citrineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF7A00" />
              <stop offset="100%" stopColor="#FFA011" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#FF7A00]/[0.05] rounded-full blur-3xl transition-all duration-700 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center text-center gap-6 w-full mt-2">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl md:text-3xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
            Безопасный лимит
          </h2>
        </div>

        <div className="flex flex-col items-center justify-center w-full gap-3">
          <span className="text-5xl md:text-7xl font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white leading-none">
            {limit.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-sm md:text-base font-sans font-extrabold uppercase tracking-widest text-[#1C3F35] dark:text-emerald-500">
            ₽ / День
          </span>
        </div>
      </div>

      <div
        className="absolute bottom-6 right-6 z-50 flex items-center justify-end"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-0 right-14 w-64 p-5 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] pointer-events-none origin-bottom-right"
            >
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00] mb-2.5">Как это работает?</p>
              <p className="text-[11px] font-mono text-[#1C3F35] dark:text-white/80 leading-relaxed tracking-wide">
                Это сумма, которую вы можете тратить каждый день до конца месяца, не нарушая свои планы. Она учитывает ваши доходы и лимиты в конвертах.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center cursor-help hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-[#1C3F35]/50 dark:text-white/50">
          <Info className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}