/**
 * InsightModal — "AI Анализ года" modal with skeleton loader during polling.
 * Renders useLLMInsight hook state: loading → skeleton, complete → data.
 */
import { useState } from 'react';
import { useLLMInsight } from '@/api/useLLMInsight';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sparkles, X } from 'lucide-react';

export function InsightModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [year] = useState(2025);
  const { trigger, isLoading, isError, error, data, reset } = useLLMInsight(year);

  const handleOpen = () => {
    setIsOpen(true);
    trigger();
  };

  const handleClose = () => {
    setIsOpen(false);
    reset();
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className="group relative px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md transition-colors text-sm rounded-xl flex items-center gap-2"
      >
        <Sparkles className="w-4 h-4 group-hover:animate-spin" />
        AI Анализ года
      </button>

      {/* Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={handleClose}
        >
          <div
            className="relative w-full max-w-lg mx-4 bg-white rounded-3xl shadow-2xl p-8 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-pink flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Персональный финансовый разбор</h2>
                <p className="text-xs text-slate-400">{year} год</p>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-full" />
                  <div className="pt-4">
                    <Skeleton className="h-20 w-full rounded-xl" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Skeleton className="h-12 w-1/3 rounded-xl" />
                    <Skeleton className="h-12 w-1/3 rounded-xl" />
                    <Skeleton className="h-12 w-1/3 rounded-xl" />
                  </div>
                  <p className="text-xs text-center text-slate-400 animate-pulse">
                    🧠 Ваш финансовый наставник анализирует данные...
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
                  <p className="text-sm text-slate-700 leading-relaxed">{data.insight}</p>

                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-income/10 rounded-xl text-center">
                      <p className="text-xs text-slate-500">Доход</p>
                      <p className="text-sm font-bold text-income">
                        ₽{Number(data.summary.total_income.replace(/_/g, '')).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-expense/10 rounded-xl text-center">
                      <p className="text-xs text-slate-500">Расход</p>
                      <p className="text-sm font-bold text-expense">
                        ₽{Number(data.summary.total_expense.replace(/_/g, '')).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-brand-50 rounded-xl text-center">
                      <p className="text-xs text-slate-500">Сбережения</p>
                      <p className="text-sm font-bold text-brand-700">{data.summary.savings_rate}</p>
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
