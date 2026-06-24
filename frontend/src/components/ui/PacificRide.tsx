/**
 * PacificRide.tsx — "The Pacific Ride" · California Sunset Edition · Juice Pass
 *
 * Cinematic easter egg for Citrine Vault.
 * Features:
 *   1. California Organic Luxury sunset background
 *   2. Number Match / Семечки — 3 levels, zero-bug adjacency engine
 *   3. "Juice" game feel: match flash, strikethrough animation, cell shake, win ripples
 *   4. Premium Light Mode Panel & Interactive Tutorial
 *
 * Stack: React 19 + Framer Motion 12 + Tailwind CSS 3
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PacificRideProps {
  onClose: () => void;
}

const COLS = 9;

const LEVELS = [
  {
    label: 'УРОВЕНЬ 1 · ОБУЧЕНИЕ',
    hint: 'Одинаковые или в сумме 10 — пустые ячейки пропускаются',
    grid: [
      1, 2, 3, 4, 5, 6, 7, 8, 9,
      1, 1, 1, 2, 1, 3, 1, 4, 1,
    ],
  },
  {
    label: 'УРОВЕНЬ 2 · КЛАССИКА',
    hint: 'По горизонтали, вертикали и диагонали',
    grid: [
      1, 2, 3, 4, 5, 6, 7, 8, 9,
      1, 1, 1, 2, 1, 3, 1, 4, 1,
      5, 1, 6, 1, 7, 1, 8, 1, 9,
    ],
  },
  {
    label: 'УРОВЕНЬ 3 · МАСТЕР',
    hint: 'Думай наперёд — не все пары на поверхности',
    grid: [
      3, 5, 4, 6, 2, 8, 1, 9, 7,
      5, 5, 6, 7, 4, 8, 3, 2, 1,
      2, 8, 3, 7, 6, 4, 9, 1, 5,
      4, 6, 5, 5, 8, 2, 7, 3, 9,
    ],
  },
] as const;

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

function canMatch(cells: Cell[], i: number, j: number): boolean {
  if (i === j) return false;
  const ci = cells[i];
  const cj = cells[j];
  if (!ci || !cj || ci.crossed || cj.crossed) return false;
  if (ci.value !== cj.value && ci.value + cj.value !== 10) return false;

  const a = Math.min(i, j);
  const b = Math.max(i, j);

  let linearClear = true;
  for (let k = a + 1; k < b; k++) {
    if (!cells[k]?.crossed) { linearClear = false; break; }
  }
  if (linearClear) return true;

  const ra = Math.floor(a / COLS), ca = a % COLS;
  const rb = Math.floor(b / COLS), cb = b % COLS;

  if (ca === cb) {
    let vertClear = true;
    for (let r = ra + 1; r < rb; r++) {
      const idx = r * COLS + ca;
      if (idx < cells.length && !cells[idx]?.crossed) { vertClear = false; break; }
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
      if (!cells[idx]?.crossed) { diagClear = false; break; }
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

function SunsetBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, #080118 0%, #130428 12%, #2a0e44 24%, #56206a 38%, #8b3578 50%, #c45540 62%, #e47c36 74%, #f3a040 84%, #ffd078 92%, #ffeaa5 100%)' }} />
      {STARS.map(s => <motion.div key={s.id} className="absolute rounded-full bg-white" style={{ width: s.size, height: s.size, top: `${s.top}%`, left: `${s.left}%` }} animate={{ opacity: [s.opacity * 0.35, s.opacity, s.opacity * 0.35] }} transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }} />)}
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
          className="w-full py-3.5 bg-slate-800 text-white rounded-xl font-bold uppercase tracking-widest text-xs"
        >
          ПОНЯТНО
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function WinScreen({ levelIdx, onNext }: { levelIdx: number; onNext: () => void }) {
  const isLast = levelIdx >= LEVELS.length - 1;
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
      </div>
      {!isLast && (
        <motion.button
          custom={2} variants={textVariants} initial="hidden" animate="show" onClick={onNext}
          whileHover={{ scale: 1.06, boxShadow: '0 0 20px rgba(255,145,0,0.3)' }} whileTap={{ scale: 0.94 }}
          className="relative z-10 px-8 py-3 rounded-2xl text-white font-bold uppercase tracking-widest text-xs"
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
      className="aspect-square flex items-center justify-center rounded-lg text-base font-black font-mono select-none"
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
  const [cells, setCells]             = useState<Cell[]>(() => makeGrid(LEVELS[0].grid));
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [badIdx, setBadIdx]           = useState<number | null>(null);
  const [panelShake, setPanelShake]   = useState(false);
  const [showHelp, setShowHelp]       = useState(false);
  const badTimeoutRef                 = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (badTimeoutRef.current) clearTimeout(badTimeoutRef.current);
    };
  }, []);

  const isWon = useMemo(() => cells.length > 0 && cells.every(c => c.crossed), [cells]);
  const remaining = useMemo(() => cells.filter(c => !c.crossed).length, [cells]);

  const goNextLevel = useCallback(() => {
    const next = levelIdx + 1;
    if (next < LEVELS.length) {
      setLevelIdx(next);
      setCells(makeGrid(LEVELS[next]!.grid));
      setSelectedIdx(null);
      setBadIdx(null);
      setPanelShake(false);
    }
  }, [levelIdx]);

  const handleCellClick = useCallback((idx: number) => {
    if (cells[idx]?.crossed) return;
    if (selectedIdx === null) { setSelectedIdx(idx); return; }
    if (selectedIdx === idx) { setSelectedIdx(null); return; }

    if (canMatch(cells, selectedIdx, idx)) {
      const idA = cells[selectedIdx]!.id;
      const idB = cells[idx]!.id;

      setCells(prev => prev.map(c => c.id === idA || c.id === idB ? { ...c, justMatched: true } : c));
      setSelectedIdx(null);

      setTimeout(() => {
        setCells(prev => prev.map(c => c.id === idA || c.id === idB ? { ...c, crossed: true } : c));
        setTimeout(() => {
          setCells(prev => prev.map(c => c.id === idA || c.id === idB ? { ...c, justMatched: false } : c));
        }, 200);
      }, MATCH_FLASH_MS);
    } else {
      if (badTimeoutRef.current) clearTimeout(badTimeoutRef.current);
      setBadIdx(idx);
      setPanelShake(true);
      badTimeoutRef.current = setTimeout(() => { setBadIdx(null); setPanelShake(false); }, 380);
      setSelectedIdx(idx);
    }
  }, [cells, selectedIdx]);

  const handleAdd = useCallback(() => {
    const alive = cells.filter(c => !c.crossed);
    if (alive.length === 0) return;
    setCells(prev => [...prev, ...alive.map(c => ({ ...c, id: Math.random().toString(36).slice(2, 11), justMatched: false }))]);
    setSelectedIdx(null);
  }, [cells]);

  const level = LEVELS[levelIdx] ?? LEVELS[0]!;

  const cellElements = useMemo(() =>
    cells.map((cell, idx) => (
      <GameCell key={cell.id} cell={cell} isSelected={!cell.crossed && selectedIdx === idx} isBadTarget={badIdx === idx} onClick={() => handleCellClick(idx)} />
    )),
    [cells, selectedIdx, badIdx, handleCellClick],
  );

  return (
    <>
      <AnimatePresence>
        {showHelp && <HelpScreen onClose={() => setShowHelp(false)} />}
      </AnimatePresence>

      <div className="absolute inset-0 flex items-center justify-center z-[50] pointer-events-none p-4">
        <motion.div
          className="pointer-events-auto w-full max-w-sm md:max-w-md relative"
          animate={panelShake ? { x: [-7, 7, -5, 5, -3, 3, 0] } : { x: 0 }}
          transition={{ duration: 0.38, ease: 'easeOut' }}
        >
          <div
            className="rounded-[2.5rem] p-6 sm:p-8 flex flex-col items-center gap-4 relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              boxShadow: '0 32px 72px rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,1)',
            }}
          >
            <button
              onClick={() => setShowHelp(true)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold hover:bg-slate-200 hover:text-slate-800 transition-colors z-20"
            >
              ?
            </button>

            <div className="text-center mt-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-orange-500">
                {level.label}
              </p>
              <p className="text-[9px] font-mono text-slate-400 mt-1 tracking-wider">
                {level.hint}
              </p>
            </div>

            <div className="flex items-center gap-6 mt-1 mb-2">
              <div className="text-center">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Осталось</p>
                <p className="text-lg font-black text-slate-800 leading-none">{remaining}</p>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div className="text-center">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Уровень</p>
                <p className="text-lg font-black text-orange-500 leading-none">
                  {levelIdx + 1} / {LEVELS.length}
                </p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isWon ? (
                <WinScreen key="win" levelIdx={levelIdx} onNext={goNextLevel} />
              ) : (
                <motion.div
                  key={`board-${levelIdx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22 }}
                  className="w-full flex flex-col gap-4"
                >
                  <div className="w-full max-h-[40vh] overflow-y-auto scrollbar-none pr-1">
                    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                      {cellElements}
                    </div>
                  </div>

                  <motion.button
                    onClick={handleAdd}
                    whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(255,130,0,0.3)' }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full py-3.5 mt-2 rounded-xl text-white font-bold uppercase tracking-widest text-xs"
                    style={{ background: 'linear-gradient(135deg, rgba(255,122,0,0.9), rgba(255,175,20,0.9))' }}
                  >
                    + Добавить цифры
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
      <audio ref={audioRef} id="pacific-audio" src="/sf-ambient.mp3" autoPlay loop />

      <SunsetBackground />
      <NumberMatchGame />

      <button
        onClick={() => { doFadeOut(); onClose(); }}
        className="absolute top-6 right-6 z-[1001] font-mono text-xs px-4 py-2 rounded-full
                   transition-all duration-200 hover:bg-white/10"
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