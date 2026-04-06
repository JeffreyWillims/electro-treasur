import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Wallet, Info, ArrowRight } from 'lucide-react';
import { fetchDashboard } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import type { CategoryRowSchema } from '@/types';

export function SafeToSpend() {
  const { user } = useAuth();
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => {
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0] as string;
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] as string;
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
  const expenseRows = dashboard?.rows.filter((r) => parseFloat(r.planned) > 0) || [];
  
  const totalPlanned = expenseRows.reduce((acc: number, row: CategoryRowSchema) => acc + parseFloat(row.planned), 0);
  const totalSpent = expenseRows.reduce((acc: number, row: CategoryRowSchema) => acc + parseFloat(row.fact), 0);
  
  // Overspent amounts (spending exceeding planned limits across all categories)
  const overspent = expenseRows.reduce((acc: number, row: CategoryRowSchema) => {
    const planned = parseFloat(row.planned);
    const fact = parseFloat(row.fact);
    return acc + Math.max(0, fact - planned);
  }, 0);

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - today.getDate() + 1);

  // Safe-to-Spend formula: (Total Income - Reserved Budgets - Overspent Leakage) / Time Delta
  const monthlyIncome = parseFloat(user?.monthly_income?.toString() || '0');
  
  // Available block: from income subtract what we committed to, plus what we already overspent and has to be covered.
  const availableLiquidity = Math.max(0, monthlyIncome - totalPlanned - overspent);
  const safeToSpendToday = availableLiquidity / daysLeft;

  const percentSpent = totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0;

  return (
    <div className="w-full premium-card p-12 md:p-16 overflow-hidden relative group backdrop-blur-3xl backdrop-saturate-150 bg-white/40 dark:bg-[#111111]/40 border border-white/20">
      {/* Decorative background element */}
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#FF7A00]/[0.04] rounded-full blur-3xl group-hover:bg-[#FF7A00]/[0.08] transition-all duration-700" />
      
      <div className="flex items-start justify-between mb-16 relative z-10">
        <div>
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-[#1C3F35] dark:text-[#FDFBF7] tracking-tighter">Safe-to-Spend</h2>
          <p className="text-[12px] font-mono text-[#FF7A00] uppercase tracking-[0.2em] mt-3 font-bold flex items-center gap-2 opacity-80">
            Абсолютный ликвидный лимит
            <span className="w-2 h-2 rounded-full bg-[#1C3F35] dark:bg-emerald-500 animate-pulse" />
          </p>
        </div>
        <div className="p-4 bg-[#1C3F35]/[0.08] dark:bg-emerald-500/[0.1] rounded-2xl border border-[#1C3F35]/10 dark:border-emerald-500/10 shadow-[0_0_15px_rgba(28,63,53,0.2)]">
          <Wallet className="w-8 h-8 text-[#1C3F35] dark:text-emerald-500" />
        </div>
      </div>

      <div className="mb-16 relative z-10 flex flex-col items-center justify-center py-6">
        <div className="flex items-baseline gap-4 md:gap-6">
          <span className="text-7xl md:text-8xl lg:text-[10rem] font-serif font-bold text-[#1C3F35] dark:text-[#FDFBF7] tracking-tighter text-engraved transition-all">
            {safeToSpendToday.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[#FF7A00] font-mono text-xl md:text-3xl uppercase font-bold tracking-widest">₽ / ДЕНЬ</span>
        </div>
        <p className="text-sm md:text-base text-[#1C3F35]/60 dark:text-[#FDFBF7]/60 mt-8 max-w-lg text-center leading-relaxed font-medium">
          Пропускная способность с учетом <span className="text-[#FF7A00] font-bold">базовых бюджетов</span> и перерасходов.
        </p>
      </div>

      <div className="space-y-4 relative z-10 max-w-4xl mx-auto">
        {/* Advanced Progress Bar */}
        <div className="h-2 w-full bg-[#FF7A00]/[0.08] rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, percentSpent)}%` }}
            className={cn(
              "h-full transition-colors duration-1000",
              percentSpent > 100 ? "bg-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.5)]" : "bg-[#FF7A00] shadow-[0_0_15px_rgba(255,122,0,0.5)]"
            )}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
        
        <div className="flex justify-between text-xs font-mono uppercase font-bold tracking-widest">
          <span className="text-[#1C3F35]/60 dark:text-[#FDFBF7]/60">
            Потрачено: {totalSpent.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </span>
          <span className={percentSpent > 100 ? "text-rose-600" : "text-[#FF7A00]"}>
            Буфер: {Math.max(0, totalPlanned - totalSpent).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-[#1C3F35]/10 dark:border-white/10 flex items-center justify-between group/link cursor-pointer relative z-10">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1C3F35] dark:text-emerald-500 group-hover/link:text-[#FF7A00] transition-colors">
          <Info size={18} />
          <span className="tracking-wide">Детализация расчета</span>
        </div>
        <ArrowRight size={20} className="text-[#1C3F35]/40 dark:text-[#FDFBF7]/40 transform group-hover/link:translate-x-2 group-hover/link:text-[#FF7A00] transition-all" />
      </div>
    </div>
  );
}
