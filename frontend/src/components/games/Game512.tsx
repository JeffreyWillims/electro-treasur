import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { getBest, submitScore } from '@/lib/gameRecords';
import { SunsetBackground } from '@/components/ui/PacificRide';

/**
 * «Купюра 512 ₽» — 2048-механика в финансовой теме Citrine Vault.
 * Плитки — номиналы рублей: 1 ₽ → 2 ₽ → … → 512 ₽. Собери купюру!
 * Управление: стрелки / WASD / свайпы.
 *
 * Поле хранится как список плиток с устойчивым id и позицией (r, c) — это даёт
 * настоящее скольжение и слияние (framer-motion анимирует transform), а не «всплытие».
 */

const SIZE = 4;
const GOAL = 512;
const SLIDE_MS = 130;

type Dir = 'left' | 'right' | 'up' | 'down';
type Tile = { id: number; value: number; r: number; c: number; merged?: boolean; isNew?: boolean };

const TILE_STYLE: Record<number, string> = {
  1: 'bg-[#FDFBF7] text-[#1C3F35] dark:bg-white/10 dark:text-white/80',
  2: 'bg-[#F4EFE4] text-[#1C3F35] dark:bg-white/15 dark:text-white',
  4: 'bg-[#E7F0EA] text-[#1C3F35] dark:bg-emerald-900/40 dark:text-emerald-100',
  8: 'bg-[#CDE3D3] text-[#1C3F35] dark:bg-emerald-800/50 dark:text-emerald-50',
  16: 'bg-[#1C3F35]/80 text-white',
  32: 'bg-[#1C3F35] text-white',
  64: 'bg-[#FFB255] text-[#3A2100]',
  128: 'bg-[#FF9A2E] text-white',
  256: 'bg-[#FF7A00] text-white shadow-[0_0_18px_rgba(255,122,0,0.5)]',
  512: 'bg-gradient-to-br from-[#FF7A00] to-[#FFA011] text-white shadow-[0_0_28px_rgba(255,122,0,0.8)]',
};

// Устойчивые id плиток нужны только для реконсиляции React — важна лишь уникальность.
let TILE_ID = 1;
const nextId = () => TILE_ID++;

function spawn(occupied: Tile[]): Tile | null {
  const taken = new Set(occupied.map((t) => t.r * SIZE + t.c));
  const free: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (!taken.has(i)) free.push(i);
  const cell = free[Math.floor(Math.random() * free.length)];
  if (cell === undefined) return null;
  return {
    id: nextId(),
    value: Math.random() < 0.9 ? 1 : 2,
    r: Math.floor(cell / SIZE),
    c: cell % SIZE,
    isNew: true,
  };
}

function initialTiles(): Tile[] {
  const tiles: Tile[] = [];
  const a = spawn(tiles);
  if (a) tiles.push(a);
  const b = spawn(tiles);
  if (b) tiles.push(b);
  return tiles;
}

/** Порядок индексов клеток в одной линии — от края, к которому едут плитки. */
function lineIndices(dir: Dir, line: number): number[] {
  const idx: number[] = [];
  for (let k = 0; k < SIZE; k++) {
    if (dir === 'left') idx.push(line * SIZE + k);
    else if (dir === 'right') idx.push(line * SIZE + (SIZE - 1 - k));
    else if (dir === 'up') idx.push(k * SIZE + line);
    else idx.push((SIZE - 1 - k) * SIZE + line);
  }
  return idx;
}

type MoveResult = {
  moved: boolean;
  gained: number;
  slid: Tile[]; // фаза A: все исходные плитки в новых позициях (слитая пара накрывается)
  settled: Tile[]; // фаза B: итог без новой случайной плитки
};

function computeMove(tiles: Tile[], dir: Dir): MoveResult {
  const grid: (Tile | undefined)[] = Array(SIZE * SIZE).fill(undefined);
  for (const t of tiles) grid[t.r * SIZE + t.c] = t;

  const slid: Tile[] = [];
  const settled: Tile[] = [];
  let gained = 0;
  let moved = false;

  type Entry = { merge: false; tile: Tile } | { merge: true; value: number; a: Tile; b: Tile };

  for (let line = 0; line < SIZE; line++) {
    const idx = lineIndices(dir, line);
    const lineTiles = idx.map((i) => grid[i]).filter((t): t is Tile => !!t);

    const out: Entry[] = [];
    for (const t of lineTiles) {
      const last = out[out.length - 1];
      if (last && !last.merge && last.tile.value === t.value) {
        out[out.length - 1] = { merge: true, value: t.value * 2, a: last.tile, b: t };
      } else {
        out.push({ merge: false, tile: t });
      }
    }

    out.forEach((entry, slot) => {
      const cell = idx[slot] ?? 0;
      const r = Math.floor(cell / SIZE);
      const c = cell % SIZE;
      if (entry.merge) {
        gained += entry.value;
        moved = true;
        slid.push({ ...entry.a, r, c }, { ...entry.b, r, c });
        settled.push({ id: nextId(), value: entry.value, r, c, merged: true });
      } else {
        const t = entry.tile;
        if (t.r !== r || t.c !== c) moved = true;
        slid.push({ ...t, r, c, isNew: false });
        settled.push({ ...t, r, c, isNew: false, merged: false });
      }
    });
  }

  return { moved, gained, slid, settled };
}

function canMove(tiles: Tile[]): boolean {
  if (tiles.length < SIZE * SIZE) return true;
  const grid: number[] = Array(SIZE * SIZE).fill(0);
  for (const t of tiles) grid[t.r * SIZE + t.c] = t.value;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r * SIZE + c];
      if (c + 1 < SIZE && grid[r * SIZE + c + 1] === v) return true;
      if (r + 1 < SIZE && grid[(r + 1) * SIZE + c] === v) return true;
    }
  }
  return false;
}

export function Game512({ onClose }: { onClose: () => void }) {
  const [tiles, setTiles] = useState<Tile[]>(initialTiles);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => getBest('game512'));
  const [won, setWon] = useState(false);
  const [over, setOver] = useState(false);
  const [lastGain, setLastGain] = useState<{ amount: number; key: number } | null>(null);

  const tilesRef = useRef<Tile[]>(tiles); // логическое поле для расчёта хода (без промежуточной фазы)
  const animatingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const doMove = useCallback(
    (dir: Dir) => {
      if (over || animatingRef.current) return;
      const res = computeMove(tilesRef.current, dir);
      if (!res.moved) return;

      animatingRef.current = true;
      setTiles(res.slid);

      if (res.gained > 0) {
        setScore((s) => {
          const total = s + res.gained;
          if (submitScore('game512', total)) setBest(total);
          return total;
        });
        setLastGain({ amount: res.gained, key: Date.now() });
        navigator.vibrate?.(15);
      }

      timeoutRef.current = window.setTimeout(() => {
        const extra = spawn(res.settled);
        const final = extra ? [...res.settled, extra] : res.settled;
        tilesRef.current = final;
        setTiles(final);
        if (final.some((t) => t.value >= GOAL)) setWon(true);
        if (!canMove(final)) setOver(true);
        animatingRef.current = false;
      }, SLIDE_MS);
    },
    [over],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        w: 'up', s: 'down', a: 'left', d: 'right',
        ц: 'up', ы: 'down', ф: 'left', в: 'right',
      };
      if (e.key === 'Escape') onClose();
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        doMove(dir);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove, onClose]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const restart = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    animatingRef.current = false;
    const fresh = initialTiles();
    tilesRef.current = fresh;
    setTiles(fresh);
    setScore(0);
    setWon(false);
    setOver(false);
    setLastGain(null);
  };

  const maxValue = useMemo(() => tiles.reduce((m, t) => Math.max(m, t.value), 1), [tiles]);
  const progress = Math.min(1, Math.log2(maxValue) / Math.log2(GOAL));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) touchStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const t = e.changedTouches[0];
        if (!touchStart.current || !t) return;
        const dx = t.clientX - touchStart.current.x;
        const dy = t.clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      }}
    >
      {/* Единый фон Arcade — калифорнийский закат, как в «Десятке» */}
      <SunsetBackground />
      <div className="relative w-full max-w-md rounded-[2.5rem] bg-[#0A1A12]/80 backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-2xl">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-sans font-extrabold text-white tracking-tight">
              Купюра 512 ₽
            </h2>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
              Сливай номиналы · стрелки, WASD или свайпы
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть игру"
            className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Панель очков */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 rounded-2xl bg-white/10 px-4 py-2.5 text-center relative overflow-visible">
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-white/50">
              Капитал
            </p>
            <p className="text-lg font-sans font-extrabold text-white leading-tight">
              {score.toLocaleString('ru-RU')} ₽
            </p>
            <AnimatePresence>
              {lastGain && (
                <motion.span
                  key={lastGain.key}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -20 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  className="absolute top-1 right-3 text-xs font-black text-[#FFB255] pointer-events-none"
                >
                  +{lastGain.amount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 rounded-2xl bg-white/10 px-4 py-2.5 text-center">
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-white/50">
              Рекорд
            </p>
            <p className="text-lg font-sans font-extrabold text-white leading-tight">
              {best.toLocaleString('ru-RU')} ₽
            </p>
          </div>
          <button
            type="button"
            onClick={restart}
            aria-label="Новая игра"
            className="w-14 rounded-2xl bg-[#FF7A00] text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Прогресс к купюре 512 ₽ */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#FF7A00] to-[#FFA011]"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold text-white/50 tabular-nums whitespace-nowrap">
            макс {maxValue} ₽
          </span>
        </div>

        {/* Игровое поле */}
        <div className="relative rounded-[2rem] bg-white/5 border border-white/10 p-3 aspect-square select-none">
          {/* Пустые ячейки-подложка */}
          <div className="absolute inset-3 grid grid-cols-4 grid-rows-4">
            {Array.from({ length: SIZE * SIZE }, (_, i) => (
              <div key={i} className="p-1.5">
                <div className="w-full h-full rounded-xl bg-white/5" />
              </div>
            ))}
          </div>

          {/* Слой плиток — абсолютное позиционирование + скольжение через transform */}
          <div className="absolute inset-3">
            {tiles.map((t) => {
              const pop = t.isNew || t.merged;
              return (
                <motion.div
                  key={t.id}
                  className="absolute top-0 left-0 p-1.5"
                  style={{ width: '25%', height: '25%' }}
                  initial={pop ? { x: `${t.c * 100}%`, y: `${t.r * 100}%`, scale: 0 } : false}
                  animate={{ x: `${t.c * 100}%`, y: `${t.r * 100}%`, scale: 1 }}
                  transition={{
                    x: { duration: SLIDE_MS / 1000, ease: 'easeInOut' },
                    y: { duration: SLIDE_MS / 1000, ease: 'easeInOut' },
                    scale: pop
                      ? { type: 'spring', stiffness: 520, damping: 16 }
                      : { duration: 0.1 },
                  }}
                >
                  <div
                    className={`w-full h-full rounded-xl flex flex-col items-center justify-center font-sans font-extrabold ${TILE_STYLE[t.value] || TILE_STYLE[GOAL]}`}
                  >
                    <span className={t.value >= 128 ? 'text-2xl' : 'text-xl'}>{t.value}</span>
                    <span className="text-[9px] font-mono opacity-70 -mt-0.5">₽</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Оверлеи победы / поражения */}
          <AnimatePresence>
            {(won || over) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 rounded-[2rem] bg-[#0A1A12]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10"
              >
                <p className="text-3xl">{won ? '💶' : '📉'}</p>
                <p className="text-xl font-sans font-extrabold text-white text-center px-6">
                  {won ? 'Купюра 512 ₽ собрана!' : 'Ходы закончились'}
                </p>
                <p className="text-sm font-mono text-white/60">
                  Итог: {score.toLocaleString('ru-RU')} ₽
                </p>
                <div className="flex gap-3">
                  {won && !over && (
                    <button
                      type="button"
                      onClick={() => setWon(false)}
                      className="px-6 h-12 rounded-2xl bg-white/10 text-white font-bold text-sm uppercase tracking-widest hover:bg-white/20"
                    >
                      Дальше
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={restart}
                    className="px-6 h-12 rounded-2xl bg-gradient-to-r from-[#FF7A00] to-[#FFA011] text-white font-bold text-sm uppercase tracking-widest active:scale-95"
                  >
                    Заново
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
