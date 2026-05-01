/**
 * GlassDateRangePicker — Premium date-range selector for Citrine Vault.
 *
 * Architecture:
 *   • TriggerPill — glassmorphic pill button showing current range
 *   • GlassPopover — backdrop-blur panel with presets + calendar grid
 *   • CalendarGrid — custom 7×6 grid built on date-fns (tree-shaken ~4KB)
 *   • Range highlight: soft fill between caps, Pine/Citrine endpoint caps
 *   • Framer-motion for popover enter/exit + month transition crossfade
 *
 * State Machine:
 *   IDLE → OPEN → SELECTING (first cap clicked) → IDLE (second cap fires onChange)
 *
 * Bundle: date-fns tree-shaken imports only. Zero headless-UI deps.
 * Time Complexity: O(42) per render (fixed 6-week grid). Space O(1).
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
  startOfYear,
  endOfYear,
  subDays,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────────────────────────── */
interface GlassDateRangePickerProps {
  startDate: string;  // "YYYY-MM-DD" | ""
  endDate: string;    // "YYYY-MM-DD" | ""
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  align?: 'left' | 'right';
}

/* ── Helper: YYYY-MM-DD string ↔ Date ─────────────────────────────── */
const toDate = (s: string): Date | null => {
  if (!s) return null;
  const parts = s.split('-');
  if (parts.length < 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
};

const toStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ── Weekday header (Mon-Sun, Russian short) ─────────────────────── */
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/* ── Quick Presets ────────────────────────────────────────────────── */
interface Preset {
  label: string;
  getRange: () => [Date, Date];
}

const getPresets = (): Preset[] => {
  const now = new Date();
  return [
    {
      label: 'Текущий месяц',
      getRange: () => [startOfMonth(now), endOfMonth(now)],
    },
    {
      label: 'Прошлый месяц',
      getRange: () => {
        const prev = subMonths(now, 1);
        return [startOfMonth(prev), endOfMonth(prev)];
      },
    },
    {
      label: 'Последние 30 дней',
      getRange: () => [subDays(now, 29), now],
    },
    {
      label: 'Весь год',
      getRange: () => [startOfYear(now), endOfYear(now)],
    },
  ];
};

/* ══════════════════════════════════════════════════════════════════════
 * Component: GlassDateRangePicker
 * ════════════════════════════════════════════════════════════════════ */
export function GlassDateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = 'Выберите период',
  align = 'left',
}: GlassDateRangePickerProps) {
  /* ── State ───────────────────────────────────────────────────────── */
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const sd = toDate(startDate);
    return sd ?? new Date();
  });

  // Range selection in progress (first cap clicked, waiting for second)
  const [selecting, setSelecting] = useState<Date | null>(null);
  const [hoverDay, setHoverDay] = useState<Date | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /* ── Derived dates ──────────────────────────────────────────────── */
  const sd = useMemo(() => toDate(startDate), [startDate]);
  const ed = useMemo(() => toDate(endDate), [endDate]);
  const presets = useMemo(() => getPresets(), []);

  /* ── Close on outside click ─────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSelecting(null);
        setHoverDay(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen]);

  /* ── Close on Escape ────────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSelecting(null);
        setHoverDay(null);
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen]);

  /* ── Sync viewMonth when startDate prop changes externally ──────── */
  useEffect(() => {
    const d = toDate(startDate);
    if (d) setViewMonth(d);
  }, [startDate]);

  /* ── Calendar grid: 42 cells (6 rows × 7 cols) ─────────────────── */
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  /* ── Preset click ───────────────────────────────────────────────── */
  const applyPreset = useCallback(
    (preset: Preset) => {
      const [s, e] = preset.getRange();
      onChange(toStr(s), toStr(e));
      setViewMonth(s);
      setSelecting(null);
      setHoverDay(null);
      setIsOpen(false);
    },
    [onChange],
  );

  /* ── Day click — two-click range selection ──────────────────────── */
  const handleDayClick = useCallback(
    (day: Date) => {
      if (!selecting) {
        // First click — set start
        setSelecting(day);
        setHoverDay(null);
      } else {
        // Second click — determine order and fire onChange
        let s = selecting;
        let e = day;
        if (isAfter(s, e)) {
          [s, e] = [e, s];
        }
        onChange(toStr(s), toStr(e));
        setSelecting(null);
        setHoverDay(null);
        setIsOpen(false);
      }
    },
    [selecting, onChange],
  );

  /* ── Determine visual range for highlighting ────────────────────── */
  const visualRange = useMemo(() => {
    if (selecting) {
      // While selecting, show live preview
      const other = hoverDay ?? selecting;
      const a = isBefore(selecting, other) ? selecting : other;
      const b = isBefore(selecting, other) ? other : selecting;
      return { start: a, end: b };
    }
    if (sd && ed) {
      return { start: sd, end: ed };
    }
    return null;
  }, [selecting, hoverDay, sd, ed]);

  /* ── Trigger text ───────────────────────────────────────────────── */
  const triggerText = useMemo(() => {
    if (sd && ed) {
      const fs = format(sd, 'd MMM', { locale: ru });
      const fe = format(ed, 'd MMM', { locale: ru });
      return `${fs} — ${fe}`;
    }
    return placeholder;
  }, [sd, ed, placeholder]);

  /* ── Check if a preset is currently active ──────────────────────── */
  const isPresetActive = useCallback(
    (preset: Preset) => {
      if (!sd || !ed) return false;
      const [ps, pe] = preset.getRange();
      return isSameDay(sd, ps) && isSameDay(ed, pe);
    },
    [sd, ed],
  );

  /* ── Month navigation ──────────────────────────────────────────── */
  const goNext = () => setViewMonth((m) => addMonths(m, 1));
  const goPrev = () => setViewMonth((m) => subMonths(m, 1));

  /* ── Today reference ───────────────────────────────────────────── */
  const today = useMemo(() => new Date(), []);

  return (
    <div className="relative inline-block">
      {/* ── Trigger Pill ─────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'bg-white/60 dark:bg-white/5 backdrop-blur-2xl',
          'border border-slate-200/50 dark:border-white/10',
          'rounded-2xl h-12 px-5',
          'flex items-center gap-3',
          'shadow-sm hover:shadow-md',
          'transition-all duration-300',
          'cursor-pointer select-none',
          isOpen && 'ring-2 ring-[#1C3F35]/20 dark:ring-emerald-500/30',
        )}
      >
        <CalendarDays className="w-4.5 h-4.5 text-[#1C3F35] dark:text-emerald-400 shrink-0" />
        <span className="text-sm font-bold text-slate-800 dark:text-white tracking-wide whitespace-nowrap">
          {triggerText}
        </span>
        <ChevronRight
          className={cn(
            'w-3.5 h-3.5 text-[#FF7A00] transition-transform duration-300 shrink-0',
            isOpen && 'rotate-90',
          )}
        />
      </button>

      {/* ── Popover ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'absolute top-[110%] z-[60]',
              align === 'right' ? 'right-0' : 'left-0',
              'bg-white/90 dark:bg-[#0A0A0A]/90',
              'backdrop-blur-3xl',
              'border border-white/40 dark:border-white/10',
              'rounded-3xl',
              'shadow-[0_30px_60px_rgba(0,0,0,0.12)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.8)]',
              'p-5',
              'flex gap-0',
              'min-w-[420px]',
            )}
          >
            {/* ── Left: Quick Presets ────────────────────────────── */}
            <div className="border-r border-slate-200/50 dark:border-white/5 pr-4 mr-4 flex flex-col gap-1.5 min-w-[130px] justify-center">
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-white/30 mb-2">
                Быстрый выбор
              </p>
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    'text-left text-[13px] font-semibold px-3 py-2 rounded-xl transition-all duration-200',
                    isPresetActive(preset)
                      ? 'bg-[#1C3F35] dark:bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-white/60 hover:bg-[#1C3F35]/10 dark:hover:bg-white/5 hover:text-[#1C3F35] dark:hover:text-white',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* ── Right: Calendar ────────────────────────────────── */}
            <div className="flex-1 min-w-[252px]">
              {/* Month Header */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={goPrev}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-white/50" />
                </button>
                <span className="text-sm font-bold text-slate-800 dark:text-white capitalize tracking-wide">
                  {format(viewMonth, 'LLLL yyyy', { locale: ru })}
                </span>
                <button
                  onClick={goNext}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-slate-500 dark:text-white/50" />
                </button>
              </div>

              {/* Weekday Header */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((wd) => (
                  <div
                    key={wd}
                    className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/25 py-1"
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Day Grid with month crossfade */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={viewMonth.toISOString()}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="grid grid-cols-7"
                >
                  {calendarDays.map((day) => {
                    const inMonth = isSameMonth(day, viewMonth);
                    const isToday = isSameDay(day, today);

                    // Range state
                    const isStart = visualRange ? isSameDay(day, visualRange.start) : false;
                    const isEnd = visualRange ? isSameDay(day, visualRange.end) : false;
                    const isSingle = isStart && isEnd;
                    const inRange =
                      visualRange && !isSingle && !isStart && !isEnd
                        ? isWithinInterval(day, { start: visualRange.start, end: visualRange.end })
                        : false;

                    // Rounding logic for range fill
                    const isLeftCap = isStart && !isSingle;
                    const isRightCap = isEnd && !isSingle;

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => handleDayClick(day)}
                        onMouseEnter={() => {
                          if (selecting) setHoverDay(day);
                        }}
                        onMouseLeave={() => {
                          if (selecting) setHoverDay(null);
                        }}
                        className={cn(
                          'relative h-9 w-full text-[13px] font-semibold transition-all duration-150 cursor-pointer',
                          // Default
                          !isStart && !isEnd && !inRange && 'hover:bg-slate-100/60 dark:hover:bg-white/5 rounded-lg',
                          // Opacity for other months
                          !inMonth && 'opacity-30',
                          // In-range fill
                          inRange && 'bg-[#1C3F35]/10 dark:bg-white/5 rounded-none',
                          // Start cap
                          isLeftCap && 'bg-[#1C3F35] dark:bg-emerald-600 text-white rounded-l-full rounded-r-none',
                          // End cap
                          isRightCap && 'bg-[#1C3F35] dark:bg-emerald-600 text-white rounded-r-full rounded-l-none',
                          // Single day
                          isSingle && 'bg-[#FF7A00] text-white rounded-full',
                          // Today ring (only when not a cap)
                          isToday && !isStart && !isEnd && !isSingle && 'ring-1 ring-[#FF7A00]/60 text-[#FF7A00] font-bold rounded-lg',
                          // Default text
                          !isStart && !isEnd && !isSingle && !isToday && 'text-slate-700 dark:text-white/80',
                        )}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>

              {/* Selection hint */}
              {selecting && (
                <p className="text-[10px] font-mono text-[#FF7A00] mt-2 text-center animate-pulse tracking-wider">
                  Выберите конец диапазона
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
