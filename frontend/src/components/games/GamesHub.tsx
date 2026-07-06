import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PacificRide } from '@/components/ui/PacificRide';
import { Game512 } from '@/components/games/Game512';
import { GoldenSnake } from '@/components/games/GoldenSnake';
import { getBest, type GameKey } from '@/lib/gameRecords';
import { fetchLeaderboard } from '@/api/client';
import { cn } from '@/lib/utils';

/**
 * Citrine Arcade — «Игровой цех финансов».
 * Светлое «жидкое стекло»: пастельные градиенты, полупрозрачные панели, blur.
 * Рекорды в localStorage + рейтинг топ-100 с бэкенда (кеш react-query).
 */

type GameId = 'match' | 'game512' | 'snake';

const GAMES: {
  id: GameId;
  recordKey: GameKey;
  title: string;
  subtitle: string;
  emoji: string;
  unit: string;
  pastel: string; // пастельный градиент карточки (светлая тема)
}[] = [
  {
    id: 'match',
    recordKey: 'match',
    title: 'Pacific Ride',
    subtitle: 'Number Match · вычёркивай пары',
    emoji: '🌅',
    unit: 'очков',
    pastel: 'from-[#FFE9D6]/70 via-[#FFF4E8]/60 to-[#FDEFF6]/70',
  },
  {
    id: 'game512',
    recordKey: 'game512',
    title: 'Купюра 512 ₽',
    subtitle: 'Сливай номиналы до купюры',
    emoji: '💶',
    unit: '₽',
    pastel: 'from-[#DCEEFF]/70 via-[#EAF5FF]/60 to-[#E8F0FD]/70',
  },
  {
    id: 'snake',
    recordKey: 'snake',
    title: 'Золотая змейка',
    subtitle: 'Собирай монеты — расти капитал',
    emoji: '🐍',
    unit: '₽',
    pastel: 'from-[#E3F5EA]/70 via-[#F0FAF3]/60 to-[#FBF7E9]/70',
  },
];

const MEDALS = ['🥇', '🥈', '🥉'];

function Leaderboard() {
  const [game, setGame] = useState<GameId>('match');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['leaderboard', game],
    queryFn: () => fetchLeaderboard(game),
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

        {/* Переключатель игр */}
        <div className="flex gap-1.5 p-1 rounded-2xl bg-black/5 dark:bg-black/30">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGame(g.id)}
              className={cn(
                'px-3.5 h-9 rounded-xl text-xs font-bold tracking-tight transition-all',
                game === g.id
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
        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-2xl flex items-center justify-center border border-white/60 dark:border-white/10 shadow-soft-lift">
            <Gamepad2 className="w-6 h-6 text-[#FF7A00]" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
              Citrine Arcade
            </h1>
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00] mt-2">
              Игровой цех финансов
            </p>
          </div>
        </div>

        {/* Карточки-автоматы — пастельное «жидкое стекло» */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {GAMES.map((game) => (
            <motion.button
              key={game.id}
              type="button"
              whileHover={{ y: -4 }}
              onClick={() => setOpenGame(game.id)}
              className={cn(
                'group rounded-[2.5rem] p-8 text-left relative overflow-hidden transition-shadow',
                'bg-gradient-to-br backdrop-blur-2xl backdrop-saturate-150',
                game.pastel,
                'border border-white/60 shadow-soft-lift hover:shadow-[0_24px_50px_rgba(255,122,0,0.12)]',
                'dark:bg-none dark:bg-white/5 dark:border-white/10',
              )}
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/40 dark:bg-[#FF7A00]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none group-hover:bg-[#FF7A00]/15 transition-all" />
              <p className="text-4xl mb-5">{game.emoji}</p>
              <p className="font-sans font-extrabold text-[#1C3F35] dark:text-white text-xl tracking-tight leading-none mb-1.5">
                {game.title}
              </p>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#FF7A00] mb-6">
                {game.subtitle}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-mono text-[#1C3F35]/50 dark:text-white/50">
                  ⭐ {records[game.id] > 0
                    ? `${records[game.id].toLocaleString('ru-RU')} ${game.unit}`
                    : 'нет рекорда'}
                </p>
                <span className="px-4 h-9 rounded-xl bg-white/60 dark:bg-white/10 text-[#1C3F35] dark:text-white text-xs font-bold uppercase tracking-widest flex items-center border border-white/50 dark:border-white/5 group-hover:bg-[#FF7A00] group-hover:text-white transition-colors">
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
        {openGame === 'snake' && <GoldenSnake onClose={() => setOpenGame(null)} />}
      </AnimatePresence>
    </div>
  );
}
