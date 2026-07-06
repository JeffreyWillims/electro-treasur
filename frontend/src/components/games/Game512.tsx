import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { getBest, submitScore } from '@/lib/gameRecords';

/**
 * «Купюра 512 ₽» — 2048-механика в финансовой теме Citrine Vault.
 * Плитки — номиналы рублей: 1 ₽ → 2 ₽ → … → 512 ₽. Собери купюру!
 * Управление: стрелки / свайпы.
 */

const SIZE = 4;
type Board = number[]; // 16 ячеек, 0 = пусто

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

function emptyCells(b: Board): number[] {
  return b.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
}

function addRandomTile(b: Board): Board {
  const empty = emptyCells(b);
  const cell = empty[Math.floor(Math.random() * empty.length)];
  if (cell === undefined) return b;
  const next = [...b];
  next[cell] = Math.random() < 0.9 ? 1 : 2;
  return next;
}

function newBoard(): Board {
  return addRandomTile(addRandomTile(Array(SIZE * SIZE).fill(0)));
}

/** Сдвиг+слияние одной строки влево; возвращает [строка, заработанные очки]. */
function slideRow(row: number[]): [number[], number] {
  const tiles = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    const current = tiles[i] ?? 0;
    if (i + 1 < tiles.length && current === tiles[i + 1]) {
      const merged = current * 2;
      out.push(merged);
      gained += merged;
      i++;
    } else {
      out.push(current);
    }
  }
  while (out.length < SIZE) out.push(0);
  return [out, gained];
}

type Dir = 'left' | 'right' | 'up' | 'down';

function move(b: Board, dir: Dir): [Board, number, boolean] {
  const next = Array(SIZE * SIZE).fill(0) as Board;
  let gained = 0;
  let moved = false;

  for (let line = 0; line < SIZE; line++) {
    // Извлекаем строку/столбец в порядке движения
    const idx: number[] = [];
    for (let k = 0; k < SIZE; k++) {
      if (dir === 'left') idx.push(line * SIZE + k);
      if (dir === 'right') idx.push(line * SIZE + (SIZE - 1 - k));
      if (dir === 'up') idx.push(k * SIZE + line);
      if (dir === 'down') idx.push((SIZE - 1 - k) * SIZE + line);
    }
    const [slid, g] = slideRow(idx.map((i) => b[i] ?? 0));
    gained += g;
    idx.forEach((boardIdx, k) => {
      next[boardIdx] = slid[k] ?? 0;
      if (b[boardIdx] !== slid[k]) moved = true;
    });
  }
  return [next, gained, moved];
}

function hasMoves(b: Board): boolean {
  if (emptyCells(b).length > 0) return true;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = b[r * SIZE + c];
      if (c + 1 < SIZE && b[r * SIZE + c + 1] === v) return true;
      if (r + 1 < SIZE && b[(r + 1) * SIZE + c] === v) return true;
    }
  }
  return false;
}

export function Game512({ onClose }: { onClose: () => void }) {
  const [board, setBoard] = useState<Board>(newBoard);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => getBest('game512'));
  const [won, setWon] = useState(false);
  const [over, setOver] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return;
      setBoard((prev) => {
        const [next, gained, moved] = move(prev, dir);
        if (!moved) return prev;
        const withTile = addRandomTile(next);
        setScore((s) => {
          const total = s + gained;
          if (submitScore('game512', total)) setBest(total);
          return total;
        });
        if (withTile.includes(512)) setWon(true);
        if (!hasMoves(withTile)) setOver(true);
        return withTile;
      });
    },
    [over],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
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

  const restart = () => {
    setBoard(newBoard());
    setScore(0);
    setWon(false);
    setOver(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0A1A12]/95 backdrop-blur-xl p-4"
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
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-sans font-extrabold text-white tracking-tight">
              Купюра 512 ₽
            </h2>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
              Сливай номиналы · стрелки или свайпы
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

        {/* Score panel */}
        <div className="flex gap-3 mb-4">
          {[
            ['Капитал', `${score.toLocaleString('ru-RU')} ₽`],
            ['Рекорд', `${best.toLocaleString('ru-RU')} ₽`],
          ].map(([label, value]) => (
            <div key={label} className="flex-1 rounded-2xl bg-white/10 px-4 py-2.5 text-center">
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-white/50">
                {label}
              </p>
              <p className="text-lg font-sans font-extrabold text-white leading-tight">{value}</p>
            </div>
          ))}
          <button
            type="button"
            onClick={restart}
            aria-label="Новая игра"
            className="w-14 rounded-2xl bg-[#FF7A00] text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Board */}
        <div className="relative rounded-[2rem] bg-white/5 border border-white/10 p-3 grid grid-cols-4 gap-3 aspect-square select-none">
          {board.map((v, i) => (
            <div
              key={i}
              className="rounded-xl bg-white/5 flex items-center justify-center relative"
            >
              <AnimatePresence>
                {v !== 0 && (
                  <motion.div
                    key={`${i}-${v}`}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center font-sans font-extrabold ${TILE_STYLE[v] || TILE_STYLE[512]}`}
                  >
                    <span className={v >= 128 ? 'text-2xl' : 'text-xl'}>{v}</span>
                    <span className="text-[9px] font-mono opacity-70 -mt-0.5">₽</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {/* Win / Game over overlays */}
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
