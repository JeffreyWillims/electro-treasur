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

  // Период считается «пустым», если бэкенд не вернул ни одной строки
  const hasData = (dashboard?.rows?.length ?? 0) > 0;

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
    <div className="relative bg-white/70 dark:bg-[#111111]/80 backdrop-blur-3xl border border-vault-pine/[0.04] dark:border-white/5 shadow-2xl rounded-[2.5rem] p-8 md:p-10 w-full flex flex-col min-h-[380px] overflow-hidden transition-all duration-500">

      {/* ── 1. ШАПКА ── */}
      <div className="flex justify-between items-start w-full relative z-10">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#1C3F35] dark:text-emerald-50" style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.05)" }}>
          Общее состояние
        </h2>
        <p className="text-sm font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right mt-1">
          {new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')} <span className="lowercase">г.</span>
        </p>
      </div>

      {/* ── МАТРИЦА БАЛАНСОВ (ЖЕЛЕЗОБЕТОННОЕ ВЫРАВНИВАНИЕ) ── */}
      <div className="w-full mt-auto pt-8">
        {/* items-stretch делает колонки одинаковой высоты */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-8 md:items-stretch">

          {/* CAPITAL */}
          <div className="flex flex-col justify-between h-full text-center">
            {/* Лейбл прибит к потолку */}
            <h3 className="text-xl md:text-xl font-sans italic font-black tracking-wide antialiased text-[#1C3F35] dark:text-[#FDFBF7] mb-9" style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.8), 0px 4px 10px rgba(0,0,0,0.08)" }}>
              Капитал
            </h3>
            {/* Цифра прибита к полу */}
            <div className="flex items-baseline justify-center gap-2">
              <motion.h1 className="text-4xl md:text-5xl font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white leading-none">
                {displayTotal}
              </motion.h1>
              <span className="text-lg font-bold text-[#1C3F35]/30 dark:text-white/30">RUB</span>
            </div>
          </div>

          {/* INCOME */}
          <div className="flex flex-col justify-between h-full text-center">
            <h3 className="text-xl md:text-xl font-sans italic font-black tracking-wide antialiased text-[#1C3F35] dark:text-[#FDFBF7] mb-9" style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.8), 0px 4px 10px rgba(0,0,0,0.08)" }}>
              Доход
            </h3>
            {hasData ? (
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-3xl md:text-4xl font-extrabold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 leading-none">
                  +{Math.round(monthlyIncome).toLocaleString('ru-RU')}
                </span>
                <span className="text-sm font-bold text-emerald-700/50 dark:text-emerald-400/40">RUB</span>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <span className="text-sm font-serif text-slate-400 dark:text-slate-500 italic">Нет операций</span>
              </div>
            )}
          </div>

          {/* EXPENSE */}
          <div className="flex flex-col justify-between h-full text-center">
            <h3 className="text-xl md:text-xl font-sans italic font-black tracking-wide antialiased text-[#1C3F35] dark:text-[#FDFBF7] mb-9" style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.8), 0px 4px 10px rgba(0,0,0,0.08)" }}>
              Расход
            </h3>
            {hasData ? (
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-3xl md:text-4xl font-extrabold tabular-nums tracking-tight text-rose-600 dark:text-rose-500 leading-none">
                  -{Math.round(monthlyExpense).toLocaleString('ru-RU')}
                </span>
                <span className="text-sm font-bold text-rose-700/50 dark:text-rose-500/40">RUB</span>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <span className="text-sm font-serif text-slate-400 dark:text-slate-500 italic">Нет операций</span>
              </div>
            )}
          </div>

        </div>
      </div>


      {/* ── 3. ПОДВАЛ ── */}
      <div className="border-t border-[#FF7A00]/20 pt-6 relative z-10 w-full mt-auto">
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
