import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PacificRide } from '@/components/ui/PacificRide';
import { Game512 } from '@/components/games/Game512';
import { MathSprint } from '@/components/games/MathSprint';
import { syncLocalRecords, getBest, type GameKey } from '@/lib/gameRecords';
import { fetchLeaderboard, fetchTotalLeaderboard } from '@/api/client';
import { cn } from '@/lib/utils';

/**
 * Citrine Arcade — «Игровой цех финансов».
 * Светлое «жидкое стекло»: пастельные градиенты, полупрозрачные панели, blur.
 * Рекорды в localStorage + рейтинг топ-100 с бэкенда (кеш react-query).
 */

type GameId = 'match' | 'game512' | 'piggy';

const GAMES: {
  id: GameId;
  recordKey: GameKey;
  title: string;
  subtitle: string;
  emoji: string;
  unit: string;
  gradient: string; // насыщенный градиент «за дверью» — тематика игры
  glow: string; // цвет свечения портала (radial-gradient)
}[] = [
  {
    id: 'match',
    recordKey: 'match',
    title: 'Десятка',
    subtitle: 'Пары в сумме 10 · вычёркивай',
    emoji: '🔟',
    unit: 'очков',
    gradient: 'from-[#3B1D5A] via-[#B34270] to-[#FF8A3D]', // закат
    glow: 'rgba(255, 168, 92, 0.55)',
  },
  {
    id: 'game512',
    recordKey: 'game512',
    title: 'Купюра 512 ₽',
    subtitle: 'Сливай номиналы до купюры',
    emoji: '💶',
    unit: '₽',
    gradient: 'from-[#04241B] via-[#0E5B3F] to-[#1CA36B]', // изумруд-деньги
    glow: 'rgba(96, 245, 175, 0.45)',
  },
  {
    id: 'piggy',
    recordKey: 'piggy', // ключ рекордов прежний — рейтинг топ-100 сохраняется
    title: 'Устный счёт',
    subtitle: 'Спринт · реши как можно больше',
    emoji: '🧮',
    unit: 'очков',
    gradient: 'from-[#0A1633] via-[#1E3A8A] to-[#22D3EE]', // «мозговой» индиго → циан
    glow: 'rgba(56, 189, 248, 0.5)',
  },
];

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * LuxoLamp — иконка раздела в духе лампы Pixar: приседает, прыгает и делает
 * сальто, приземляется с фирменным «squash & stretch». SVG + framer-motion.
 */
function LuxoLamp() {
  return (
    <motion.svg
      viewBox="0 0 48 48"
      className="w-8 h-8 text-[#FF7A00] drop-shadow-[0_0_10px_rgba(255,122,0,0.85)]"
      style={{ transformOrigin: '50% 50%' }}
      animate={{
        y: [0, 3, -13, -13, 2, 0],
        rotate: [0, 0, 200, 360, 360, 360],
        scaleY: [1, 0.78, 1.05, 1, 0.82, 1],
      }}
      transition={{
        duration: 2.6,
        times: [0, 0.14, 0.42, 0.64, 0.8, 1],
        repeat: Infinity,
        repeatDelay: 0.7,
        ease: 'easeInOut',
      }}
    >
      <defs>
        {/* Тёплый конус света из абажура */}
        <linearGradient id="luxoBeam" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE9C4" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFB347" stopOpacity="0" />
        </linearGradient>
        {/* Металл абажура: от подсвеченного края к тени */}
        <linearGradient id="luxoShade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFA94D" />
          <stop offset="55%" stopColor="#FF7A00" />
          <stop offset="100%" stopColor="#C25400" />
        </linearGradient>
        <radialGradient id="luxoBulb" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFF6E0" />
          <stop offset="70%" stopColor="#FFDB8A" />
          <stop offset="100%" stopColor="#FFB347" stopOpacity="0.4" />
        </radialGradient>
      </defs>

      {/* Конус света — включается «за» лампой */}
      <path d="M33 21 L46 27 L41 39 Z" fill="url(#luxoBeam)">
        <animate attributeName="opacity" values="0.55;1;0.55" dur="2.6s" repeatCount="indefinite" />
      </path>

      {/* Основание: пьедестал с бликом */}
      <rect x="13" y="40.5" width="22" height="3.6" rx="1.8" fill="currentColor" />
      <rect x="15" y="41.2" width="8" height="1" rx="0.5" fill="#FFC98A" opacity="0.8" />

      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Нижнее и верхнее «колено» */}
        <path d="M24 41 L20 26" />
        <path d="M20 26 L31 18" />
      </g>
      {/* Пружины-тяги между коленями — фирменная деталь Luxo */}
      <path d="M23 34 L21.5 27.5" stroke="#FFC98A" strokeWidth="1" strokeLinecap="round" opacity="0.9" />
      <path d="M21.5 25 L29 19.5" stroke="#FFC98A" strokeWidth="1" strokeLinecap="round" opacity="0.9" />

      {/* Абажур: металл с градиентом + светящаяся лампочка внутри */}
      <path d="M31 18 l8 4 -4 8 -8 -4 z" fill="url(#luxoShade)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="34" cy="23.5" r="2.6" fill="url(#luxoBulb)">
        <animate attributeName="r" values="2.3;2.8;2.3" dur="1.8s" repeatCount="indefinite" />
      </circle>

      {/* Шарниры с бликами */}
      <circle cx="24" cy="41" r="2.4" fill="currentColor" />
      <circle cx="23.4" cy="40.4" r="0.7" fill="#FFC98A" />
      <circle cx="20" cy="26" r="2.4" fill="currentColor" />
      <circle cx="19.4" cy="25.4" r="0.7" fill="#FFC98A" />
    </motion.svg>
  );
}

// «Общий зачёт» — сумма лучших результатов всех игр; открывается по умолчанию.
type LeaderTab = GameId | 'total';

function Leaderboard() {
  const [tab, setTab] = useState<LeaderTab>('total');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['leaderboard', tab],
    queryFn: () => (tab === 'total' ? fetchTotalLeaderboard() : fetchLeaderboard(tab)),
    staleTime: 60_000, // повторное открытие вкладки — мгновенно, из кеша
  });

  return (
    <div
      className={cn(
        'rounded-[2.5rem] p-6 md:p-8 backdrop-blur-3xl backdrop-saturate-150 shadow-soft-lift',
        'bg-white/50 border border-white/60',
        'dark:bg-white/5 dark:border-white/10',
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-[#FF7A00]" />
          <h2 className="font-sans font-extrabold text-xl md:text-2xl tracking-tight text-[#1C3F35] dark:text-white">
            Рейтинг игроков
          </h2>
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#1C3F35]/40 dark:text-white/40">
            топ-100
          </span>
        </div>

        {/* Переключатель: общий зачёт + отдельные игры */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl bg-black/5 dark:bg-black/30">
          {([{ id: 'total' as const, emoji: '👑', title: 'Общий зачёт' }, ...GAMES]).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setTab(g.id)}
              className={cn(
                'px-3.5 h-9 rounded-xl text-xs font-bold tracking-tight transition-all',
                tab === g.id
                  ? 'bg-white dark:bg-white/15 text-[#1C3F35] dark:text-white shadow-sm'
                  : 'text-[#1C3F35]/50 dark:text-white/50 hover:text-[#1C3F35] dark:hover:text-white',
              )}
            >
              {g.emoji} {g.title}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[26rem] overflow-y-auto pr-1 -mr-1">
        {isLoading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-2xl bg-black/5 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="py-8 text-center text-sm text-[#1C3F35]/50 dark:text-white/40">
            Не удалось загрузить рейтинг. Попробуйте позже.
          </p>
        )}

        {data && data.length === 0 && (
          <p className="py-8 text-center text-sm text-[#1C3F35]/50 dark:text-white/40">
            Пока никто не играл — стань первым в таблице! 🏆
          </p>
        )}

        {data && data.length > 0 && (
          <ol className="space-y-1">
            {data.map((entry, i) => (
              <li
                key={`${entry.name}-${i}`}
                className={cn(
                  'flex items-center gap-4 px-4 h-12 rounded-2xl transition-colors',
                  i < 3
                    ? 'bg-gradient-to-r from-[#FF7A00]/10 to-transparent'
                    : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                )}
              >
                <span className="w-8 shrink-0 text-center font-mono text-sm font-bold text-[#1C3F35]/40 dark:text-white/40">
                  {MEDALS[i] ?? i + 1}
                </span>
                <span className="flex-1 truncate font-semibold text-sm text-[#1C3F35] dark:text-white">
                  {entry.name}
                </span>
                <span className="font-mono font-bold text-sm text-[#FF7A00]">
                  {entry.score.toLocaleString('ru-RU')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function GamesHub() {
  const [openGame, setOpenGame] = useState<GameId | null>(null);

  // Переотправляем рекорды из localStorage при каждом открытии аркады —
  // страховка от потерянных фоновых отправок (upsert идемпотентен).
  useEffect(() => {
    void syncLocalRecords();
  }, []);

  // Рекорды перечитываются после закрытия игры (openGame → null)
  const records = Object.fromEntries(
    GAMES.map((g) => [g.id, getBest(g.recordKey)]),
  ) as Record<GameId, number>;

  return (
    <div className="max-w-5xl mx-auto pt-12 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="flex flex-col gap-8"
      >
        {/* Header — единый стиль с дашбордом */}
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1C3F35] to-[#0A1A12] dark:from-[#050505] dark:to-[#111111] flex items-center justify-center border border-white/10 shadow-lg shadow-emerald-900/10 overflow-hidden">
            <LuxoLamp />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
              Arcade
            </h1>
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00] mt-2">
              Игровой цех финансов
            </p>
          </div>
        </div>

        {/* Карточки-порталы — «двери в Нарнию»: арка, свечение из-за двери,
            эмодзи-хранитель, табличка с рекордом и кнопкой внизу */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {GAMES.map((game) => (
            <motion.button
              key={game.id}
              type="button"
              whileHover={{ y: -8, rotate: -1.2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              onClick={() => setOpenGame(game.id)}
              className={cn(
                'group relative flex flex-col min-h-[340px] rounded-[2.5rem] p-5 text-left overflow-hidden',
                'bg-gradient-to-b', game.gradient,
                'border border-white/15 shadow-2xl hover:shadow-[0_28px_60px_rgba(0,0,0,0.35)]',
                'transition-shadow duration-700',
              )}
            >
              {/* Дверной проём: арочный верх, за дверью — свечение портала */}
              <div className="relative flex-1 flex flex-col items-center justify-center px-4 pb-6 rounded-t-[8rem] rounded-b-3xl border border-white/20 bg-white/[0.06] overflow-hidden">
                <div
                  className="absolute inset-0 opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 50% 42%, ${game.glow}, transparent 68%)` }}
                />
                {/* Хранитель портала */}
                <span className="relative text-6xl drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition-transform duration-700 group-hover:scale-110">
                  {game.emoji}
                </span>
                <p className="relative font-sans font-black text-white text-2xl tracking-tight leading-none text-center mt-5">
                  {game.title}
                </p>
                <p className="relative text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-white/70 text-center mt-2.5">
                  {game.subtitle}
                </p>
              </div>

              {/* Табличка на двери: рекорд + кнопка */}
              <div className="relative mt-4 flex items-center justify-between rounded-2xl bg-black/25 backdrop-blur-md border border-white/15 px-4 py-2.5">
                <p className="text-[11px] font-mono font-bold text-white/80">
                  ⭐ {records[game.id] > 0
                    ? `${records[game.id].toLocaleString('ru-RU')} ${game.unit}`
                    : 'нет рекорда'}
                </p>
                <span className="px-4 h-9 rounded-xl bg-white/15 text-white text-xs font-bold uppercase tracking-widest flex items-center border border-white/20 group-hover:bg-[#FF7A00] group-hover:border-[#FF7A00] transition-colors">
                  Играть
                </span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Рейтинговое окно */}
        <Leaderboard />
      </motion.div>

      {/* Оверлеи игр */}
      <AnimatePresence>
        {openGame === 'match' && <PacificRide onClose={() => setOpenGame(null)} />}
        {openGame === 'game512' && <Game512 onClose={() => setOpenGame(null)} />}
        {openGame === 'piggy' && <MathSprint onClose={() => setOpenGame(null)} />}
      </AnimatePresence>
    </div>
  );
}
