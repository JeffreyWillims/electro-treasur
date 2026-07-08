/**
 * InsightHistory — таймлайн прошлых ежемесячных советов (GET /v1/insights).
 * Свёрнут по умолчанию; раскрывается по клику. Данные уже считаются на сервере.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { History, ChevronDown } from 'lucide-react';
import { fetchInsightHistory } from '@/api/client';

const money = (v: unknown) =>
  Number(v ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 });

export function InsightHistory() {
  const [open, setOpen] = useState(false);
  const { data: history = [] } = useQuery({
    queryKey: ['insightHistory'],
    queryFn: () => fetchInsightHistory(12),
    staleTime: 60_000,
  });

  if (history.length <= 1) return null; // нечего показывать, пока нет истории

  return (
    <div className="rounded-[2rem] border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-7 py-5"
      >
        <span className="flex items-center gap-3 font-sans font-extrabold text-[#1C3F35] dark:text-white">
          <History className="w-5 h-5 text-[#FF7A00]" />
          История советов
          <span className="text-xs font-bold text-[#1C3F35]/40 dark:text-white/40">
            {history.length}
          </span>
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="w-5 h-5 text-[#1C3F35]/40 dark:text-white/40" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-7 pb-6 space-y-4">
              {history.map((h, i) => {
                const saved = Number(
                  (h.summary as Record<string, unknown>)?.saved ?? 0,
                );
                return (
                  <div
                    key={`${h.period_start}-${i}`}
                    className="relative pl-6 border-l-2 border-[#FF7A00]/30"
                  >
                    <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-[#FF7A00]" />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold text-[#1C3F35]/60 dark:text-white/50">
                        {h.period_start} — {h.period_end}
                      </p>
                      <span
                        className={`text-xs font-extrabold tabular-nums ${
                          saved >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                        }`}
                      >
                        {saved >= 0 ? '+' : ''}
                        {money(saved)} ₽
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#1C3F35]/80 dark:text-white/70 whitespace-pre-line line-clamp-3">
                      {h.advice}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
