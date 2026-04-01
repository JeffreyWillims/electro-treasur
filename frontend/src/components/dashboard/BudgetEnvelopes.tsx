/**
 * BudgetEnvelopes — Premium "envelope" budget visualization cards.
 * Each category is a visual "envelope" showing fill level with animated progress.
 */
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { fetchDashboard } from '@/api/client';
import { cn } from '@/lib/utils';
import { Banknote, TrendingDown, AlertCircle } from 'lucide-react';
import type { CategoryRowSchema } from '@/types';

const ENVELOPE_ICONS = ['🏠', '🛒', '🚗', '📱', '🎭', '💊', '🎓', '✈️'];

export function BudgetEnvelopes() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => fetchDashboard(new Date().getMonth() + 1, new Date().getFullYear()),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="premium-card p-6 animate-pulse">
            <div className="h-4 w-1/3 bg-aura-gold/10 rounded mb-4" />
            <div className="h-8 w-2/3 bg-aura-gold/10 rounded mb-6" />
            <div className="h-1 bg-aura-gold/10 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const expenseRows = dashboard?.rows.filter((r: CategoryRowSchema) => {
    const planned = parseFloat(r.planned);
    return planned > 0;
  }) || [];

  if (expenseRows.length === 0) {
    return (
      <div className="premium-card p-10 text-center">
        <Banknote className="w-8 h-8 text-aura-gold/20 mx-auto mb-4" />
        <p className="font-serif text-lg text-aura-graphite/30 dark:text-aura-ivory/20 italic">
          Бюджетных конвертов пока нет
        </p>
        <p className="text-[10px] font-mono text-aura-gold/30 mt-2 uppercase tracking-wider">
          Создайте бюджет на текущий месяц
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {expenseRows.map((row: CategoryRowSchema, index: number) => {
        const planned = parseFloat(row.planned);
        const fact = parseFloat(row.fact);
        const remaining = Math.max(0, planned - fact);
        const percent = planned > 0 ? (fact / planned) * 100 : 0;
        const isOver = fact > planned;
        const isWarning = percent > 75 && !isOver;
        const icon = ENVELOPE_ICONS[index % ENVELOPE_ICONS.length];

        return (
          <motion.div
            key={row.category_id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "premium-card p-8 min-h-[240px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all group cursor-default dark:shadow-[0_8px_30px_rgba(255,255,255,0.02)]",
              isOver && "border-expense/10"
            )}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <span className="text-2xl">{icon}</span>
              <div className={cn(
                "px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider",
                isOver
                  ? "bg-expense/[0.06] text-expense"
                  : isWarning
                  ? "bg-amber-500/[0.06] text-amber-600 dark:text-amber-400"
                  : "bg-aura-emerald/[0.06] text-aura-emerald"
              )}>
                {isOver ? "Превышен" : isWarning ? "Внимание" : "В норме"}
              </div>
            </div>

            {/* Category Name */}
            <h3 className="text-premium text-base mb-1 leading-tight">{row.category_name}</h3>
            <p className="text-[9px] font-mono text-aura-gold/35 uppercase tracking-wider mb-5">
              Конверт #{row.category_id}
            </p>

            {/* Amounts */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <span className="font-mono text-3xl font-bold text-aura-graphite dark:text-aura-ivory shadow-[1px_1px_0px_rgba(255,255,255,0.5),-1px_-1px_1px_rgba(0,0,0,0.1),0px_4px_6px_rgba(0,0,0,0.05)]">
                    {fact.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[10px] font-mono text-aura-gold/40 ml-1.5">
                    потрачено
                  </span>
                </div>
                <span className="text-[10px] font-mono text-aura-gold/40">
                  из {planned.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Progress Bar — "Envelope Fill" */}
              <div className="h-1.5 bg-aura-gold/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, percent)}%` }}
                  transition={{ duration: 1, delay: index * 0.1, ease: 'easeOut' }}
                  className={cn(
                    "h-full rounded-full transition-colors",
                    isOver
                      ? "bg-expense shadow-[0_0_8px_rgba(192,57,43,0.2)]"
                      : isWarning
                      ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                      : "bg-aura-gold shadow-[0_0_8px_rgba(197,160,89,0.2)]"
                  )}
                />
              </div>

              {/* Footer info */}
              <div className="flex justify-between items-center pt-1">
                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider">
                  {isOver ? (
                    <>
                      <AlertCircle size={10} className="text-expense" />
                      <span className="text-expense">
                        +{(fact - planned).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} сверх
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown size={10} className="text-aura-emerald" />
                      <span className="text-aura-emerald/70">
                        {remaining.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} осталось
                      </span>
                    </>
                  )}
                </div>
                <span className="text-[10px] font-mono font-bold text-aura-gold/50">
                  {percent.toFixed(0)}%
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
