import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchDashboard } from '@/api/client';
import { Info } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useState, useEffect } from 'react';

export function BalanceCards({
  startDate,
  endDate
}: {
  startDate: string;
  endDate: string;
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

  const monthlyIncome = actualIncome > 0 ? actualIncome : parseFloat(String(user?.monthly_income || 0));
  
  const dissipation = monthlyIncome > 0 ? Math.round((monthlyExpense / monthlyIncome) * 100) : 0;
  const growth = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100) : 0;

  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.5
  });

  useEffect(() => {
    motionValue.set(totalBalance);
  }, [totalBalance, motionValue]);

  const displayTotal = useTransform(springValue, (current) => 
    Math.round(current).toLocaleString('ru-RU')
  );

  return (
      <div className="relative bg-white/70 dark:bg-[#111111]/80 backdrop-blur-3xl border border-vault-pine/[0.04] dark:border-white/5 shadow-[0_8px_30px_rgba(28,63,53,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.8)] rounded-3xl p-8 w-full transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.005] hover:shadow-[0_20px_40px_rgba(28,63,53,0.08)] dark:hover:shadow-[0_10px_30px_rgba(255,122,0,0.15)] overflow-hidden">
        {/* Breathing Glow */}
        <motion.div 
          className="absolute inset-0 pointer-events-none z-0"
          animate={{ boxShadow: ['inset 0 0 20px rgba(255,122,0,0.0)', 'inset 0 0 60px rgba(255,122,0,0.08)', 'inset 0 0 20px rgba(255,122,0,0.0)'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        
      <div className="relative z-10 flex items-center justify-between mb-10">
        <div>
          <h2 className="text-[#1C3F35] dark:text-white text-3xl font-bold tracking-tight">Общее состояние</h2>
        </div>
        <div className="flex gap-4 text-lg font-semibold text-[#1C3F35] dark:text-white/80 leading-none tabular-nums">
          <span className="capitalize">{new Date().toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Total Balance Card */}
        <div className="relative">
          <p className="text-lg font-semibold text-[#1C3F35] dark:text-white/80 mb-3">Общий капитал</p>
          <div className="flex items-baseline gap-2 relative">
            <motion.h1 className="text-6xl font-extrabold tracking-tight tabular-nums text-[#1C3F35] dark:text-[#FDFBF7]">
              {displayTotal}
            </motion.h1>
            <span className="text-2xl font-bold text-vault-pine/30 dark:text-white/30">RUB</span>
          </div>
          <div className="absolute -bottom-4 left-0 w-full h-px bg-gradient-to-r from-[#FF7A00]/40 to-transparent" />
        </div>

        {/* Income Card */}
        <div className="relative">
          <p className="text-lg font-semibold text-[#1C3F35] dark:text-white/80 mb-3">Поступления (Доход)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-sans tabular-nums tracking-tight font-semibold text-emerald-600 dark:text-emerald-400">
              +{Math.round(monthlyIncome).toLocaleString('ru-RU')}
            </span>
            <span className="text-xl font-bold text-emerald-700/60 dark:text-emerald-400/60">RUB</span>
          </div>
        </div>

        {/* Expense Card */}
        <div className="relative">
          <p className="text-lg font-semibold text-[#1C3F35] dark:text-white/80 mb-3">Списания (Расход)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-sans tabular-nums tracking-tight font-semibold text-rose-600 dark:text-rose-500">
              -{Math.round(monthlyExpense).toLocaleString('ru-RU')}
            </span>
            <span className="text-xl font-bold text-rose-700/60 dark:text-rose-500/60">RUB</span>
          </div>
        </div>
      </div>

      {/* Account distribution bar */}
      <div className="mt-12 pt-8 border-t border-[#FF7A00]/10">
        <div className="h-1 w-full bg-vault-pine/5 dark:bg-white/5 rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-[#1C3F35] dark:bg-emerald-500 shadow-[0_0_10px_rgba(28,63,53,0.3)]" 
            style={{ width: monthlyIncome > 0 ? `${Math.min(100, (monthlyIncome / (monthlyIncome + monthlyExpense)) * 100)}%` : '0%' }} 
          />
          <div 
            className="h-full bg-[#FF7A00] shadow-[0_0_10px_rgba(255,122,0,0.3)] opacity-50" 
            style={{ width: monthlyExpense > 0 ? `${Math.min(100, (monthlyExpense / (monthlyIncome + monthlyExpense)) * 100)}%` : '0%' }} 
          />
        </div>
        <div className="flex gap-8 mt-4 relative">
          <div className="flex items-center gap-2 cursor-help" onMouseEnter={() => setActiveTooltip('dyn')} onMouseLeave={() => setActiveTooltip(null)}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#1C3F35] dark:bg-emerald-500" />
            <span className="text-xs text-vault-pine/40 dark:text-white/30 uppercase tracking-wider">Динамика роста</span>
            <span className="text-sm font-semibold text-vault-pine dark:text-white/70 tabular-nums">{growth}%</span>
            <Info className="w-4 h-4 text-vault-pine/30 dark:text-white/20" />
            <AnimatePresence>
              {activeTooltip === 'dyn' && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute bottom-6 left-0 w-64 bg-vault-pine dark:bg-[#111111] p-3 rounded-lg border border-[#FF7A00]/20 shadow-2xl z-50 text-[10px] font-mono text-white normal-case tracking-normal shadow-[0_8px_30px_rgb(0,0,0,0.4)]"
                >
                  Скорость увеличения вашего капитала. Значение {'>'} 1 означает рост благосостояния.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 cursor-help" onMouseEnter={() => setActiveTooltip('int')} onMouseLeave={() => setActiveTooltip(null)}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF7A00]" />
            <span className="text-xs text-vault-pine/40 dark:text-white/30 uppercase tracking-wider">Интенсивность трат</span>
            <span className="text-sm font-semibold text-vault-pine dark:text-white/70 tabular-nums">{dissipation}%</span>
            <Info className="w-4 h-4 text-vault-pine/30 dark:text-white/20" />
            <AnimatePresence>
              {activeTooltip === 'int' && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute bottom-6 left-32 w-64 bg-vault-pine dark:bg-[#111111] p-3 rounded-lg border border-[#FF7A00]/20 shadow-2xl z-50 text-[10px] font-mono text-white normal-case tracking-normal shadow-[0_8px_30px_rgb(0,0,0,0.4)]"
                >
                  Коэффициент расхода средств относительно доходов. Чем меньше показатель, тем устойчивее ваш фундамент.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
