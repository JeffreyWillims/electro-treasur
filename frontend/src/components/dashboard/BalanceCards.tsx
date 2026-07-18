import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchDashboard } from '@/api/client';
import { Info, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useState, useEffect } from 'react';
import { getMoscowDate } from '@/lib/dateUtils'; // 🔥 ДОБАВЛЕН ИМПОРТ

export function BalanceCards({
  startDate,
  endDate
}: {
  startDate: string;
  endDate: string;
}) {
  const { user } = useAuth();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  // Свёрнутое состояние окна переживает перезагрузку страницы.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cv_balance_collapsed') === '1');

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem('cv_balance_collapsed', c ? '0' : '1');
      return !c;
    });
  };

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', startDate, endDate],
    queryFn: () => fetchDashboard(startDate, endDate),
  });

  const actualIncome = parseFloat(dashboard?.period_income?.toString() || '0');
  const monthlyExpense = parseFloat(dashboard?.period_expense?.toString() || '0');
  const totalBalance = parseFloat(dashboard?.total_balance_all_time?.toString() || '0');

  const monthlyIncome = actualIncome > 0 ? actualIncome : parseFloat(String(user?.monthly_income || 0));

  const hasIncomeData = actualIncome > 0 || monthlyIncome > 0;
  const hasExpenseData = monthlyExpense > 0;

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
    <div className={`relative bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 shadow-2xl rounded-[2.5rem] w-full flex flex-col overflow-hidden transition-all duration-500 z-10 ${collapsed ? 'p-5 md:p-6' : 'p-8 md:p-10 min-h-[380px]'}`}>

      {/* ── 1. ШАПКА (клик — свернуть/развернуть) ── */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        className={`flex justify-between items-start w-full relative z-10 text-left group cursor-pointer ${collapsed ? '' : 'mb-8'}`}
      >
        <div className="flex items-baseline gap-4 min-w-0">
          <h2 className="text-2xl md:text-3xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none shrink-0">
            Общее состояние
          </h2>
          {/* Компактная выжимка в свёрнутом виде */}
          <AnimatePresence>
            {collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-baseline gap-3 min-w-0 truncate"
              >
                {/* Капитал виден и на телефоне; доход/расход — с sm и шире */}
                <motion.span className="text-lg sm:text-xl md:text-2xl font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white">
                  {displayTotal}
                </motion.span>
                <span className="text-xs font-sans font-bold uppercase tracking-widest text-[#1C3F35] dark:text-white opacity-40">RUB</span>
                {hasIncomeData && (
                  <span className="hidden sm:inline text-sm font-sans font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{Math.round(monthlyIncome).toLocaleString('ru-RU')}
                  </span>
                )}
                {hasExpenseData && (
                  <span className="hidden sm:inline text-sm font-sans font-black tabular-nums text-rose-600 dark:text-rose-500">
                    -{Math.round(monthlyExpense).toLocaleString('ru-RU')}
                  </span>
                )}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <span className="flex items-center gap-3 shrink-0 mt-1.5 pl-3">
          {/* Дата — только в развёрнутом виде: в свёрнутом она налезала на заголовок */}
          {!collapsed && (
            <span className="text-xs md:text-sm font-sans font-bold uppercase tracking-widest text-[#1C3F35] dark:text-white text-right">
              {getMoscowDate().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')}
            </span>
          )}
          <motion.span
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#1C3F35]/50 dark:text-white/50 group-hover:bg-[#FF7A00]/15 group-hover:text-[#FF7A00] transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="overflow-hidden flex flex-col flex-1 w-full"
          >

      {/* ── 2. МАТРИЦА БАЛАНСОВ ── */}
      <div className="w-full mt-auto pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-10 md:items-stretch">

          {/* CAPITAL */}
          <div className="flex flex-col justify-end items-center text-center">
            <p className="text-lg md:text-xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white mb-3">
              Капитал
            </p>
            <div className="flex items-baseline justify-center gap-1.5">
              <motion.h1 className="text-3xl md:text-4xl font-sans font-black tabular-nums tracking-tighter text-[#1C3F35] dark:text-white leading-none">
                {displayTotal}
              </motion.h1>
              <span className="text-sm font-sans font-bold uppercase tracking-widest text-[#1C3F35] dark:text-white opacity-40">RUB</span>
            </div>
          </div>

          {/* INCOME */}
          <div className="flex flex-col justify-end items-center text-center">
            <p className="text-lg md:text-xl font-sans font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 mb-3">
              Доход
            </p>
            {hasIncomeData ? (
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-3xl md:text-4xl font-sans font-black tabular-nums tracking-tighter text-emerald-600 dark:text-emerald-400 leading-none">
                  +{Math.round(monthlyIncome).toLocaleString('ru-RU')}
                </span>
                <span className="text-sm font-sans font-bold uppercase tracking-widest text-[#1C3F35] dark:text-white opacity-40">RUB</span>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[36px] md:h-[40px]">
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/30 dark:text-white/30">Нет операций</span>
              </div>
            )}
          </div>

          {/* EXPENSE */}
          <div className="flex flex-col justify-end items-center text-center">
            <p className="text-lg md:text-xl font-sans font-extrabold tracking-tight text-rose-600 dark:text-rose-500 mb-3">
              Расход
            </p>
            {hasExpenseData ? (
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-3xl md:text-4xl font-sans font-black tabular-nums tracking-tighter text-rose-600 dark:text-rose-500 leading-none">
                  -{Math.round(monthlyExpense).toLocaleString('ru-RU')}
                </span>
                <span className="text-sm font-sans font-bold uppercase tracking-widest text-[#1C3F35] dark:text-white opacity-40">RUB</span>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[36px] md:h-[40px]">
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/30 dark:text-white/30">Нет операций</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── 3. ПОДВАЛ ── */}
      <div className="border-t border-black/5 dark:border-white/5 pt-6 relative z-10 w-full mt-10">
        <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
          <div
            className="h-full bg-[#1C3F35] dark:bg-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(52,211,153,0.3)]"
            style={{ width: monthlyIncome > 0 ? `${Math.min(100, (monthlyIncome / (monthlyIncome + monthlyExpense)) * 100)}%` : '0%' }}
          />
          <div
            className="h-full bg-[#FF7A00] transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,122,0,0.3)]"
            style={{ width: monthlyExpense > 0 ? `${Math.min(100, (monthlyExpense / (monthlyIncome + monthlyExpense)) * 100)}%` : '0%' }}
          />
        </div>

        <div className="flex flex-wrap gap-8 mt-5 relative">
          <button type="button" className="flex items-center gap-2.5 cursor-pointer group text-left" onClick={() => setActiveTooltip((t) => (t === 'dyn' ? null : 'dyn'))} onMouseEnter={() => setActiveTooltip('dyn')} onMouseLeave={() => setActiveTooltip(null)}>
            <div className="w-2 h-2 rounded-full bg-[#1C3F35] dark:bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
            <span className="text-[10px] md:text-[11px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 uppercase tracking-widest group-hover:text-[#1C3F35] dark:group-hover:text-white transition-colors">Динамика роста</span>
            <span className="text-sm font-sans font-black text-[#1C3F35] dark:text-white/90 tabular-nums">{growth}%</span>
            <Info className="w-3.5 h-3.5 text-[#1C3F35]/30 dark:text-white/20 group-hover:text-[#FF7A00] transition-colors" />

            <AnimatePresence>
              {activeTooltip === 'dyn' && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.95 }} transition={{ duration: 0.15 }}
                  className="absolute bottom-full mb-3 left-0 w-64 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 pointer-events-none"
                >
                  <p className="text-[12px] font-sans font-semibold text-[#1C3F35] dark:text-white/90 leading-relaxed tracking-wide">
                    🚀 Показывает, насколько быстро растет ваш капитал. Значение выше <strong className="text-emerald-500">1%</strong> — отличный сигнал, что вы богатеете!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          <button type="button" className="flex items-center gap-2.5 cursor-pointer group text-left" onClick={() => setActiveTooltip((t) => (t === 'int' ? null : 'int'))} onMouseEnter={() => setActiveTooltip('int')} onMouseLeave={() => setActiveTooltip(null)}>
            <div className="w-2 h-2 rounded-full bg-[#FF7A00] shadow-[0_0_6px_rgba(255,122,0,0.4)]" />
            <span className="text-[10px] md:text-[11px] font-mono font-bold text-[#1C3F35]/50 dark:text-white/40 uppercase tracking-widest group-hover:text-[#1C3F35] dark:group-hover:text-white transition-colors">Интенсивность трат</span>
            <span className="text-sm font-sans font-black text-[#1C3F35] dark:text-white/90 tabular-nums">{dissipation}%</span>
            <Info className="w-3.5 h-3.5 text-[#1C3F35]/30 dark:text-white/20 group-hover:text-[#FF7A00] transition-colors" />

            <AnimatePresence>
              {activeTooltip === 'int' && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.95 }} transition={{ duration: 0.15 }}
                  className="absolute bottom-full mb-3 left-0 md:left-48 w-64 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 pointer-events-none"
                >
                  <p className="text-[12px] font-sans font-semibold text-[#1C3F35] dark:text-white/90 leading-relaxed tracking-wide">
                    ⚖️ Доля доходов, которая уходит на траты. Держите показатель ниже <strong className="text-[#FF7A00]">80%</strong>, чтобы оставались деньги на жизнь и инвестиции.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}