import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameDay, isSameMonth, addMonths, subMonths
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlassDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  className?: string;
}

const toDate = (s: string) => {
  if (!s) return new Date();
  const parts = s.split('-');
  if (parts.length < 3) return new Date();

  // Добавляем || '0', чтобы TypeScript был на 100% уверен, что передает строку
  const y = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  const d = parseInt(parts[2] || '0', 10);

  return new Date(y, m - 1, d);
};

const toStr = (d: Date) => format(d, 'yyyy-MM-dd');
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function GlassDatePicker({ value, onChange, className }: GlassDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => toDate(value));

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeDate = useMemo(() => toDate(value), [value]);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen]);

  const handleSelect = useCallback((d: Date) => {
    onChange(toStr(d));
    setIsOpen(false);
  }, [onChange]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  return (
    <div className={cn("relative flex items-center h-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-full text-center outline-none bg-transparent text-lg font-bold text-slate-900 dark:text-white cursor-pointer flex items-center justify-center"
      >
        {format(activeDate, 'd MMM yyyy', { locale: ru }).replace(' г.', '')}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[110%] right-0 z-[100] bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-3xl border border-black/5 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] rounded-3xl p-5 flex flex-col min-w-[280px]"
          >
            {/* ── Calendar Grid (Без быстрых пресетов) ── */}
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-4 h-4 text-[#1C3F35] dark:text-white" />
              </button>
              <span className="text-xs font-bold text-[#1C3F35] dark:text-white uppercase tracking-wider">
                {format(viewMonth, 'LLLL yyyy', { locale: ru })}
              </span>
              <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <ChevronRight className="w-4 h-4 text-[#1C3F35] dark:text-white" />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="text-center text-[10px] font-bold uppercase text-[#1C3F35]/40 dark:text-white/30 pb-1">
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {calendarDays.map((day) => {
                const inMonth = isSameMonth(day, viewMonth);
                const isSelected = isSameDay(day, activeDate);
                const isToday = isSameDay(day, today);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelect(day)}
                    className={cn(
                      'h-8 w-8 mx-auto flex items-center justify-center text-xs font-bold transition-all duration-200 cursor-pointer',
                      !inMonth && 'opacity-20',
                      isSelected
                        ? 'bg-[#FF7A00] text-white rounded-full shadow-md scale-110'
                        : 'hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-[#1C3F35] dark:text-white/90',
                      isToday && !isSelected && 'ring-1 ring-[#FF7A00]/50 text-[#FF7A00]'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}