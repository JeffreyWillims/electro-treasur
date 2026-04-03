import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_DATA = Array.from({ length: 30 }).map((_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
  amount: Math.floor(Math.random() * 5000) + 500,
}));

export function MainAnalytics() {
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0] as string;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().split('T')[0] as string;
  });
  
  const [timeframe, setTimeframe] = useState<'День' | 'Месяц' | 'Год'>('Месяц');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    // Mock filtering logic for the UI demonstration
    if (timeframe === 'День') return MOCK_DATA.slice(-7);
    if (timeframe === 'Год') {
      return Array.from({ length: 12 }).map((_, i) => ({
        date: `2026-${String(i + 1).padStart(2, '0')}`,
        amount: Math.floor(Math.random() * 50000) + 10000,
      }));
    }
    return MOCK_DATA;
  }, [timeframe]);

  return (
    <div className="max-w-7xl mx-auto space-y-16 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-premium text-4xl mb-2 tracking-tighter font-serif font-bold">Аналитика</h1>
          <p className="text-[10px] font-mono text-aura-gold uppercase tracking-[0.3em] font-bold">Режим исследования</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Date Picker */}
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200 dark:border-white/5 transition-colors">
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="bg-transparent border-none text-[10px] uppercase font-mono font-bold text-slate-600 dark:text-slate-300 outline-none p-1 transition-all"
            />
            <span className="text-slate-300 dark:text-slate-600">—</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="bg-transparent border-none text-[10px] uppercase font-mono font-bold text-slate-600 dark:text-slate-300 outline-none p-1 transition-all"
            />
          </div>

          <div className="flex bg-slate-100/80 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-white/5 transition-colors">
            {['День', 'Месяц', 'Год'].map((period) => (
              <button
                key={period}
                onClick={() => setTimeframe(period as any)}
                className={`px-4 py-1.5 rounded-lg text-[10px] uppercase font-mono tracking-widest transition-all ${
                  timeframe === period 
                    ? 'bg-white dark:bg-aura-gold text-brand-600 dark:text-aura-graphite shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 1. Liquidity Chart */}
      <div className="pt-8 border-t border-slate-100">
        <div className="mb-6 relative">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-serif font-bold text-premium">Ликвидность</h2>
            <div className="relative" onMouseEnter={() => setActiveTooltip('liquidity')} onMouseLeave={() => setActiveTooltip(null)}>
              <Info className="w-4 h-4 text-aura-gold/60 cursor-help" />
              <AnimatePresence>
                {activeTooltip === 'liquidity' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute left-6 top-0 w-64 bg-aura-graphite p-3 rounded-lg border border-aura-gold/20 shadow-2xl z-50 text-[10px] font-mono text-aura-ivory"
                  >
                    Динамика роста: Скорость увеличения вашего капитала. Значение {'>'} 1 означает рост благосостояния.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <p className="text-sm font-mono text-aura-gold/60 mt-2">Эвалюация изменения свободного капитала во времени.</p>
        </div>
        <div className="bg-white/60 dark:bg-[#121212]/80 backdrop-blur-3xl border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.8)] h-80 w-full hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-700">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `${value} ₽`} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#8B5CF6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAmount)"
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Spending Flow */}
      <div className="pt-8 border-t border-slate-100">
        <div className="mb-6 relative">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-serif font-bold text-premium">Потоки Расходов</h2>
            <div className="relative" onMouseEnter={() => setActiveTooltip('spending')} onMouseLeave={() => setActiveTooltip(null)}>
              <Info className="w-4 h-4 text-aura-gold/60 cursor-help" />
              <AnimatePresence>
                {activeTooltip === 'spending' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute left-6 top-0 w-64 bg-aura-graphite p-3 rounded-lg border border-aura-gold/20 shadow-2xl z-50 text-[10px] font-mono text-aura-ivory"
                  >
                    Интенсивность трат: Коэффициент расхода средств относительно доходов. Чем меньше показатель, тем устойчивее фундамент.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <p className="text-sm font-mono text-aura-gold/60 mt-2">Ежедневный анализ интенсивности сгорания капитала.</p>
        </div>
        <SpendingChart startDate={startDate} endDate={endDate} />
      </div>

      {/* 3. Capital Structure */}
      <div className="pt-8 border-t border-slate-100 dark:border-white/5 pb-16">
        <div className="mb-6">
          <h2 className="text-2xl font-serif font-bold text-premium dark:text-slate-100">Структура Капитала</h2>
          <p className="text-sm font-mono text-aura-gold/60 mt-2">Распределение затраченных активов по категориям.</p>
        </div>
        <CategoryPieChart startDate={startDate} endDate={endDate} />
      </div>

    </div>
  );
}
