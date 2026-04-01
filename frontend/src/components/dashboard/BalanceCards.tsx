import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchDashboard } from '@/api/client';
import { Card } from '@/components/ui/Card';
import { CategoryRowSchema } from '@/types';
import { Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export function BalanceCards() {
  const { user } = useAuth();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => fetchDashboard(new Date().getMonth() + 1, new Date().getFullYear()),
  });

  // Calculate totals from dashboard rows
  const actualIncome = dashboard?.rows
    .filter((r: CategoryRowSchema) => r.type === 'income')
    .reduce((acc: number, r: CategoryRowSchema) => acc + parseFloat(r.fact), 0) || 0;

  const monthlyExpense = dashboard?.rows
    .filter((r: CategoryRowSchema) => r.type === 'expense')
    .reduce((acc: number, r: CategoryRowSchema) => acc + parseFloat(r.fact), 0) || 0;

  // Baseline Propulsion: If no actual income logged, show the Profile-calibrated income
  const monthlyIncome = actualIncome > 0 ? actualIncome : parseFloat(user?.monthly_income?.toString() || '0');
  
  const totalBalance = monthlyIncome - monthlyExpense;
  const totalFlow = monthlyIncome + monthlyExpense;
  const incomePct = totalFlow > 0 ? Math.round((monthlyIncome / totalFlow) * 100) : 0;
  const expensePct = totalFlow > 0 ? Math.round((monthlyExpense / totalFlow) * 100) : 0;

  return (
    <Card className="animate-slide-up premium-card border-aura-gold/10 aura-glow p-8">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-premium text-3xl font-serif font-bold tracking-tight">Общее состояние</h2>
        </div>
        <div className="flex gap-4 text-lg font-semibold text-slate-800 leading-none">
          <span className="capitalize">{new Date().toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Total Balance Card */}
        <div className="relative">
          <p className="text-lg font-semibold text-slate-800 mb-3">Общий капитал</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-sans tabular-nums tracking-tight font-bold text-slate-900">
              {Math.round(totalBalance).toLocaleString('ru-RU')}
            </span>
            <span className="text-xl font-bold text-slate-600">RUB</span>
          </div>
          <div className="absolute -bottom-4 left-0 w-full h-px bg-gradient-to-r from-aura-gold/40 to-transparent" />
        </div>

        {/* Income Card */}
        <div className="relative">
          <p className="text-lg font-semibold text-slate-800 mb-3">Поступления (Доход)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-sans tabular-nums tracking-tight font-bold text-slate-900">
              +{Math.round(monthlyIncome).toLocaleString('ru-RU')}
            </span>
            <span className="text-xl font-bold text-slate-600">RUB</span>
          </div>
        </div>

        {/* Expense Card */}
        <div className="relative">
          <p className="text-lg font-semibold text-slate-800 mb-3">Списания (Расход)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-sans tabular-nums tracking-tight font-bold text-slate-900">
              -{Math.round(monthlyExpense).toLocaleString('ru-RU')}
            </span>
            <span className="text-xl font-bold text-slate-600">RUB</span>
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
            <span className="text-xs text-slate-400 uppercase tracking-wider">Динамика роста</span>
            <span className="text-sm font-semibold text-slate-700">{incomePct}%</span>
            <Info className="w-4 h-4 text-slate-400" />
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
            <span className="text-xs text-slate-400 uppercase tracking-wider">Интенсивность трат</span>
            <span className="text-sm font-semibold text-slate-700">{expensePct}%</span>
            <Info className="w-4 h-4 text-slate-400" />
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
    </Card>
  );
}
