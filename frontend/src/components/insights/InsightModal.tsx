/**
 * InsightModal — "AI Анализ года" modal with skeleton loader during polling.
 * Renders useLLMInsight hook state: loading → skeleton, complete → data.
 */
import { useLLMInsight } from '@/api/useLLMInsight';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sparkles, X } from 'lucide-react';

export function InsightModal({
  isOpen,
  onClose,
  startDate,
  endDate
}: {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
}) {
  const { trigger, isLoading, isError, error, data, reset } = useLLMInsight(startDate, endDate);

  useEffect(() => {
    if (isOpen && isLoading === false && data === null && !isError) {
      trigger();
    }
  }, [isOpen, isLoading, data, isError, trigger]);

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <>
      {/* Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={handleClose}
        >
          <div
            className="relative w-full max-w-xl mx-4 bg-[#F8F9FA]/90 dark:bg-[#121212]/90 backdrop-blur-3xl border border-white dark:border-white/5 rounded-3xl p-8 shadow-2xl animate-slide-up transition-all duration-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Персональный финансовый разбор</h2>
                <p className="text-sm text-slate-500 font-medium">{startDate} — {endDate}</p>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-3/4 bg-slate-200 dark:bg-white/5" />
                  <Skeleton className="h-4 w-full bg-slate-100 dark:bg-white/5" />
                  <Skeleton className="h-4 w-5/6 bg-slate-100 dark:bg-white/5" />
                  <Skeleton className="h-4 w-full bg-slate-100 dark:bg-white/5" />
                  <div className="pt-4">
                    <Skeleton className="h-20 w-full rounded-xl bg-slate-100 dark:bg-white/5" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Skeleton className="h-12 w-1/3 rounded-xl bg-slate-100 dark:bg-white/5" />
                    <Skeleton className="h-12 w-1/3 rounded-xl bg-slate-100 dark:bg-white/5" />
                    <Skeleton className="h-12 w-1/3 rounded-xl bg-slate-100 dark:bg-white/5" />
                  </div>
                  <p className="text-sm text-center text-slate-600 dark:text-slate-400 font-medium animate-pulse mt-6">
                    🧠 Нейросеть анализирует денежные потоки...
                  </p>
                </div>
              )}

              {isError && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-sm text-expense font-medium">Ошибка: {error}</p>
                  <button
                    onClick={trigger}
                    className="mt-2 text-xs text-brand-600 hover:underline"
                  >
                    Попробовать снова
                  </button>
                </div>
              )}

              {data && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{data.insight}</p>

                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-income/10 dark:bg-emerald-500/10 rounded-xl text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Доход</p>
                      <p className="text-sm font-bold text-income">
                        ₽{Number(data.summary.total_income.replace(/_/g, '')).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-expense/10 dark:bg-red-500/10 rounded-xl text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Расход</p>
                      <p className="text-sm font-bold text-expense dark:text-red-400">
                        ₽{Number(data.summary.total_expense.replace(/_/g, '')).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-brand-50 dark:bg-slate-800 rounded-xl text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Сбережения</p>
                      <p className="text-sm font-bold text-brand-700 dark:text-aura-gold">{data.summary.savings_rate}</p>
                    </div>
                  </div>

                  <p
                    className={cn(
                      'text-xs text-slate-400 text-center',
                    )}
                  >
                    Сгенерировано {new Date(data.generated_at).toLocaleString('ru-RU')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
