import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { fetchAnalyticsProfile, fetchDashboard } from '@/api/client';
import { TrendingUp, Infinity as InfinityIcon } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length > 0) {
    const value = payload[0].value;
    return (
      <div className="bg-white/90 dark:bg-[#111111]/90 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-2xl rounded-2xl p-4 min-w-[200px]">
        <p className="text-slate-400 text-xs mb-2 font-bold uppercase tracking-wider">{label}</p>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Капитал:</span>
          <span className="font-bold text-lg text-[#1C3F35] dark:text-[#FDFBF7]">
            {Math.round(value).toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export function SavingsNavigator() {
  const [savingsRate, setSavingsRate] = useState(20);
  const [annualYield, setAnnualYield] = useState(10);

  // 30 days rolling window for the dashboard data
  const { startDateStr, endDateStr } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      startDateStr: start.toISOString().split('T')[0] as string,
      endDateStr: end.toISOString().split('T')[0] as string,
    };
  }, []);

  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['dashboard', startDateStr, endDateStr],
    queryFn: () => fetchDashboard(startDateStr, endDateStr),
  });

  const { data: profile } = useQuery({
    queryKey: ['analyticsProfile'],
    queryFn: fetchAnalyticsProfile,
  });

  const totalBalance = parseFloat(dashboard?.total_balance_all_time || '0');
  const periodExpense = parseFloat(dashboard?.period_expense || '0');
  const dailyBurnRate = periodExpense / 30;
  
  const freedomDays = dailyBurnRate === 0 
    ? Infinity 
    : Math.floor(totalBalance / dailyBurnRate);

  const avgIncome = parseFloat(profile?.avg_income || '0');

  // Wealth Projection Engine
  const projectionData = useMemo(() => {
    const data = [];
    let currentCapital = totalBalance;
    const monthlyDeposit = avgIncome * (savingsRate / 100);
    const monthlyRate = annualYield / 100 / 12;

    for (let month = 0; month <= 60; month++) {
      if (month > 0) {
        currentCapital = currentCapital * (1 + monthlyRate) + monthlyDeposit;
      }
      
      const d = new Date();
      d.setMonth(d.getMonth() + month);
      const monthStr = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });

      data.push({
        monthIndex: month,
        label: monthStr,
        capital: currentCapital > 0 ? currentCapital : 0,
      });
    }
    return data;
  }, [totalBalance, avgIncome, savingsRate, annualYield]);

  if (isDashboardLoading) {
    return <div className="p-12 text-center text-slate-500 font-mono animate-pulse uppercase tracking-widest">Калибровка систем навигатора...</div>;
  }

  return (
    <div className="flex w-full flex-col gap-6 pb-12">
      {/* 1. THE FREEDOM METRIC (California Luxury Widget) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-white/30 to-[#FF7A00]/5 dark:from-[#111111]/80 dark:to-emerald-900/10 backdrop-blur-3xl backdrop-saturate-200 border border-white/20 dark:border-white/5 rounded-[2.5rem] p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_30px_60px_-15px_rgba(255,255,255,0.02)] mb-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h2 className="text-emerald-900 dark:text-emerald-400 font-bold uppercase tracking-widest text-sm mb-4">
              Финансовая Взлетная Полоса
            </h2>
            <div className="flex items-baseline gap-4">
              <div className="text-8xl font-black text-slate-900 dark:text-[#FDFBF7] tabular-nums tracking-tighter drop-shadow-sm">
                {freedomDays === Infinity ? (
                  <InfinityIcon className="w-24 h-24 text-slate-900 dark:text-[#FDFBF7]" />
                ) : (
                  freedomDays.toLocaleString('ru-RU')
                )}
              </div>
              <div className="text-lg font-serif font-bold text-slate-500 dark:text-slate-400">
                Дней финансовой свободы
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4 bg-white/40 dark:bg-black/30 rounded-2xl border border-white/30 dark:border-white/5 backdrop-blur-md">
            <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
              Ежедневный расход (Burn Rate)
            </div>
            <div className="text-2xl font-black text-[#FF7A00]">
              {Math.round(dailyBurnRate).toLocaleString('ru-RU')} <span className="text-sm">₽/день</span>
            </div>
            <div className="text-[10px] text-slate-400/80 mt-1 uppercase font-bold tracking-wider">
              (Окно: 30 дней)
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. WEALTH PROJECTION ENGINE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Sliders (Time Machine Controls) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/50 dark:bg-[#121212]/80 backdrop-blur-2xl rounded-[2rem] border border-slate-100 dark:border-white/5 p-8 shadow-sm h-full">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xl font-serif mb-8 flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              Машина Времени
            </h3>

            <div className="space-y-8">
              {/* Savings Rate Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    % Накоплений
                  </label>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {savingsRate}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="1"
                  value={savingsRate}
                  onChange={(e) => setSavingsRate(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="text-[10px] font-mono text-slate-500 flex justify-between uppercase font-bold">
                  <span>0%</span>
                  <span>(от среднего дохода)</span>
                  <span>80%</span>
                </div>
              </div>

              {/* Annual Yield Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Годовая Доходность
                  </label>
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                    {annualYield}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={annualYield}
                  onChange={(e) => setAnnualYield(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="text-[10px] font-mono text-slate-500 flex justify-between uppercase font-bold">
                  <span>0%</span>
                  <span>(сложный процент)</span>
                  <span>30%</span>
                </div>
              </div>
            </div>

            <div className="mt-12 p-6 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
               <div className="flex justify-between items-center">
                 <span className="text-xs font-bold text-slate-500">Доход (БД)</span>
                 <span className="text-sm font-black text-slate-700 dark:text-slate-300">{avgIncome.toLocaleString('ru')} ₽</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-xs font-bold text-slate-500">База (БД)</span>
                 <span className="text-sm font-black text-slate-700 dark:text-slate-300">{totalBalance.toLocaleString('ru')} ₽</span>
               </div>
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="lg:col-span-2">
          <div className="bg-white/70 dark:bg-[#121212]/80 backdrop-blur-2xl rounded-[2rem] border border-slate-100 dark:border-white/5 p-8 shadow-xl h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xl font-serif">Проекция на 5 лет (60 мес)</h3>
                <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mt-1">Ожидаемый капитал: {Math.round(projectionData[60].capital).toLocaleString('ru-RU')} ₽</p>
              </div>
            </div>
            
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" strokeOpacity={0.5} />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                    tickLine={false} 
                    axisLine={false}
                    interval={11} // Show label roughly once a year
                  />
                  <YAxis 
                    tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}k`} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                    tickLine={false} 
                    axisLine={false} 
                    width={50}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }} />
                  <Area 
                    type="monotone" 
                    dataKey="capital" 
                    stroke="#10b981" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorCapital)" 
                    isAnimationActive={false} // ZERO-LATENCY update
                    activeDot={{ r: 8, strokeWidth: 0, fill: "#059669", style: { filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.8))' } }} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
