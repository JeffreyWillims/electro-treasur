/**
 * PacificRide.tsx — «Десятка» 🔟 (техническое имя — "The Pacific Ride",
 * California Sunset Edition · сочный игровой фидбэк)
 *
 * Кинематографичная пасхалка для Citrine Vault.
 * Возможности:
 *   1. Фон в стиле California Organic Luxury sunset
 *   2. Number Match / Семечки — 3 уровня, движок соседства без багов
 *   3. «Сочный» игровой фидбэк: вспышка совпадения, анимация зачёркивания,
 *      тряска ячейки, волны победы
 *   4. Премиальная светлая тема и интерактивный туториал
 *
 * Стек: React 19 + Framer Motion 12 + Tailwind CSS 3
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitScore } from '@/lib/gameRecords';

interface PacificRideProps {
  onClose: () => void;
}

const COLS = 9;
const MAX_CELLS = 1000;

// Метаданные уровней: числа на поле генерируются случайно при каждой партии
// (rows × COLS цифр 1–9), поэтому две партии подряд больше не совпадают.
const LEVEL_META = [
  { label: 'УРОВЕНЬ 1 · ОБУЧЕНИЕ', hint: 'Одинаковые или в сумме 10 — пустые ячейки пропускаются', rows: 2 },
  { label: 'УРОВЕНЬ 2 · КЛАССИКА', hint: 'По горизонтали, вертикали и диагонали', rows: 3 },
  { label: 'УРОВЕНЬ 3 · МАСТЕР', hint: 'Думай наперёд — не все пары на поверхности', rows: 4 },
  { label: 'УРОВЕНЬ 4 · ЭКСПЕРТ', hint: 'Добавления ограничены — трать с умом', rows: 5 },
  { label: 'УРОВЕНЬ 5 · ЛЕГЕНДА', hint: 'Финал: серия комбо решает всё', rows: 5 },
] as const;

function randomGrid(rows: number): number[] {
  return Array.from({ length: rows * COLS }, () => 1 + Math.floor(Math.random() * 9));
}

// Игровая экономика: очки за пару растут с комбо, окно серии тает за 5 секунд.
const MATCH_POINTS = 10;
const LEVEL_BONUS = 100;
const COMBO_WINDOW_MS = 5000;
// Лимит "+Добавить цифры" на уровень — чем дальше, тем жёстче.
const ADDS_PER_LEVEL = [3, 3, 2, 2, 1] as const;

type Cell = {
  id: string;
  value: number;
  crossed: boolean;
  justMatched: boolean;
};

const STARS = Array.from({ length: 50 }, (_, i) => ({
  id: i, size: Math.random() * 1.8 + 0.4, top: Math.random() * 46,
  left: Math.random() * 100, opacity: Math.random() * 0.55 + 0.2,
  dur: 2.5 + Math.random() * 3.5, delay: Math.random() * 5,
}));

const CLOUDS = Array.from({ length: 6 }, (_, i) => ({
  id: i, top: 8 + Math.random() * 28, width: 120 + Math.random() * 180,
  opacity: 0.04 + Math.random() * 0.07, dur: 55 + Math.random() * 50,
  startX: -20 - Math.random() * 40,
}));

const RIPPLES = [0, 1, 2, 3, 4];

// 🔥 ИСПРАВЛЕНИЕ БАГА 1: Движок теперь принимает ID вместо индексов
function canMatch(cells: Cell[], idA: string, idB: string): boolean {
  if (idA === idB) return false;

  const i = cells.findIndex(c => c.id === idA);
  const j = cells.findIndex(c => c.id === idB);
  if (i === -1 || j === -1) return false;

  const ci = cells[i];
  const cj = cells[j];

  if (!ci || !cj || ci.crossed || cj.crossed || ci.justMatched || cj.justMatched) return false;
  if (ci.value !== cj.value && ci.value + cj.value !== 10) return false;

  const a = Math.min(i, j);
  const b = Math.max(i, j);

  let linearClear = true;
  for (let k = a + 1; k < b; k++) {
    if (!cells[k]?.crossed && !cells[k]?.justMatched) { linearClear = false; break; }
  }
  if (linearClear) return true;

  const ra = Math.floor(a / COLS), ca = a % COLS;
  const rb = Math.floor(b / COLS), cb = b % COLS;

  if (ca === cb) {
    let vertClear = true;
    for (let r = ra + 1; r < rb; r++) {
      const idx = r * COLS + ca;
      if (idx < cells.length && !cells[idx]?.crossed && !cells[idx]?.justMatched) { vertClear = false; break; }
    }
    if (vertClear) return true;
  }

  const dr = rb - ra;
  const dc = Math.abs(cb - ca);
  if (dr > 0 && dr === dc) {
    const colStep = cb > ca ? 1 : -1;
    let diagClear = true;
    for (let step = 1; step < dr; step++) {
      const col = ca + step * colStep;
      if (col < 0 || col >= COLS) { diagClear = false; break; }
      const idx = (ra + step) * COLS + col;
      if (!cells[idx]?.crossed && !cells[idx]?.justMatched) { diagClear = false; break; }
    }
    if (diagClear) return true;
  }

  return false;
}

function makeGrid(values: readonly number[]): Cell[] {
  return values.map(v => ({
    id: Math.random().toString(36).slice(2, 11),
    value: v, crossed: false, justMatched: false,
  }));
}

// Экспорт: единый закатный фон для всех игр Arcade (используют Game512 и MathSprint).
export function SunsetBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #080118 0%, #130428 12%, #2a0e44 24%, #56206a 38%, #8b3578 50%, #c45540 62%, #e47c36 74%, #f3a040 84%, #ffd078 92%, #ffeaa5 100%)' }} />
      {STARS.map(s => <motion.div key={s.id} className="absolute rounded-full bg-white" style={{ width: s.size, height: s.size, top: `${s.top}%`, left: `${s.left}%` }} animate={{ opacity: [s.opacity * 0.35, s.opacity, s.opacity * 0.35] }} transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }} />)}
      {[{ top: 8, left: 62, delay: 3, dur: 1.4 }, { top: 16, left: 18, delay: 11, dur: 1.7 }].map((m, i) => (
        <motion.div key={`meteor-${i}`} className="absolute" style={{ top: `${m.top}%`, left: `${m.left}%`, width: 90, height: 1.5, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.9))', transform: 'rotate(-32deg)', transformOrigin: 'right center' }} initial={{ x: -140, opacity: 0 }} animate={{ x: 180, opacity: [0, 1, 0] }} transition={{ duration: m.dur, repeat: Infinity, repeatDelay: 13, delay: m.delay, ease: 'easeIn' }} />
      ))}
      {CLOUDS.map(c => <motion.div key={c.id} className="absolute rounded-full" style={{ top: `${c.top}%`, width: c.width, height: c.width * 0.28, background: 'rgba(255,220,200,1)', opacity: c.opacity, filter: 'blur(22px)', left: `${c.startX}%` }} animate={{ x: ['0%', '130vw'] }} transition={{ duration: c.dur, repeat: Infinity, ease: 'linear', delay: c.id * 9 }} />)}
      <motion.div className="absolute rounded-full" style={{ width: 380, height: 380, bottom: 'calc(27% - 90px)', left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(255,200,80,0.2) 0%, rgba(255,120,20,0.1) 45%, transparent 70%)', filter: 'blur(38px)' }} animate={{ scale: [1, 1.09, 1] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
      <div className="absolute" style={{ bottom: '27%', left: '50%', transform: 'translateX(-50%)' }}>
        <motion.div className="rounded-full" style={{ width: 140, height: 140, background: 'radial-gradient(circle, #fff8dc 0%, #ffd700 18%, #ff9500 48%, #ff5200 78%, rgba(255,50,0,0) 100%)', boxShadow: '0 0 55px 18px rgba(255,160,30,0.55), 0 0 110px 45px rgba(255,90,0,0.25), 0 0 180px 70px rgba(255,50,0,0.1)', filter: 'blur(0.6px)' }} animate={{ scale: [1, 1.035, 1], opacity: [0.93, 1, 0.93] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
      <div className="absolute" style={{ bottom: '25%', left: '50%', transform: 'translateX(-50%)', width: '135%', height: 65, background: 'radial-gradient(ellipse, rgba(255,175,65,0.48) 0%, rgba(255,85,0,0.12) 45%, transparent 70%)', filter: 'blur(20px)' }} />
      <div className="absolute bottom-0 left-0 right-0" style={{ height: '28%', background: 'linear-gradient(to bottom, rgba(22,6,55,0.87) 0%, rgba(6,2,25,0.97) 100%)', borderTop: '1px solid rgba(255,195,95,0.22)' }} />
      <div className="absolute" style={{ bottom: '2%', left: '50%', transform: 'translateX(-50%)', width: 90, height: '23%', background: 'linear-gradient(to bottom, rgba(255,175,65,0.5) 0%, rgba(255,120,30,0.14) 55%, transparent 100%)', filter: 'blur(10px)' }} />
      {[9, 14, 18, 22].map((pct, i) => <motion.div key={i} className="absolute left-0 right-0" style={{ bottom: `${pct}%`, height: 1, background: 'linear-gradient(to right, transparent 5%, rgba(255,195,95,0.22) 22%, rgba(255,225,120,0.62) 50%, rgba(255,195,95,0.22) 78%, transparent 95%)' }} animate={{ scaleX: [0.82, 1.1, 0.82], opacity: [0.22, 0.62, 0.22] }} transition={{ duration: 3.8 + i * 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.75 }} />)}
    </div>
  );
}

function HelpScreen({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6"
      style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <h3 className="text-xl font-black text-slate-800 mb-6 tracking-tight text-center">ПРАВИЛА</h3>
        <ul className="text-sm text-slate-700 space-y-4 mb-8">
          <li className="flex gap-3"><span className="text-lg leading-none">🎯</span> <span>Вычеркни все цифры на поле.</span></li>
          <li className="flex gap-3"><span className="text-lg leading-none">🤝</span> <span>Выделяй <b>одинаковые</b> цифры (5 и 5) или дающие в сумме <b>10</b> (3 и 7).</span></li>
          <li className="flex gap-3"><span className="text-lg leading-none">👻</span> <span>Пары могут перепрыгивать через уже <b>вычеркнутые</b> клетки.</span></li>
          <li className="flex gap-3"><span className="text-lg leading-none">🔄</span> <span>Конец одной строки соединяется с началом следующей.</span></li>
        </ul>
        <motion.button
          onClick={onClose} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          className="w-full py-3.5 bg-slate-800 text-white rounded-xl font-bold uppercase tracking-widest text-xs outline-none"
        >
          ПОНЯТНО
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function WinScreen({ levelIdx, score, onNext }: { levelIdx: number; score: number; onNext: () => void }) {
  const isLast = levelIdx >= LEVEL_META.length - 1;
  const textVariants = {
    hidden: { opacity: 0, y: 18 },
    show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.45, ease: 'easeOut' as const } }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.72 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="flex flex-col items-center gap-5 py-8 px-4 text-center relative overflow-hidden"
    >
      {RIPPLES.map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-orange-500/20 pointer-events-none"
          style={{ width: 60, height: 60, top: '18%', left: '50%', x: '-50%', y: '-50%' }}
          initial={{ scale: 0.5, opacity: 0.7 }}
          animate={{ scale: 4 + i * 1.5, opacity: 0 }}
          transition={{ duration: 2.2, delay: i * 0.32, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      <motion.span className="text-5xl relative z-10" animate={{ rotate: [0, 14, -14, 9, -9, 0], scale: [1, 1.18, 1] }} transition={{ duration: 1.3, repeat: 2 }}>
        🌅
      </motion.span>
      <div className="relative z-10">
        <motion.p custom={0} variants={textVariants} initial="hidden" animate="show" className="text-xl font-black text-slate-800 leading-tight">
          {isLast ? 'СИСТЕМА ДЕКРИПТОВАНА' : 'УРОВЕНЬ ПРОЙДЕН!'}
        </motion.p>
        <motion.p custom={1} variants={textVariants} initial="hidden" animate="show" className="text-[10px] font-mono text-slate-400 mt-2 uppercase tracking-widest">
          {isLast ? 'Вы — хранитель калифорнийского заката' : `Готов к уровню ${levelIdx + 2}?`}
        </motion.p>
        <motion.p custom={2} variants={textVariants} initial="hidden" animate="show" className="text-2xl font-black text-orange-500 mt-3 font-mono">
          {score} <span className="text-[10px] text-slate-400 tracking-widest">ОЧКОВ</span>
        </motion.p>
      </div>
      {!isLast && (
        <motion.button
          custom={3} variants={textVariants} initial="hidden" animate="show" onClick={onNext}
          whileHover={{ scale: 1.06, boxShadow: '0 0 20px rgba(255,145,0,0.3)' }} whileTap={{ scale: 0.94 }}
          className="relative z-10 px-8 py-3 rounded-2xl text-white font-bold uppercase tracking-widest text-xs outline-none"
          style={{ background: 'linear-gradient(135deg, #FF7A00, #FFB020)' }}
        >
          Следующий уровень →
        </motion.button>
      )}
    </motion.div>
  );
}

interface CellProps {
  cell: Cell; isSelected: boolean; isBadTarget: boolean; onClick: () => void;
}

const GameCell = React.memo(({ cell, isSelected, isBadTarget, onClick }: CellProps) => {
  const matchFlash   = cell.justMatched && !cell.crossed;
  const matchVanish  = cell.justMatched && cell.crossed;

  return (
    <motion.button
      onClick={onClick}
      disabled={cell.crossed || cell.justMatched}
      initial={false}
      animate={{
        scale:   cell.crossed && !cell.justMatched ? 0 : matchFlash ? 1.22 : isSelected ? 1.13 : 1,
        opacity: cell.crossed && !cell.justMatched ? 0 : matchVanish ? 0.15 : 1,
      }}
      transition={{ duration: matchFlash || matchVanish ? 0.22 : 0.17, type: 'spring', stiffness: matchFlash ? 600 : 480, damping: 28 }}
      style={{
        cursor: cell.crossed ? 'default' : 'pointer',
        pointerEvents: (cell.crossed && !cell.justMatched) ? 'none' : 'auto',
        color: matchFlash ? '#FF7A00' : isSelected ? '#FF7A00' : '#1e293b',
        background: matchFlash || matchVanish ? 'rgba(255,122,0,0.15)' : isSelected ? 'rgba(255,122,0,0.08)' : isBadTarget ? 'rgba(255,80,80,0.1)' : 'rgba(0,0,0,0.03)',
        outline: matchFlash ? '1.5px solid rgba(255,122,0,0.8)' : isSelected ? '1.5px solid rgba(255,122,0,0.5)' : isBadTarget ? '1.5px solid rgba(255,80,80,0.5)' : '1px solid rgba(0,0,0,0.04)',
        boxShadow: matchFlash ? '0 0 12px rgba(255,122,0,0.3)' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
      className="aspect-square flex items-center justify-center rounded-xl text-base font-black font-mono select-none outline-none focus:outline-none"
    >
      {cell.crossed && !cell.justMatched ? null : cell.value}
      <AnimatePresence>
        {cell.justMatched && (
          <motion.span
            key="strike" className="absolute inset-x-[10%] rounded-full pointer-events-none"
            style={{ top: '50%', height: 2, background: 'linear-gradient(to right, transparent, #FF7A00, transparent)', transformOrigin: 'left center' }}
            initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
});

const MATCH_FLASH_MS = 280;

function NumberMatchGame() {
  const [levelIdx, setLevelIdx]       = useState(0);
  // Случайные сетки на всю партию; пересоздаются при рестарте уровня.
  const gridsRef                      = useRef<number[][]>(LEVEL_META.map((m) => randomGrid(m.rows)));
  const [cells, setCells]             = useState<Cell[]>(() => makeGrid(gridsRef.current[0]!));
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [badId, setBadId]             = useState<string | null>(null);
  const [panelShake, setPanelShake]   = useState(false);
  const [showHelp, setShowHelp]       = useState(false);
  const [score, setScore]             = useState(0);
  const [combo, setCombo]             = useState(0);
  // Рекорд для Citrine Arcade (localStorage) — на геймплей не влияет.
  useEffect(() => {
    if (score > 0) submitScore('match', score);
  }, [score]);
  const [lastGain, setLastGain]       = useState<{ amount: number; key: number } | null>(null);
  const [addsLeft, setAddsLeft]       = useState<number>(ADDS_PER_LEVEL[0]);
  const badTimeoutRef                 = useRef<NodeJS.Timeout | null>(null);
  const comboTimeoutRef               = useRef<NodeJS.Timeout | null>(null);
  const bonusAwardedRef               = useRef(false);

  useEffect(() => {
    return () => {
      if (badTimeoutRef.current) clearTimeout(badTimeoutRef.current);
      if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    };
  }, []);

  // 🔥 ТВОЙ ФИКС: Очистка пустых строк!
  useEffect(() => {
    // Не чистим, если массив пустой (значит мы победили) или если идет анимация
    if (cells.length === 0 || cells.some(c => c.justMatched)) return;

    let hasEmptyRows = false;
    const newCells: Cell[] = [];

    // Проходимся по сетке построчно
    for (let i = 0; i < cells.length; i += COLS) {
      const row = cells.slice(i, i + COLS);
      // Если в строке есть элементы и ВСЕ они зачеркнуты -> строку удаляем
      if (row.length > 0 && row.every(c => c.crossed)) {
        hasEmptyRows = true;
      } else {
        newCells.push(...row);
      }
    }

    if (hasEmptyRows) {
      setCells(newCells);
    }
  }, [cells]);

  // 🔥 ИСПРАВЛЕНИЕ БАГА 2: Условие победы теперь работает, даже если массив cells схлопнулся до 0.
  const isWon = useMemo(() => cells.length === 0 || cells.every(c => c.crossed), [cells]);

  const remaining = useMemo(() => cells.filter(c => !c.crossed).length, [cells]);

  // Бонус за прохождение уровня — один раз на уровень
  useEffect(() => {
    if (isWon && !bonusAwardedRef.current) {
      bonusAwardedRef.current = true;
      setScore(s => s + LEVEL_BONUS * (levelIdx + 1));
    }
  }, [isWon, levelIdx]);

  const resetCombo = useCallback(() => {
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    comboTimeoutRef.current = null;
    setCombo(0);
  }, []);

  const goNextLevel = useCallback(() => {
    const next = levelIdx + 1;
    if (next < LEVEL_META.length) {
      setLevelIdx(next);
      setCells(makeGrid(gridsRef.current[next]!));
      setSelectedId(null);
      setBadId(null);
      setPanelShake(false);
      setAddsLeft(ADDS_PER_LEVEL[next] ?? 1);
      bonusAwardedRef.current = false;
      resetCombo();
    }
  }, [levelIdx, resetCombo]);

  const restartLevel = useCallback(() => {
    // Новый случайный расклад на этот же уровень — «разброс» при каждом рестарте.
    gridsRef.current[levelIdx] = randomGrid(LEVEL_META[levelIdx]?.rows ?? 2);
    setCells(makeGrid(gridsRef.current[levelIdx]!));
    setSelectedId(null);
    setBadId(null);
    setPanelShake(false);
    setAddsLeft(ADDS_PER_LEVEL[levelIdx] ?? 1);
    resetCombo();
  }, [levelIdx, resetCombo]);

  const handleCellClick = useCallback((id: string) => {
    const clickedCell = cells.find(c => c.id === id);
    if (!clickedCell || clickedCell.crossed) return;

    if (selectedId === null) { setSelectedId(id); return; }
    if (selectedId === id) { setSelectedId(null); return; }

    if (canMatch(cells, selectedId, id)) {
      const idA = selectedId;
      const idB = id;

      // Комбо: успел в окно — множитель растёт, очки летят вверх
      const nextCombo = combo + 1;
      const gained = MATCH_POINTS * nextCombo;
      setCombo(nextCombo);
      setScore(s => s + gained);
      setLastGain({ amount: gained, key: Date.now() });
      if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
      comboTimeoutRef.current = setTimeout(() => {
        comboTimeoutRef.current = null;
        setCombo(0);
      }, COMBO_WINDOW_MS);

      setCells(prev => prev.map(c => c.id === idA || c.id === idB ? { ...c, justMatched: true } : c));
      setSelectedId(null);

      setTimeout(() => {
        setCells(prev => prev.map(c => c.id === idA || c.id === idB ? { ...c, crossed: true } : c));
        setTimeout(() => {
          setCells(prev => prev.map(c => c.id === idA || c.id === idB ? { ...c, justMatched: false } : c));
        }, 200);
      }, MATCH_FLASH_MS);
    } else {
      if (badTimeoutRef.current) clearTimeout(badTimeoutRef.current);
      setBadId(id);
      setPanelShake(true);
      badTimeoutRef.current = setTimeout(() => { setBadId(null); setPanelShake(false); }, 380);
      setSelectedId(id);
    }
  }, [cells, selectedId, combo]);

  const handleAdd = useCallback(() => {
    if (addsLeft <= 0 || cells.length > MAX_CELLS) return;

    const alive = cells.filter(c => !c.crossed);
    if (alive.length === 0) return;
    setCells(prev => [...prev, ...alive.map(c => ({ ...c, id: Math.random().toString(36).slice(2, 11), justMatched: false }))]);
    setAddsLeft(a => a - 1);
    setSelectedId(null);
  }, [cells, addsLeft]);

  const level = LEVEL_META[levelIdx] ?? LEVEL_META[0]!;

  const cellElements = useMemo(() =>
    cells.map((cell) => (
      <GameCell
        key={cell.id}
        cell={cell}
        isSelected={!cell.crossed && selectedId === cell.id}
        isBadTarget={badId === cell.id}
        onClick={() => handleCellClick(cell.id)}
      />
    )),
    [cells, selectedId, badId, handleCellClick],
  );

  return (
    <>
      <AnimatePresence>
        {showHelp && <HelpScreen onClose={() => setShowHelp(false)} />}
      </AnimatePresence>

      <div className="absolute inset-0 flex items-center justify-center z-[50] pointer-events-none p-4">
        <motion.div
          className="pointer-events-auto w-full max-w-md md:max-w-lg relative"
          animate={panelShake ? { x: [-7, 7, -5, 5, -3, 3, 0] } : { x: 0 }}
          transition={{ duration: 0.38, ease: 'easeOut' }}
        >
          <div
            className="rounded-[2.75rem] p-6 sm:p-9 flex flex-col items-center gap-4 relative overflow-hidden"
            style={{
              // Не плоский белый, а мягкий градиент в тёплый крем — даёт объём.
              background: 'linear-gradient(180deg, #ffffff 0%, #FDF6EC 100%)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              // Глубокая амбиентная тень в фирменный зелёный + верхний блик и
              // нижнее внутреннее свечение — карточка «приподнимается» над фоном.
              boxShadow: combo >= 2
                ? '0 44px 96px -24px rgba(28,63,53,0.50), 0 0 50px rgba(255,122,0,0.35), inset 0 2px 0 rgba(255,255,255,1), inset 0 -26px 48px -28px rgba(255,122,0,0.20)'
                : '0 44px 96px -24px rgba(28,63,53,0.50), inset 0 2px 0 rgba(255,255,255,1), inset 0 -26px 48px -28px rgba(28,63,53,0.12)',
              transition: 'box-shadow 0.4s ease',
            }}
          >
            <button
              onClick={() => setShowHelp(true)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold hover:bg-slate-200 hover:text-slate-800 transition-colors z-20 outline-none"
            >
              ?
            </button>
            <button
              onClick={restartLevel}
              title="Начать уровень заново"
              className="absolute top-5 right-14 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold hover:bg-slate-200 hover:text-slate-800 transition-colors z-20 outline-none"
            >
              ↺
            </button>

            <div className="text-center mt-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-orange-500">
                {level.label}
              </p>
              <p className="text-[9px] font-mono text-slate-400 mt-1 tracking-wider">
                {level.hint}
              </p>
            </div>

            <div className="flex items-center gap-6 mt-1 mb-1">
              <div className="text-center">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Осталось</p>
                <p className="text-lg font-black text-slate-800 leading-none">{remaining}</p>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div className="text-center relative">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Очки</p>
                <motion.p
                  key={score}
                  initial={{ scale: 1.35, color: '#FF7A00' }}
                  animate={{ scale: 1, color: '#1e293b' }}
                  transition={{ duration: 0.35 }}
                  className="text-lg font-black leading-none"
                >
                  {score}
                </motion.p>
                {lastGain && (
                  <motion.span
                    key={lastGain.key}
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: -18 }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-black text-orange-500 pointer-events-none"
                  >
                    +{lastGain.amount}
                  </motion.span>
                )}
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div className="text-center">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Уровень</p>
                <p className="text-lg font-black text-orange-500 leading-none">
                  {levelIdx + 1} / {LEVEL_META.length}
                </p>
              </div>
            </div>

            <AnimatePresence>
              {combo >= 2 && !isWon && (
                <motion.div
                  key="combo-bar"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="w-full flex items-center gap-2 px-2"
                >
                  <span className="text-[9px] font-mono font-black text-orange-500 tracking-widest whitespace-nowrap">
                    СЕРИЯ ×{combo}
                  </span>
                  <div className="flex-1 h-1 rounded-full bg-orange-100 overflow-hidden">
                    <motion.div
                      key={combo}
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(to right, #FF7A00, #FFB020)' }}
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: COMBO_WINDOW_MS / 1000, ease: 'linear' }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isWon ? (
                <WinScreen key="win" levelIdx={levelIdx} score={score} onNext={goNextLevel} />
              ) : (
                <motion.div
                  key={`board-${levelIdx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22 }}
                  className="w-full flex flex-col gap-4"
                >
                  <div className="w-full max-h-[46vh] overflow-y-auto scrollbar-none pr-1">
                    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                      {cellElements}
                    </div>
                  </div>

                  <motion.button
                    onClick={handleAdd}
                    disabled={addsLeft <= 0 || cells.length > MAX_CELLS}
                    whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(255,130,0,0.3)' }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-3.5 mt-2 rounded-xl text-white font-bold uppercase tracking-widest text-xs outline-none disabled:opacity-50 disabled:grayscale"
                    style={{ background: 'linear-gradient(135deg, rgba(255,122,0,0.9), rgba(255,175,20,0.9))' }}
                  >
                    {addsLeft > 0 ? `+ Добавить цифры · осталось ${addsLeft}` : 'Добавления исчерпаны'}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
}

export function PacificRide({ onClose }: PacificRideProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isFading = useRef(false);

  const doFadeOut = useCallback(() => {
    if (isFading.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    isFading.current = true;
    const step = () => {
      if (audio.volume > 0.05) {
        audio.volume = Math.max(0, audio.volume - 0.05);
        setTimeout(step, 50);
      } else {
        audio.pause();
        audio.volume = 1;
        isFading.current = false;
      }
    };
    step();
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        console.warn("PacificRide: Audio autoplay blocked by browser policy.");
      });
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { doFadeOut(); onClose(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      doFadeOut();
    };
  }, [onClose, doFadeOut]);

  return (
    <motion.div
      className="fixed inset-0 z-[999] overflow-hidden cursor-crosshair"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.4 }}
    >
      <audio ref={audioRef} id="pacific-audio" src="/sf-ambient.mp3" loop />

      <SunsetBackground />
      <NumberMatchGame />

      <button
        onClick={() => { doFadeOut(); onClose(); }}
        className="absolute top-6 right-6 z-[1001] font-mono text-xs px-4 py-2 rounded-full
                   transition-all duration-200 hover:bg-white/10 outline-none"
        style={{
          color: 'rgba(255,255,255,0.88)',
          border: '1px solid rgba(255,255,255,0.42)',
          letterSpacing: '0.15em',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        ESC
      </button>
    </motion.div>
  );
}