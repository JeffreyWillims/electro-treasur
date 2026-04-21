import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { fetchDashboard } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { CategoryRowSchema } from '@/types';

export function SafeToSpend() {
  const { user } = useAuth();
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', 'current'],
    queryFn: () => {
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0] as string;
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] as string;
      return fetchDashboard(start, end);
    },
  });

  const { data: prevDashboard } = useQuery({
    queryKey: ['dashboard', 'prev'],
    queryFn: () => {
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0] as string;
      const end = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0] as string;
      return fetchDashboard(start, end);
    },
  });

  if (isLoading) {
    return (
      <div className="w-full premium-card p-12 min-h-[400px] flex items-center justify-center backdrop-blur-3xl backdrop-saturate-150 bg-white/40 dark:bg-[#111111]/40 border border-white/20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#FF7A00]/20 border-t-[#FF7A00] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // ── Calculation Logic (Quantum Liquidity Protocol) ──────────────────
  
  // Total Planned Expenses (Reserved for Envelopes)
  const expenseRows = dashboard?.rows.filter((r) => Number(r.planned) > 0) || [];
  
  const totalPlanned = expenseRows.reduce((acc: number, row: CategoryRowSchema) => acc + Number(row.planned), 0);
  
  const overspent = expenseRows.reduce((acc: number, row: CategoryRowSchema) => acc + Math.max(0, Number(row.fact) - Number(row.planned)), 0);

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(0, daysInMonth - today.getDate() + 1);

  const monthlyIncome = Number(user?.monthly_income) || Number(dashboard?.period_income) || 0;
  
  const limit = daysLeft > 0 ? Math.max(0, (monthlyIncome - totalPlanned - overspent) / daysLeft) : 0;
  console.log("MATH_CHECK:", { monthlyIncome, totalPlanned, overspent, daysLeft, limit });


  // Rollover (⛄) calculation from previous month
  const prevIncome = parseFloat(prevDashboard?.period_income || '0');
  const prevExpense = parseFloat(prevDashboard?.period_expense || '0');
  const rollover = Math.max(0, prevIncome - prevExpense);

  return (
    <div className="w-full premium-card rounded-3xl p-6 md:p-8 relative backdrop-blur-[60px] backdrop-saturate-200 bg-white/60 dark:bg-[#111111]/60 border border-white/30 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] sticky top-4 z-40 transition-all duration-300 group">
      {/* Кинетическое Ядро (The Citrine Core SVG) */}
      <div className="absolute left-6 top-6 w-24 h-24 pointer-events-none opacity-20 dark:opacity-40">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Внешнее кольцо (медленное вращение) */}
          <motion.circle 
            cx="50" cy="50" r="45" 
            stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4"
            className="text-emerald-600 dark:text-emerald-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          {/* Внутренний кристалл (пульсация) */}
          <motion.path 
            d="M50 20L80 50L50 80L20 50L50 20Z" 
            fill="url(#citrineGradient)"
            animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <defs>
            <linearGradient id="citrineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF7A00" />
              <stop offset="100%" stopColor="#FFA011" />
            </linearGradient>
          </defs>
          {/* Направляющие линии */}
          <path d="M50 5V15M50 85V95M5 50H15M85 50H95" stroke="currentColor" strokeWidth="1" className="text-emerald-500" />
        </svg>
      </div>

      {/* Decorative background glow */}
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#FF7A00]/[0.04] rounded-3xl blur-3xl transition-all duration-700 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center justify-center text-center gap-4 w-full">
        {/* Centered Header Section */}
        <h2 className="text-2xl md:text-3xl font-extrabold text-[#1C3F35] dark:text-emerald-50 tracking-tight" style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.05)" }}>
          Безопасный лимит
        </h2>

        {rollover > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider"
          >
            <span>⛄ Rollover:</span>
            <span>+{rollover.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</span>
          </motion.div>
        )}

        <div className="flex flex-col items-center justify-center w-full gap-1">
          <span 
            className="text-5xl md:text-7xl font-black tracking-tighter tabular-nums text-[#1C3F35] dark:text-white transition-all"
            style={{ textShadow: "3px 3px 0px rgba(255,255,255,0.6), -1px -1px 1px rgba(0,0,0,0.15), 0px 10px 25px rgba(0,0,0,0.08)" }}
          >
            {limit.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500/60 dark:text-slate-400/40">
            ₽ / ДЕНЬ
          </span>
        </div>
      </div>

      {/* Info Icon Corner Slot */}
      <div className="absolute bottom-6 right-6 group z-50">
        <div className="flex items-center justify-center p-2 rounded-full bg-[#1C3F35]/5 dark:bg-white/10 cursor-pointer hover:bg-[#1C3F35]/10 transition-colors text-[#1C3F35]/70 dark:text-white/70">
          <Info size={18} />
        </div>
        {/* Tooltip Content - Opening Left (Lateral Shift) */}
        <div className="absolute right-full bottom-0 mr-4 z-[110] w-72 p-4 bg-white/90 dark:bg-[#1A1A1A]/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 pointer-events-none">
          <p className="text-xs font-medium text-[#1C3F35] dark:text-white leading-relaxed">
            Это сумма, которую вы можете тратить каждый день до конца месяца, не нарушая свои бюджетные планы. Она учитывает ваши доходы и уже установленные лимиты в конвертах.
          </p>
          <div className="absolute left-full top-1/2 -translate-y-1/2 border-8 border-transparent border-l-white/90 dark:border-l-[#1A1A1A]/95" />
        </div>
      </div>
    </div>
  );
}
