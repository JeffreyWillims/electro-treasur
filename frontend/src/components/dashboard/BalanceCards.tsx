import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchDashboard } from '@/api/client';
import { Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export function BalanceCards({
  startDate,
  setStartDate,
  endDate,
  setEndDate
}: {
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
}) {
  const { user } = useAuth();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', startDate, endDate],
    queryFn: () => fetchDashboard(startDate, endDate),
  });

  // Fetch totals from backend matrix mapping
  const actualIncome = parseFloat(dashboard?.period_income?.toString() || '0');
  const monthlyExpense = parseFloat(dashboard?.period_expense?.toString() || '0');
  const totalBalance = parseFloat(dashboard?.total_balance_all_time?.toString() || '0');

  // Baseline Propulsion: If no actual income logged, show the Profile-calibrated income
  const monthlyIncome = actualIncome > 0 ? actualIncome : parseFloat(String(user?.monthly_income || 0));
  
  const totalFlow = monthlyIncome + monthlyExpense;
  const incomePct = totalFlow > 0 ? Math.round((monthlyIncome / totalFlow) * 100) : 0;
  const expensePct = totalFlow > 0 ? Math.round((monthlyExpense / totalFlow) * 100) : 0;

  return (
    <div className="transform scale-[0.97] origin-top-left w-full flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <input 
          type="date" 
          value={startDate} 
          onChange={e => setStartDate(e.target.value)}
          className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-300 text-sm rounded-xl px-4 py-2 shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer font-medium"
        />
        <span className="text-slate-400 dark:text-slate-600 font-medium text-sm">—</span>
        <input 
          type="date" 
          value={endDate} 
          onChange={e => setEndDate(e.target.value)}
          className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-300 text-sm rounded-xl px-4 py-2 shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer font-medium"
        />
      </div>

      <div className="bg-[#F4F5F6]/80 dark:bg-[#121212]/80 backdrop-blur-3xl border border-white/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.8)] rounded-3xl p-8 animate-slide-up w-full transition-all duration-700">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-premium dark:text-slate-100 text-3xl font-serif font-bold tracking-tight">Общее состояние</h2>
        </div>
        <div className="flex gap-4 text-lg font-semibold text-slate-800 dark:text-slate-200 leading-none">
          <span className="capitalize">{new Date().toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Total Balance Card */}
        <div className="relative">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Общий капитал</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-sans tabular-nums tracking-tight font-bold text-slate-900 dark:text-white">
              {Math.round(totalBalance).toLocaleString('ru-RU')}
            </span>
            <span className="text-xl font-bold text-slate-600 dark:text-slate-400">RUB</span>
          </div>
          <div className="absolute -bottom-4 left-0 w-full h-px bg-gradient-to-r from-aura-gold/40 to-transparent" />
        </div>

        {/* Income Card */}
        <div className="relative">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Поступления (Доход)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-sans tabular-nums tracking-tight font-bold text-emerald-600 dark:text-emerald-500">
              +{Math.round(monthlyIncome).toLocaleString('ru-RU')}
            </span>
            <span className="text-xl font-bold text-emerald-700/60 dark:text-emerald-500/60">RUB</span>
          </div>
        </div>

        {/* Expense Card */}
        <div className="relative">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Списания (Расход)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-sans tabular-nums tracking-tight font-bold text-rose-600 dark:text-rose-500">
              -{Math.round(monthlyExpense).toLocaleString('ru-RU')}
            </span>
            <span className="text-xl font-bold text-rose-700/60 dark:text-rose-500/60">RUB</span>
          </div>
        </div>
      </div>

      {/* Account distribution bar (Quantum Representation) */}
      <div className="mt-12 pt-8 border-t border-aura-gold/10">
        <div className="h-1 w-full bg-aura-gold/5 rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-aura-emerald shadow-[0_0_10px_rgba(35,165,110,0.3)]" 
            style={{ width: monthlyIncome > 0 ? `${Math.min(100, (monthlyIncome / (monthlyIncome + monthlyExpense)) * 100)}%` : '0%' }} 
          />
          <div 
            className="h-full bg-aura-gold shadow-[0_0_10px_rgba(197,160,89,0.3)] opacity-50" 
            style={{ width: monthlyExpense > 0 ? `${Math.min(100, (monthlyExpense / (monthlyIncome + monthlyExpense)) * 100)}%` : '0%' }} 
          />
        </div>
        <div className="flex gap-8 mt-4 relative">
          <div className="flex items-center gap-2 cursor-help" onMouseEnter={() => setActiveTooltip('dyn')} onMouseLeave={() => setActiveTooltip(null)}>
            <div className="w-1.5 h-1.5 rounded-full bg-aura-emerald" />
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Динамика роста</span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{incomePct}%</span>
            <Info className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <AnimatePresence>
              {activeTooltip === 'dyn' && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute bottom-6 left-0 w-64 bg-aura-graphite p-3 rounded-lg border border-aura-gold/20 shadow-2xl z-50 text-[10px] font-mono text-aura-ivory normal-case tracking-normal shadow-[0_8px_30px_rgb(0,0,0,0.4)]"
                >
                  Скорость увеличения вашего капитала. Значение {'>'} 1 означает рост благосостояния.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 cursor-help" onMouseEnter={() => setActiveTooltip('int')} onMouseLeave={() => setActiveTooltip(null)}>
            <div className="w-1.5 h-1.5 rounded-full bg-aura-gold" />
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Интенсивность трат</span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{expensePct}%</span>
            <Info className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <AnimatePresence>
              {activeTooltip === 'int' && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute bottom-6 left-32 w-64 bg-aura-graphite p-3 rounded-lg border border-aura-gold/20 shadow-2xl z-50 text-[10px] font-mono text-aura-ivory normal-case tracking-normal shadow-[0_8px_30px_rgb(0,0,0,0.4)]"
                >
                  Коэффициент расхода средств относительно доходов. Чем меньше показатель, тем устойчивее ваш фундамент.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
