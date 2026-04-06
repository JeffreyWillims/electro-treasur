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
    queryFn: () => {
      const d = new Date();
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0] as string;
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] as string;
      return fetchDashboard(start, end);
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="premium-card p-6 animate-pulse backdrop-blur-3xl backdrop-saturate-150 bg-white/40 dark:bg-[#111111]/40 border border-white/20">
            <div className="h-4 w-1/3 bg-[#FF7A00]/10 rounded mb-4" />
            <div className="h-8 w-2/3 bg-[#FF7A00]/10 rounded mb-6" />
            <div className="h-1 bg-[#FF7A00]/10 rounded-full" />
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
      <div className="premium-card p-10 text-center backdrop-blur-3xl backdrop-saturate-150 bg-white/40 dark:bg-[#111111]/40 border border-white/20">
        <Banknote className="w-8 h-8 text-[#FF7A00]/20 mx-auto mb-4" />
        <p className="font-serif text-lg text-[#1C3F35]/40 dark:text-[#FDFBF7]/30 italic">
          Бюджетных конвертов пока нет
        </p>
        <p className="text-[10px] font-mono text-[#FF7A00]/50 mt-2 uppercase tracking-wider font-bold">
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
            whileHover={{ scale: 1.05, rotate: 1 }}
            transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "premium-card p-8 min-h-[240px] backdrop-blur-3xl backdrop-saturate-150 bg-white/40 dark:bg-[#111111]/40 border border-white/20",
              "shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.02)] transition-all cursor-default",
              "hover:shadow-[0_0_30px_rgba(255,122,0,0.25)] hover:border-[#FF7A00]/40 z-10",
              isOver && "border-rose-500/30"
            )}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <span className="text-3xl filter drop-shadow-md">{icon}</span>
              <div className={cn(
                "px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider",
                isOver
                  ? "bg-rose-500/[0.1] text-rose-600 dark:text-rose-400"
                  : isWarning
                  ? "bg-amber-500/[0.1] text-amber-600 dark:text-amber-400"
                  : "bg-[#1C3F35]/[0.08] dark:bg-emerald-500/[0.1] text-[#1C3F35] dark:text-emerald-400"
              )}>
                {isOver ? "Превышен" : isWarning ? "Внимание" : "В норме"}
              </div>
            </div>

            {/* Category Name */}
            <h3 className="text-xl font-serif font-bold text-[#1C3F35] dark:text-[#FDFBF7] mb-1 leading-tight">{row.category_name}</h3>
            <p className="text-[10px] font-mono text-[#FF7A00]/50 font-bold uppercase tracking-wider mb-5">
              Конверт #{row.category_id}
            </p>

            {/* Amounts */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <span className="font-mono text-4xl font-bold text-[#1C3F35] dark:text-[#FDFBF7] tracking-tighter">
                    {fact.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[10px] font-mono text-[#FF7A00]/60 ml-2 font-bold uppercase tracking-widest">
                    потрачено
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#1C3F35]/40 dark:text-[#FDFBF7]/40 font-bold uppercase tracking-wider">
                  из {planned.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Progress Bar — "Envelope Fill" */}
              <div className="h-2 bg-[#FF7A00]/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, percent)}%` }}
                  transition={{ duration: 1.2, delay: index * 0.1, ease: 'easeOut' }}
                  className={cn(
                    "h-full rounded-full transition-colors",
                    isOver
                      ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                      : isWarning
                      ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                      : "bg-[#FF7A00] shadow-[0_0_12px_rgba(255,122,0,0.3)]"
                  )}
                />
              </div>

              {/* Footer info */}
              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider">
                  {isOver ? (
                    <>
                      <AlertCircle size={12} className="text-rose-500" />
                      <span className="text-rose-500">
                        +{(fact - planned).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} сверх
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown size={12} className="text-emerald-600 dark:text-emerald-500" />
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {remaining.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} осталось
                      </span>
                    </>
                  )}
                </div>
                <span className="text-sm font-mono font-bold text-[#1C3F35] dark:text-[#FDFBF7]">
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
