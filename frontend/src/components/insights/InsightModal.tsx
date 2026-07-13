/**
 * InsightModal — "AI Анализ года" modal with skeleton loader during polling.
 * Renders useLLMInsight hook state: loading → skeleton, complete → data.
 */
import { useLLMInsight } from '@/api/useLLMInsight';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sparkles, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Деньги и проценты в тексте анализа подсвечиваются акцентом — цифры читаются
// с одного взгляда, не выискиваясь в абзаце.
const MONEY_RE = /(\d[\d\s\u00A0\u202F]*(?:[.,]\d+)?[\s\u00A0\u202F]?(?:₽|руб\.?|%))/g;

function HighlightedText({ text }: { text: string }) {
  // split с капчур-группой кладёт совпадения на нечётные индексы —
  // надёжнее, чем стейтфул re.test() с флагом g.
  const parts = text.split(MONEY_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-extrabold text-[#FF7A00] whitespace-nowrap">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Modal Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-md p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative w-full max-w-2xl bg-white/90 dark:bg-[#111111]/95 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-[0_32px_80px_rgba(0,0,0,0.15)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#1C3F35]/50 dark:text-white/50 hover:bg-black/10 dark:hover:bg-white/10 hover:text-[#1C3F35] dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-5 mb-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF7A00] to-[#FFA011] flex items-center justify-center shadow-[0_10px_20px_-5px_rgba(255,122,0,0.5)] shrink-0">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-2xl md:text-3xl font-sans font-extrabold text-[#1C3F35] dark:text-white tracking-tight leading-none">
                    AI Анализ
                  </h2>
                  <p className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
                    {new Date(startDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })} — {new Date(endDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-8 min-h-[300px]">
                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-3/4 bg-black/5 dark:bg-white/5 rounded-lg" />
                      <Skeleton className="h-4 w-full bg-black/5 dark:bg-white/5 rounded-lg" />
                      <Skeleton className="h-4 w-5/6 bg-black/5 dark:bg-white/5 rounded-lg" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                      <Skeleton className="h-24 w-full rounded-2xl bg-black/5 dark:bg-white/5" />
                      <Skeleton className="h-24 w-full rounded-2xl bg-black/5 dark:bg-white/5" />
                      <Skeleton className="h-24 w-full rounded-2xl bg-black/5 dark:bg-white/5" />
                    </div>

                    <div className="flex items-center justify-center gap-3 mt-8">
                       <motion.div className="w-4 h-4 border-2 border-[#1C3F35]/20 dark:border-white/20 border-t-[#FF7A00] rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                       <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#1C3F35]/40 dark:text-white/40">
                         V.I.A. анализирует потоки...
                       </p>
                    </div>
                  </motion.div>
                )}

                {isError && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 bg-rose-50 dark:bg-rose-500/10 rounded-3xl border border-rose-200 dark:border-rose-500/20 flex flex-col items-center text-center">
                    <AlertCircle className="w-8 h-8 text-rose-500 mb-4" />
                    <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-6">Ошибка подключения к ИИ:<br/><span className="font-normal opacity-80">{error}</span></p>
                    <button
                      onClick={trigger}
                      className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-md transition-all active:scale-[0.98]"
                    >
                      Попробовать снова
                    </button>
                  </motion.div>
                )}

                {data && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                    <div className="space-y-4">
                      {data.insight
                        .split(/\n+/)
                        .filter((p) => p.trim().length > 0)
                        .map((paragraph, i) => (
                          <motion.p
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.12, duration: 0.4, ease: 'easeOut' }}
                            className={
                              i === 0
                                ? 'text-base md:text-lg font-semibold text-[#1C3F35] dark:text-white leading-relaxed'
                                : 'text-sm md:text-base font-medium text-[#1C3F35]/70 dark:text-white/70 leading-relaxed'
                            }
                          >
                            <HighlightedText text={paragraph} />
                          </motion.p>
                        ))}
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-5 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-[1.5rem] flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">Доход</p>
                        <p className="text-2xl font-sans font-black tracking-tighter tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">
                          +{Number(data.summary.total_income.replace(/_/g, '')).toLocaleString('ru-RU')}
                          <span className="text-sm font-bold opacity-60 tracking-normal ml-1">₽</span>
                        </p>
                      </div>
                      <div className="p-5 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 rounded-[1.5rem] flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-2">Расход</p>
                        <p className="text-2xl font-sans font-black tracking-tighter tabular-nums text-rose-600 dark:text-rose-400 leading-none">
                          -{Number(data.summary.total_expense.replace(/_/g, '')).toLocaleString('ru-RU')}
                          <span className="text-sm font-bold opacity-60 tracking-normal ml-1">₽</span>
                        </p>
                      </div>
                      <div className="p-5 bg-[#FF7A00]/5 dark:bg-[#FF7A00]/10 border border-[#FF7A00]/20 rounded-[1.5rem] flex flex-col items-center justify-center text-center">
                        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#FF7A00] mb-2">Сбережения</p>
                        <p className="text-2xl font-sans font-black tracking-tighter tabular-nums text-[#FF7A00] leading-none">
                          {data.summary.savings_rate}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-black/5 dark:border-white/5">
                      <p className="text-[10px] font-mono text-[#1C3F35]/30 dark:text-white/30 text-center uppercase tracking-[0.25em] font-bold">
                        V.I.A. СГЕНЕРИРОВАНО {new Date(data.generated_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}