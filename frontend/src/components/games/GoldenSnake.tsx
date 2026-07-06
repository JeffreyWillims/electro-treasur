import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play } from 'lucide-react';
import { getBest, submitScore } from '@/lib/gameRecords';

/**
 * «Золотая змейка» — классика в финансовой теме Citrine Vault.
 * Змейка собирает монеты: каждая монета +25 ₽ к капиталу, темп растёт.
 * Управление: стрелки / WASD / свайпы.
 */

const GRID = 15;
const START_TICK_MS = 160;
const MIN_TICK_MS = 70;
const COIN_VALUE = 25;

type Point = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function randomCoin(snake: Point[]): Point {
  const taken = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
}

const INITIAL_SNAKE: Point[] = [
  { x: 7, y: 7 },
  { x: 6, y: 7 },
  { x: 5, y: 7 },
];

export function GoldenSnake({ onClose }: { onClose: () => void }) {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [coin, setCoin] = useState<Point>(() => randomCoin(INITIAL_SNAKE));
  const [capital, setCapital] = useState(0);
  const [best, setBest] = useState(() => getBest('snake'));
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);

  const dirRef = useRef<Dir>('right');
  const pendingDirRef = useRef<Dir>('right');
  const touchStart = useRef<Point | null>(null);

  const turn = useCallback((dir: Dir) => {
    if (OPPOSITE[dir] !== dirRef.current) pendingDirRef.current = dir;
  }, []);

  const restart = () => {
    setSnake(INITIAL_SNAKE);
    setCoin(randomCoin(INITIAL_SNAKE));
    setCapital(0);
    setOver(false);
    dirRef.current = 'right';
    pendingDirRef.current = 'right';
    setRunning(true);
  };

  // Игровой цикл: темп ускоряется с ростом капитала
  useEffect(() => {
    if (!running || over) return;
    const tick = Math.max(MIN_TICK_MS, START_TICK_MS - Math.floor(capital / 100) * 10);
    const id = setInterval(() => {
      setSnake((prev) => {
        dirRef.current = pendingDirRef.current;
        const d = DELTA[dirRef.current];
        const prevHead = prev[0];
        if (!prevHead) return prev;
        const head = { x: prevHead.x + d.x, y: prevHead.y + d.y };

        const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
        const hitSelf = prev.some((p, i) => i < prev.length - 1 && p.x === head.x && p.y === head.y);
        if (hitWall || hitSelf) {
          setOver(true);
          setRunning(false);
          return prev;
        }

        const ateCoin = head.x === coin.x && head.y === coin.y;
        const next = [head, ...prev];
        if (ateCoin) {
          setCapital((c) => {
            const total = c + COIN_VALUE;
            if (submitScore('snake', total)) setBest(total);
            return total;
          });
          setCoin(randomCoin(next));
        } else {
          next.pop();
        }
        return next;
      });
    }, tick);
    return () => clearInterval(id);
  }, [running, over, coin, capital]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
        ц: 'up', ы: 'down', ф: 'left', в: 'right',
      };
      if (e.key === 'Escape') onClose();
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        if (!running && !over) setRunning(true);
        turn(dir);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn, onClose, running, over]);

  const cells = new Map<string, 'head' | 'body'>();
  snake.forEach((p, i) => cells.set(`${p.x},${p.y}`, i === 0 ? 'head' : 'body'));

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
        if (!running && !over) setRunning(true);
        turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-sans font-extrabold text-white tracking-tight">
              Золотая змейка
            </h2>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
              Собирай монеты · стрелки, WASD или свайпы
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
            ['Капитал', `${capital.toLocaleString('ru-RU')} ₽`],
            ['Рекорд', `${best.toLocaleString('ru-RU')} ₽`],
          ].map(([label, value]) => (
            <div key={label} className="flex-1 rounded-2xl bg-white/10 px-4 py-2.5 text-center">
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-white/50">
                {label}
              </p>
              <p className="text-lg font-sans font-extrabold text-white leading-tight">{value}</p>
            </div>
          ))}
        </div>

        {/* Field */}
        <div
          className="relative rounded-[2rem] bg-white/5 border border-white/10 p-3 select-none"
          style={{ aspectRatio: '1 / 1' }}
        >
          <div
            className="grid w-full h-full gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}
          >
            {Array.from({ length: GRID * GRID }, (_, i) => {
              const x = i % GRID;
              const y = Math.floor(i / GRID);
              const kind = cells.get(`${x},${y}`);
              const isCoin = coin.x === x && coin.y === y;
              return (
                <div
                  key={i}
                  className={
                    kind === 'head'
                      ? 'rounded-[4px] bg-gradient-to-br from-[#FF7A00] to-[#FFA011] shadow-[0_0_10px_rgba(255,122,0,0.8)]'
                      : kind === 'body'
                        ? 'rounded-[4px] bg-[#FF9A2E]/80'
                        : isCoin
                          ? 'rounded-full bg-[#FFD75E] shadow-[0_0_12px_rgba(255,215,94,0.9)] animate-pulse'
                          : 'rounded-[4px] bg-white/[0.03]'
                  }
                />
              );
            })}
          </div>

          {/* Start / Game over */}
          <AnimatePresence>
            {(!running || over) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-[2rem] bg-[#0A1A12]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10"
              >
                <p className="text-3xl">{over ? '💸' : '🪙'}</p>
                <p className="text-xl font-sans font-extrabold text-white text-center px-6">
                  {over ? `Капитал потерян: ${capital.toLocaleString('ru-RU')} ₽` : 'Каждая монета +25 ₽'}
                </p>
                <button
                  type="button"
                  onClick={restart}
                  className="px-8 h-12 rounded-2xl bg-gradient-to-r from-[#FF7A00] to-[#FFA011] text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2 active:scale-95"
                >
                  <Play className="w-4 h-4" />
                  {over ? 'Ещё раз' : 'Старт'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
