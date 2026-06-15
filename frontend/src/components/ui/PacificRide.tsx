/**
 * PacificRide.tsx — "The Pacific Ride" · California Sunset Edition · Juice Pass
 *
 * Cinematic easter egg for Citrine Vault.
 * Features:
 *   1. California Organic Luxury sunset background (stars + drifting clouds → sky → sun → ocean)
 *   2. Number Match / Семечки — 3 levels, zero-bug adjacency engine
 *   3. "Juice" game feel: match flash, strikethrough animation, cell shake, win ripples
 *   4. Audio with ESC fade-out
 *
 * Stack: React 19 + Framer Motion 12 + Tailwind CSS 3
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PacificRideProps {
  onClose: () => void;
}

// ─── CONSTANTS ────────────────────────────────────────────────────
const COLS = 9;

// ─── LEVEL DATA ───────────────────────────────────────────────────
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

// ─── TYPES ────────────────────────────────────────────────────────
type Cell = {
  id: string;
  value: number;
  crossed: boolean;
  /** Briefly true right after a match — drives the flash→strikethrough→vanish sequence */
  justMatched: boolean;
};

// ─── STATIC SCENE DATA (pre-computed, zero re-render cost) ────────
const STARS = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  size: Math.random() * 1.8 + 0.4,
  top: Math.random() * 46,
  left: Math.random() * 100,
  opacity: Math.random() * 0.55 + 0.2,
  dur: 2.5 + Math.random() * 3.5,
  delay: Math.random() * 5,
}));

const CLOUDS = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  top: 8 + Math.random() * 28,       // stay in the sky (top 36%)
  width: 120 + Math.random() * 180,
  opacity: 0.04 + Math.random() * 0.07,
  dur: 55 + Math.random() * 50,       // very slow drift
  startX: -20 - Math.random() * 40,  // start off-screen left
}));

// Gold ripple config for win screen
const RIPPLES = [0, 1, 2, 3, 4];

// ─── ADJACENCY ENGINE ─────────────────────────────────────────────
function canMatch(cells: Cell[], i: number, j: number): boolean {
  if (i === j) return false;
  const ci = cells[i];
  const cj = cells[j];
  if (!ci || !cj || ci.crossed || cj.crossed) return false;
  if (ci.value !== cj.value && ci.value + cj.value !== 10) return false;

  const a = Math.min(i, j);
  const b = Math.max(i, j);

  // 1. Linear (horizontal + wrap-around)
  {
    let clear = true;
    for (let k = a + 1; k < b; k++) {
      if (!cells[k]?.crossed) { clear = false; break; }
    }
    if (clear) return true;
  }

  const ra = Math.floor(a / COLS), ca = a % COLS;
  const rb = Math.floor(b / COLS), cb = b % COLS;

  // 2. Vertical
  if (ca === cb) {
    let clear = true;
    for (let r = ra + 1; r < rb; r++) {
      const idx = r * COLS + ca;
      if (idx < cells.length && !cells[idx]?.crossed) { clear = false; break; }
    }
    if (clear) return true;
  }

  // 3. Diagonal
  const dr = rb - ra;
  const dc = Math.abs(cb - ca);
  if (dr > 0 && dr === dc) {
    const colStep = cb > ca ? 1 : -1;
    let clear = true;
    for (let step = 1; step < dr; step++) {
      const idx = (ra + step) * COLS + (ca + step * colStep);
      if (idx >= 0 && idx < cells.length && !cells[idx]?.crossed) {
        clear = false;
        break;
      }
    }
    if (clear) return true;
  }

  return false;
}

function makeGrid(values: readonly number[]): Cell[] {
  return values.map(v => ({
    id: Math.random().toString(36).slice(2, 11),
    value: v,
    crossed: false,
    justMatched: false,
  }));
}

// ─── BACKGROUND SCENE ─────────────────────────────────────────────
function SunsetBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Sky gradient — smooth 9-stop sunset */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, ' +
            '#080118 0%, #130428 12%, #2a0e44 24%, ' +
            '#56206a 38%, #8b3578 50%, ' +
            '#c45540 62%, #e47c36 74%, ' +
            '#f3a040 84%, #ffd078 92%, #ffeaa5 100%)',
        }}
      />

      {/* Stars */}
      {STARS.map(s => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{ width: s.size, height: s.size, top: `${s.top}%`, left: `${s.left}%` }}
          animate={{ opacity: [s.opacity * 0.35, s.opacity, s.opacity * 0.35] }}
          transition={{ duration: s.dur, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
        />
      ))}

      {/* Drifting cloud wisps */}
      {CLOUDS.map(c => (
        <motion.div
          key={c.id}
          className="absolute rounded-full"
          style={{
            top: `${c.top}%`,
            width: c.width,
            height: c.width * 0.28,
            background: 'rgba(255,220,200,1)',
            opacity: c.opacity,
            filter: 'blur(22px)',
            left: `${c.startX}%`,
          }}
          animate={{ x: ['0%', '130vw'] }}
          transition={{ duration: c.dur, repeat: Infinity, ease: 'linear', delay: c.id * 9 }}
        />
      ))}

      {/* Sun halo bloom */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 380, height: 380,
          bottom: 'calc(27% - 90px)',
          left: '50%', transform: 'translateX(-50%)',
          background:
            'radial-gradient(circle, rgba(255,200,80,0.2) 0%, rgba(255,120,20,0.1) 45%, transparent 70%)',
          filter: 'blur(38px)',
        }}
        animate={{ scale: [1, 1.09, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Sun core */}
      <div className="absolute" style={{ bottom: '27%', left: '50%', transform: 'translateX(-50%)' }}>
        <motion.div
          className="rounded-full"
          style={{
            width: 140, height: 140,
            background:
              'radial-gradient(circle, #fff8dc 0%, #ffd700 18%, #ff9500 48%, #ff5200 78%, rgba(255,50,0,0) 100%)',
            boxShadow:
              '0 0 55px 18px rgba(255,160,30,0.55), 0 0 110px 45px rgba(255,90,0,0.25), 0 0 180px 70px rgba(255,50,0,0.1)',
            filter: 'blur(0.6px)',
          }}
          animate={{ scale: [1, 1.035, 1], opacity: [0.93, 1, 0.93] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Horizon radiance */}
      <div
        className="absolute"
        style={{
          bottom: '25%', left: '50%', transform: 'translateX(-50%)',
          width: '135%', height: 65,
          background:
            'radial-gradient(ellipse, rgba(255,175,65,0.48) 0%, rgba(255,85,0,0.12) 45%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* Ocean */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '28%',
          background: 'linear-gradient(to bottom, rgba(22,6,55,0.87) 0%, rgba(6,2,25,0.97) 100%)',
          borderTop: '1px solid rgba(255,195,95,0.22)',
        }}
      />

      {/* Sun reflection pillar */}
      <div
        className="absolute"
        style={{
          bottom: '2%', left: '50%', transform: 'translateX(-50%)',
          width: 90, height: '23%',
          background:
            'linear-gradient(to bottom, rgba(255,175,65,0.5) 0%, rgba(255,120,30,0.14) 55%, transparent 100%)',
          filter: 'blur(10px)',
        }}
      />

      {/* Ocean shimmer lines */}
      {[9, 14, 18, 22].map((pct, i) => (
        <motion.div
          key={i}
          className="absolute left-0 right-0"
          style={{
            bottom: `${pct}%`, height: 1,
            background:
              'linear-gradient(to right, transparent 5%, rgba(255,195,95,0.22) 22%, rgba(255,225,120,0.62) 50%, rgba(255,195,95,0.22) 78%, transparent 95%)',
          }}
          animate={{ scaleX: [0.82, 1.1, 0.82], opacity: [0.22, 0.62, 0.22] }}
          transition={{ duration: 3.8 + i * 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.75 }}
        />
      ))}
    </div>
  );
}

// ─── WIN SCREEN — staggered text + gold ripple rings ──────────────
function WinScreen({ levelIdx, onNext }: { levelIdx: number; onNext: () => void }) {
  const isLast = levelIdx >= LEVELS.length - 1;

  const textVariants = {
    hidden: { opacity: 0, y: 18 },
    show: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.15, duration: 0.45, ease: 'easeOut' as const },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.72 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="flex flex-col items-center gap-5 py-8 px-4 text-center relative overflow-hidden"
    >
      {/* Gold ripple rings */}
      {RIPPLES.map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-amber-400/30 pointer-events-none"
          style={{ width: 60, height: 60, top: '18%', left: '50%', x: '-50%', y: '-50%' }}
          initial={{ scale: 0.5, opacity: 0.7 }}
          animate={{ scale: 4 + i * 1.5, opacity: 0 }}
          transition={{
            duration: 2.2,
            delay: i * 0.32,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Emoji */}
      <motion.span
        className="text-5xl relative z-10"
        animate={{ rotate: [0, 14, -14, 9, -9, 0], scale: [1, 1.18, 1] }}
        transition={{ duration: 1.3, repeat: 2 }}
      >
        🌅
      </motion.span>

      {/* Staggered headline */}
      <div className="relative z-10">
        <motion.p
          custom={0}
          variants={textVariants}
          initial="hidden"
          animate="show"
          className="text-xl font-black text-amber-300 leading-tight"
          style={{ textShadow: '0 0 20px rgba(255,195,60,0.75)' }}
        >
          {isLast ? 'СИСТЕМА ДЕКРИПТОВАНА' : 'УРОВЕНЬ ПРОЙДЕН!'}
        </motion.p>
        <motion.p
          custom={1}
          variants={textVariants}
          initial="hidden"
          animate="show"
          className="text-[10px] font-mono text-white/40 mt-2 uppercase tracking-widest"
        >
          {isLast
            ? 'Вы — хранитель калифорнийского заката'
            : `Готов к уровню ${levelIdx + 2}?`}
        </motion.p>
      </div>

      {!isLast && (
        <motion.button
          custom={2}
          variants={textVariants}
          initial="hidden"
          animate="show"
          onClick={onNext}
          whileHover={{ scale: 1.06, boxShadow: '0 0 36px rgba(255,145,0,0.65)' }}
          whileTap={{ scale: 0.94 }}
          className="relative z-10 px-8 py-3 rounded-2xl text-white font-bold uppercase tracking-widest text-xs"
          style={{
            background: 'linear-gradient(135deg, #FF7A00, #FFB020)',
            boxShadow: '0 0 26px rgba(255,145,0,0.45)',
          }}
        >
          Следующий уровень →
        </motion.button>
      )}
    </motion.div>
  );
}

// ─── CELL COMPONENT — isolated to prevent full-grid re-renders ─────
interface CellProps {
  cell: Cell;
  isSelected: boolean;
  isBadTarget: boolean;    // briefly true when user clicks a cell that doesn't match
  onClick: () => void;
}

const GameCell = ({ cell, isSelected, isBadTarget, onClick }: CellProps) => {
  // Three-phase animation for matched cells:
  //   Phase 1 (justMatched=true, crossed=false) — orange flash + scale-up
  //   Phase 2 (justMatched=true, crossed=true)  — strikethrough visible, fading out
  //   Phase 3 (justMatched=false, crossed=true) — gone (scale 0, opacity 0)
  const matchFlash   = cell.justMatched && !cell.crossed;
  const matchVanish  = cell.justMatched && cell.crossed;

  return (
    <motion.button
      onClick={onClick}
      disabled={cell.crossed && !cell.justMatched}
      initial={false}
      animate={{
        scale:   cell.crossed && !cell.justMatched ? 0
               : matchFlash  ? 1.22
               : isSelected  ? 1.13
               : 1,
        opacity: cell.crossed && !cell.justMatched ? 0
               : matchVanish ? 0.15
               : 1,
      }}
      transition={{
        duration: matchFlash || matchVanish ? 0.22 : 0.17,
        type: 'spring',
        stiffness: matchFlash ? 600 : 480,
        damping: 28,
      }}
      // Bad-target shake — only this cell wiggles
      style={{
        cursor: cell.crossed ? 'default' : 'pointer',
        pointerEvents: (cell.crossed && !cell.justMatched) ? 'none' : 'auto',
        color: matchFlash     ? '#FF7A00'
             : isSelected     ? '#FF7A00'
             : 'rgba(255,255,255,0.88)',
        background: matchFlash || matchVanish
          ? 'rgba(255,122,0,0.28)'
          : isSelected
          ? 'rgba(255,122,0,0.18)'
          : isBadTarget
          ? 'rgba(255,80,80,0.18)'
          : 'rgba(255,255,255,0.06)',
        outline: matchFlash
          ? '1.5px solid rgba(255,122,0,0.9)'
          : isSelected
          ? '1.5px solid rgba(255,122,0,0.65)'
          : isBadTarget
          ? '1.5px solid rgba(255,80,80,0.55)'
          : '1px solid rgba(255,255,255,0.08)',
        boxShadow: matchFlash
          ? '0 0 18px rgba(255,122,0,0.7), inset 0 0 10px rgba(255,122,0,0.2)'
          : isSelected
          ? '0 0 14px rgba(255,122,0,0.5), inset 0 0 8px rgba(255,122,0,0.12)'
          : 'none',
        textShadow: (matchFlash || isSelected)
          ? '0 0 10px rgba(255,122,0,0.9)'
          : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
      className="aspect-square flex items-center justify-center rounded-lg
                 text-base font-black font-mono select-none"
    >
      {/* Digit */}
      {cell.crossed && !cell.justMatched ? null : cell.value}

      {/* Strikethrough bar — animates in during justMatched phase */}
      <AnimatePresence>
        {cell.justMatched && (
          <motion.span
            key="strike"
            className="absolute inset-x-[10%] rounded-full pointer-events-none"
            style={{
              top: '50%', height: 2,
              background: 'linear-gradient(to right, transparent, #FF7A00, transparent)',
              transformOrigin: 'left center',
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// ─── GAME BOARD ───────────────────────────────────────────────────
const MATCH_FLASH_MS = 280; // how long justMatched stays true before vanishing

function NumberMatchGame() {
  const [levelIdx, setLevelIdx]       = useState(0);
  const [cells, setCells]             = useState<Cell[]>(() => makeGrid(LEVELS[0].grid));
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [badIdx, setBadIdx]           = useState<number | null>(null);  // cell that couldn't match
  const [panelShake, setPanelShake]   = useState(false);

  const isWon    = useMemo(() => cells.length > 0 && cells.every(c => c.crossed), [cells]);
  const remaining = useMemo(() => cells.filter(c => !c.crossed).length, [cells]);

  const goNextLevel = useCallback(() => {
    const next = levelIdx + 1;
    if (next < LEVELS.length) {
      setLevelIdx(next);
      setCells(makeGrid(LEVELS[next]!.grid));
      setSelectedIdx(null);
    }
  }, [levelIdx]);

  const handleCellClick = useCallback(
    (idx: number) => {
      if (cells[idx]?.crossed) return;

      if (selectedIdx === null) {
        setSelectedIdx(idx);
        return;
      }
      if (selectedIdx === idx) {
        setSelectedIdx(null);
        return;
      }

      if (canMatch(cells, selectedIdx, idx)) {
        // ── Phase 1: mark justMatched on both cells ──────────────────
        const matchedA = selectedIdx;
        const matchedB = idx;
        setCells(prev =>
          prev.map((c, i) =>
            i === matchedA || i === matchedB ? { ...c, justMatched: true } : c,
          ),
        );
        setSelectedIdx(null);

        // ── Phase 2: after flash delay, mark crossed ─────────────────
        setTimeout(() => {
          setCells(prev =>
            prev.map((c, i) =>
              i === matchedA || i === matchedB ? { ...c, crossed: true } : c,
            ),
          );
          // ── Phase 3: clear justMatched flag ──────────────────────
          setTimeout(() => {
            setCells(prev =>
              prev.map((c, i) =>
                i === matchedA || i === matchedB ? { ...c, justMatched: false } : c,
              ),
            );
          }, 200);
        }, MATCH_FLASH_MS);

      } else {
        // ── No match: shake the bad cell + panel, move selection ─────
        setBadIdx(idx);
        setPanelShake(true);
        setTimeout(() => { setBadIdx(null); setPanelShake(false); }, 380);
        setSelectedIdx(idx);
      }
    },
    [cells, selectedIdx],
  );

  const handleAdd = useCallback(() => {
    const alive = cells.filter(c => !c.crossed);
    if (alive.length === 0) return;
    setCells(prev => [
      ...prev,
      ...alive.map(c => ({ ...c, id: Math.random().toString(36).slice(2, 11), justMatched: false })),
    ]);
    setSelectedIdx(null);
  }, [cells]);

  const level = LEVELS[levelIdx] ?? LEVELS[0]!;

  // Memoize rendered cell list to avoid re-creating on every selectedIdx change
  const cellElements = useMemo(() =>
    cells.map((cell, idx) => (
      <GameCell
        key={cell.id}
        cell={cell}
        isSelected={!cell.crossed && selectedIdx === idx}
        isBadTarget={badIdx === idx}
        onClick={() => handleCellClick(idx)}
      />
    )),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cells, selectedIdx, badIdx],
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center z-[50] pointer-events-none p-4">
      {/* Panel shake on mismatch */}
      <motion.div
        className="pointer-events-auto w-full max-w-sm md:max-w-md"
        animate={panelShake ? { x: [-7, 7, -5, 5, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
      >
        {/* Glass panel */}
        <div
          className="rounded-[2rem] p-6 flex flex-col items-center gap-4 relative"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 32px 72px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
        >
          {/* Specular top edge */}
          <div
            className="absolute top-0 inset-x-0 h-px rounded-t-[2rem]"
            style={{
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.35), transparent)',
            }}
          />

          {/* Header */}
          <div className="text-center">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-amber-300/90">
              {level.label}
            </p>
            <p className="text-[9px] font-mono text-white/35 mt-0.5 tracking-wider">
              {level.hint}
            </p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5">
            <div className="text-center">
              <p className="text-[9px] font-mono uppercase tracking-wider text-white/35">Осталось</p>
              <p className="text-lg font-black text-white leading-none">{remaining}</p>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div className="text-center">
              <p className="text-[9px] font-mono uppercase tracking-wider text-white/35">Уровень</p>
              <p className="text-lg font-black text-amber-300 leading-none">
                {levelIdx + 1} / {LEVELS.length}
              </p>
            </div>
          </div>

          {/* AnimatePresence: win → board transition */}
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
                className="w-full flex flex-col gap-3"
              >
                {/* Cell grid */}
                <div className="w-full max-h-[42vh] overflow-y-auto scrollbar-none">
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
                  >
                    {cellElements}
                  </div>
                </div>

                {/* Add button */}
                <motion.button
                  onClick={handleAdd}
                  whileHover={{ scale: 1.02, boxShadow: '0 0 32px rgba(255,130,0,0.5)' }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-3 rounded-xl text-white font-bold uppercase tracking-widest text-xs"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,122,0,0.85), rgba(255,175,20,0.85))',
                    boxShadow: '0 0 22px rgba(255,130,0,0.28)',
                  }}
                >
                  + Добавить цифры
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────
export function PacificRide({ onClose }: PacificRideProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const doFadeOut = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const step = () => {
      if (audio.volume > 0.05) {
        audio.volume = Math.max(0, audio.volume - 0.05);
        setTimeout(step, 50);
      } else {
        audio.pause();
        audio.volume = 1;
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
          color: 'rgba(255,255,255,0.38)',
          border: '1px solid rgba(255,255,255,0.12)',
          letterSpacing: '0.15em',
          textShadow: '1px 0 0 rgba(255,60,60,0.45), -1px 0 0 rgba(0,200,220,0.45)',
        }}
      >
        ESC
      </button>
    </motion.div>
  );
}