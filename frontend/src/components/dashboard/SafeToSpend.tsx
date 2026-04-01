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
    queryFn: () => fetchDashboard(new Date().getMonth() + 1, new Date().getFullYear()),
  });

  if (isLoading) {
    return (
      <div className="premium-card p-8 min-h-[300px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-aura-gold/20 border-t-aura-gold rounded-full animate-spin" />
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
    <div className="premium-card p-8 aura-glow overflow-hidden relative group">
      {/* Decorative background element */}
      <div className="absolute -right-8 -top-8 w-40 h-40 bg-aura-gold/[0.04] rounded-full blur-3xl group-hover:bg-aura-gold/[0.08] transition-all duration-700" />
      
      <div className="flex items-start justify-between mb-10 relative z-10">
        <div>
          <h2 className="text-premium text-2xl leading-none">Safe-to-Spend</h2>
          <p className="text-[9px] font-mono text-aura-gold uppercase tracking-[0.15em] mt-2 font-bold flex items-center gap-1.5 opacity-70">
            Безопасный лимит
            <span className="w-1.5 h-1.5 rounded-full bg-aura-emerald animate-pulse" />
          </p>
        </div>
        <div className="p-3 bg-aura-emerald/[0.08] rounded-2xl border border-aura-emerald/10 shadow-glow-emerald">
          <Wallet className="w-6 h-6 text-aura-emerald" />
        </div>
      </div>

      <div className="mb-10 relative z-10">
        <div className="flex items-baseline gap-2">
          <span className="text-7xl font-mono font-bold text-aura-graphite dark:text-aura-ivory tracking-tight shadow-[1px_1px_0px_rgba(255,255,255,0.5),-1px_-1px_1px_rgba(0,0,0,0.1),0px_4px_6px_rgba(0,0,0,0.05)]">
            {safeToSpendToday.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-aura-gold font-mono text-sm uppercase font-bold">₽ / ДЕНЬ</span>
        </div>
        <p className="text-[11px] text-aura-graphite/40 dark:text-aura-ivory/40 mt-6 max-w-[240px] leading-relaxed">
          Пропускная способность с учетом <span className="text-aura-gold">базовых бюджетов</span> и перерасходов.
        </p>
      </div>

      <div className="space-y-4 relative z-10">
        {/* Advanced Progress Bar */}
        <div className="h-1.5 w-full bg-aura-gold/[0.08] rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, percentSpent)}%` }}
            className={cn(
              "h-full transition-colors duration-1000",
              percentSpent > 100 ? "bg-expense shadow-[0_0_10px_rgba(192,57,43,0.3)]" : "bg-aura-gold shadow-[0_0_10px_rgba(197,160,89,0.3)]"
            )}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        
        <div className="flex justify-between text-[10px] font-mono uppercase font-bold tracking-wider">
          <span className="text-aura-gold/60">
            Потрачено: {totalSpent.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </span>
          <span className={percentSpent > 100 ? "text-expense" : "text-aura-gold"}>
            Буфер: {Math.max(0, totalPlanned - totalSpent).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-aura-gold/10 flex items-center justify-between group/link cursor-pointer relative z-10">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-aura-emerald group-hover/link:text-aura-emerald-light transition-colors">
          <Info size={14} />
          <span>Детализация расчета</span>
        </div>
        <ArrowRight size={16} className="text-aura-gold/50 transform group-hover/link:translate-x-1 group-hover/link:text-aura-gold transition-all" />
      </div>
    </div>
  );
}
