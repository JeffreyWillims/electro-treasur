import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAnalyticsProfile, simulateSavings } from '@/api/client';
import { useLLMInsight } from '@/api/useLLMInsight';
import type { Adjustment } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sparkles, X, Smile, PiggyBank, Coffee, Zap, Shield, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const TOP_BANKS = [
  { id: 'alfa', name: 'Альфа-Банк', rate: 16 },
  { id: 'tbank', name: 'Т-Банк', rate: 18 },
  { id: 'vtb', name: 'ВТБ', rate: 20 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length >= 2) {
    const baseP = payload.find((p: any) => p.dataKey === 'base_savings');
    const optP = payload.find((p: any) => p.dataKey === 'optimized_savings');
    if (!baseP || !optP) return null;

    const baseSavings = baseP.value;
    const optSavings = optP.value;
    const delta = optSavings - baseSavings;

    return (
      <div className="bg-white/80 backdrop-blur-md border border-slate-100 shadow-2xl rounded-2xl p-4 min-w-[220px]">
        <p className="text-[#94a3b8] text-[12px] mb-2 font-medium uppercase tracking-wider">{label}</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Текущий:</span>
            <span className="font-bold text-slate-800">{Math.round(baseSavings).toLocaleString('ru')} ₽</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#10b981] font-medium flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5"/> Оптимизированный:</span>
            <span className="font-bold text-slate-800">{Math.round(optSavings).toLocaleString('ru')} ₽</span>
          </div>
        </div>
        {delta > 0 && (
          <div className="mt-3 flex items-center justify-between bg-emerald-50/50 text-emerald-600 text-[11px] px-3 py-1.5 rounded-full font-bold border border-emerald-100/50 shadow-sm">
            <span>Выгода</span>
            <span>+ {Math.round(delta).toLocaleString('ru')} ₽</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const AnimatedNumber = ({ value }: { value: number | string }) => {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      key={value.toString()}
      className="inline-block"
    >
      {typeof value === 'number' ? Math.round(value).toLocaleString('ru') : value}
    </motion.span>
  );
};

export function SavingsNavigator() {
  const [targetName, setTargetName] = useState('Ремонт кухни');
  const [targetAmount, setTargetAmount] = useState('500000');
  const [initialSavings, setInitialSavings] = useState('50000');
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [coffeeCups, setCoffeeCups] = useState(15);
  const [bankRate, setBankRate] = useState(16);
  const [adjustments, setAdjustments] = useState<Record<number, number>>({});

  const habitSavings = coffeeCups * 250;

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['analyticsProfile'],
    queryFn: fetchAnalyticsProfile,
  });

  useEffect(() => {
    if (profile) {
      if (monthlyIncome === 0) {
        setMonthlyIncome(parseFloat(profile.avg_income));
      }
      if (Object.keys(adjustments).length === 0) {
        const initialAdj: Record<number, number> = {};
        profile.categories.forEach(c => {
          initialAdj[c.category_id] = parseFloat(c.avg_amount);
        });
        setAdjustments(initialAdj);
      }
    }
  }, [profile]);

  const handleSliderChange = (catId: number, value: number) => {
    setAdjustments(prev => ({ ...prev, [catId]: value }));
  };

  const currentAdjustmentsList: Adjustment[] = Object.entries(adjustments).map(([id, val]) => ({
    category_id: parseInt(id),
    new_amount: val.toString(),
  }));

  const payload = {
    target_amount: targetAmount || '0.1',
    initial_savings: initialSavings || '0',
    adjustments: currentAdjustmentsList,
    bank_rate: bankRate.toString(),
    avg_income: monthlyIncome.toString(),
    base_expenses: profile?.categories || [],
    habit_savings: habitSavings.toString(),
  };

  const debouncedPayload = useDebounce(payload, 300);

  const { data: simulation } = useQuery({
    queryKey: ['simulateSavings', debouncedPayload],
    queryFn: () => simulateSavings(debouncedPayload),
    enabled: !!profile && parseFloat(debouncedPayload.target_amount) > 0,
  });

  // Metrics Logic
  const rawAvgExpenses = profile?.categories.reduce((acc, c) => acc + parseFloat(c.avg_amount), 0) || 0;
  const isEmptyState = rawAvgExpenses === 0;
  const avgExpenses = isEmptyState ? 1 : rawAvgExpenses;
  const currentSavings = parseFloat(initialSavings) || 0;
  const daysOfFreedom = isEmptyState ? 0 : Math.floor(currentSavings / (avgExpenses / 30));
  
  const sustainabilityMonths = currentSavings / avgExpenses;
  let sLevel = isEmptyState ? "Расчет недоступен" : "Нет подушки";
  let sProgress = 0;
  
  if (!isEmptyState) {
    if (sustainabilityMonths >= 12) { sLevel = "Уровень 4: Свобода"; sProgress = 100; }
    else if (sustainabilityMonths >= 6) { sLevel = "Уровень 3: Стабильность"; sProgress = 75; }
    else if (sustainabilityMonths >= 3) { sLevel = "Уровень 2: Безопасность"; sProgress = 50; }
    else if (sustainabilityMonths >= 1) { sLevel = "Уровень 1: Старт"; sProgress = 25; }
  }

  const currentAdjustedTotal = Object.values(adjustments).reduce((a, b) => a + b, 0);
  const optimizedSavingsRate = monthlyIncome > 0 ? ((monthlyIncome - (currentAdjustedTotal - habitSavings)) / monthlyIncome) * 100 : 0;
  const accelerationDays = simulation?.days_saved || 0;

  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const { trigger, isLoading: isLlmLoading, isError: isLlmError, error: llmError, data: advisorData, reset: resetAdvisor } = useLLMInsight(2026);

  const handleOpenAdvisor = () => {
    setIsAdvisorOpen(true);
    trigger();
  };

  const handleCloseAdvisor = () => {
    setIsAdvisorOpen(false);
    resetAdvisor();
  };

  if (isProfileLoading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Загрузка профиля накопителя...</div>;
  }

  const warnings: string[] = [];
  profile?.categories.forEach(c => {
    const baseAmt = parseFloat(c.avg_amount);
    const newAmt = adjustments[c.category_id] ?? baseAmt;
    if (baseAmt > 0 && (c.name.toLowerCase().includes('еда') || c.name.toLowerCase().includes('здоровье'))) {
      const dropPct = (baseAmt - newAmt) / baseAmt;
      if (dropPct > 0.4) {
        warnings.push(`Внимание: Сокращение категории "${c.name}" более чем на 40% может быть опасно для здоровья и комфорта.`);
      }
    }
  });

  return (
    <div className="flex w-full flex-col gap-8 pb-10">
      {/* 1. WOW METRICS LAYER */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Дни свободы', value: daysOfFreedom, suffix: ' дн', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Устойчивость', value: sLevel, icon: Shield, color: 'text-brand-600', bg: 'bg-brand-50', sub: sProgress },
          { label: 'Эффективность', value: Math.round(optimizedSavingsRate), suffix: '%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Ускорение цели', value: accelerationDays, suffix: ' дн', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-5 bg-white/70 backdrop-blur-md rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
              <div className={cn("p-2 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
            </div>
            <div className="mt-1">
              {typeof stat.value === 'number' ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-800 tracking-tight">
                    <AnimatedNumber value={stat.value} />
                  </span>
                  <span className="text-sm font-bold text-slate-400">{stat.suffix}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-700">{stat.value}</p>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.sub}%` }}
                      className="h-full bg-brand-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {isEmptyState ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white/50 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm w-full min-h-[400px]">
           <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mb-6">
             <PiggyBank className="w-10 h-10 text-brand-500" />
           </div>
           <h3 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight font-serif text-premium">Пока здесь пусто</h3>
           <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">Добавьте вашу первую операцию, чтобы активировать Финплан и персональные советы искусственного интеллекта.</p>
        </div>
      ) : (
      <div className="flex w-full flex-col gap-6 lg:flex-row">
        {/* LEFT COLUMN: Control Center */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          
          <div className="p-6 bg-white/50 backdrop-blur-md rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                 <PiggyBank className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Центр управления</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Месячный доход (₽)</label>
                <input 
                  type="number" 
                  value={monthlyIncome} 
                  onChange={e => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-white/80 border-slate-100 border rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold text-slate-800"
                />
              </div>

              <div className="p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-700">Цена привычки (Кофе)</span>
                  </div>
                  <span className="text-xs font-black text-amber-600">-{habitSavings.toLocaleString('ru')} ₽</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={coffeeCups}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setCoffeeCups(val);
                    if (val === 0) toast.success("Инсайт: Отказ от кофе ускорил вашу цель на 15 дней!", { icon: '🚀' });
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>0 чашек</span>
                  <span>15</span>
                  <span>30 чашек</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Оптимизация трат
            </h3>
            <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2">
              {profile?.categories.map(c => {
                const baseAmt = parseFloat(c.avg_amount);
                if (baseAmt <= 0) return null;
                const currentVal = adjustments[c.category_id] ?? baseAmt;
                const savings = baseAmt - currentVal;
                
                return (
                  <div key={c.category_id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{c.name}</span>
                      <span className="text-slate-500 font-bold">{currentVal.toLocaleString('ru')} ₽</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max={Math.max(baseAmt * 1.5, 1000)}
                      step="100"
                      value={currentVal}
                      onChange={e => handleSliderChange(c.category_id, parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    {savings > 0 && (
                      <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">+ {savings.toLocaleString('ru')} ₽ выгоды</div>
                    )}
                  </div>
                );
              })}
            </div>
            {warnings.map((w, i) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={i} 
                className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 mt-2 font-medium"
              >
                {w}
              </motion.div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Chart & Banks */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[450px] flex flex-col">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Прогноз цели: {targetName}
            </h3>
            {(simulation?.chart_data && simulation.chart_data.length > 0) ? (
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={simulation.chart_data.length === 1 ? [simulation.chart_data[0], {...simulation.chart_data[0], month: 'Будущее'}] : simulation.chart_data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="transparent" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOpt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="transparent" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <ReferenceLine 
                      y={parseFloat(targetAmount)} 
                      stroke="#fbbf24" 
                      strokeWidth={2} 
                      strokeDasharray="10 10" 
                      label={{ value: 'ЦЕЛЬ', position: 'right', fill: '#fbbf24', fontSize: 10, fontWeight: 'bold' }} 
                    />
                    <Area type="monotone" dataKey="base_savings" name="Текущий путь" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBase)" isAnimationActive={false} activeDot={{ r: 6, strokeWidth: 0, fill: "#1e293b" }} />
                    <Area type="monotone" dataKey="optimized_savings" name="Оптимизировано" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOpt)" isAnimationActive={false} activeDot={{ r: 6, strokeWidth: 0, fill: "#1e293b" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
               <div className="flex h-full items-center justify-center text-slate-400">Формируем прогноз...</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {[
               { label: 'Моя цель', value: targetName, set: setTargetName, type: 'text' },
               { label: 'Сумма цели (₽)', value: targetAmount, set: setTargetAmount, type: 'number' },
               { label: 'Уже накоплено (₽)', value: initialSavings, set: setInitialSavings, type: 'number' },
             ].map(f => (
               <div key={f.label} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{f.label}</label>
                  <input 
                    type={f.type}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    className="w-full text-sm font-bold text-slate-800 bg-transparent outline-none focus:text-brand-600 transition-colors"
                  />
               </div>
             ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TOP_BANKS.map(bank => (
              <motion.div 
                whileHover={{ y: -2 }}
                key={bank.id} 
                className={cn(
                  "p-5 rounded-2xl border relative overflow-hidden transition-all shadow-sm",
                  bank.rate === bankRate ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
                )}
              >
                {bank.rate === bankRate && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-bl-xl ">
                    ВЫБРАНО
                  </div>
                )}
                <div className="text-xl font-black text-slate-800">{bank.rate}%</div>
                <div className="text-xs font-bold text-slate-500 mb-4">{bank.name}</div>
                <button 
                  onClick={() => setBankRate(bank.rate)}
                  className={cn(
                    "w-full py-2 rounded-xl text-xs font-bold transition-all",
                    bank.rate === bankRate ? 'bg-emerald-600 text-white shadow-emerald-200 shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  )}
                >
                  {bank.rate === bankRate ? 'Выбрана ставка' : 'Выбрать ставку'}
                </button>
              </motion.div>
            ))}
          </div>
          
          <div className="flex justify-end pt-2">
              <button 
                  onClick={handleOpenAdvisor}
                  className="group relative px-8 py-3.5 bg-brand-600 text-white text-sm font-bold rounded-2xl shadow-lg shadow-brand-200 hover:shadow-xl transition-all hover:scale-[1.02] flex items-center gap-3"
               >
                  <Sparkles className="w-5 h-5" />
                  Получить совет ИИ 😊
              </button>
          </div>
        </div>
      </div>
      )}

      <AnimatePresence>
        {isAdvisorOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4" onClick={handleCloseAdvisor}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl p-8 overflow-hidden" 
              onClick={e => e.stopPropagation()}
            >
              <button onClick={handleCloseAdvisor} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-100">
                  <Smile className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Инсайт Навигатора</h2>
                  <p className="text-sm font-medium text-slate-400">Персональная стратегия роста</p>
                </div>
              </div>

              <div className="space-y-6">
                {isLlmLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-3/4 rounded-full" />
                    <Skeleton className="h-4 w-full rounded-full" />
                    <Skeleton className="h-4 w-5/6 rounded-full" />
                    <div className="pt-4 grid grid-cols-3 gap-3">
                      <Skeleton className="h-20 rounded-2xl" />
                      <Skeleton className="h-20 rounded-2xl" />
                      <Skeleton className="h-20 rounded-2xl" />
                    </div>
                  </div>
                ) : advisorData ? (
                  <div className="space-y-6">
                    <p className="text-slate-600 leading-relaxed font-medium">{advisorData.insight}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Доход</p>
                        <p className="text-sm font-black text-slate-800">₽{Number(advisorData.summary.total_income.replace(/_/g, '')).toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-center">
                        <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Расход</p>
                        <p className="text-sm font-black text-slate-800">₽{Number(advisorData.summary.total_expense.replace(/_/g, '')).toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Сбережения</p>
                        <p className="text-sm font-black text-slate-800">{advisorData.summary.savings_rate}</p>
                      </div>
                    </div>
                  </div>
                ) : isLlmError ? (
                   <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-sm font-medium">Ошибка: {llmError}</div>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
