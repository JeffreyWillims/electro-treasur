import { useState } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Trophy } from 'lucide-react';
import { PacificRide } from '@/components/ui/PacificRide';
import { Game512 } from '@/components/games/Game512';
import { GoldenSnake } from '@/components/games/GoldenSnake';
import { getBest, type GameKey } from '@/lib/gameRecords';

/**
 * Citrine Arcade — «Игровой цех финансов».
 * Три игры в финансовой теме, рекорды в localStorage, челлендж дня.
 */

type GameId = 'match' | 'game512' | 'snake';

const GAMES: {
  id: GameId;
  recordKey: GameKey;
  title: string;
  subtitle: string;
  emoji: string;
  unit: string;
}[] = [
  {
    id: 'match',
    recordKey: 'match',
    title: 'Pacific Ride',
    subtitle: 'Number Match · вычёркивай пары',
    emoji: '🌅',
    unit: 'очков',
  },
  {
    id: 'game512',
    recordKey: 'game512',
    title: 'Купюра 512 ₽',
    subtitle: 'Сливай номиналы до купюры',
    emoji: '💶',
    unit: '₽',
  },
  {
    id: 'snake',
    recordKey: 'snake',
    title: 'Золотая змейка',
    subtitle: 'Собирай монеты — расти капитал',
    emoji: '🐍',
    unit: '₽',
  },
];

// Челлендж дня: детерминированно по дате, «выполнен», если рекорд достиг цели.
const CHALLENGES: { game: GameId; text: string; target: number }[] = [
  { game: 'game512', text: 'Собери плитку и накопи 512 ₽ в «Купюре»', target: 512 },
  { game: 'snake', text: 'Разгони капитал змейки до 500 ₽', target: 500 },
  { game: 'match', text: 'Набери 3000 очков в Pacific Ride', target: 3000 },
];

function dayOfYear(): number {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

export function GamesHub() {
  const [openGame, setOpenGame] = useState<GameId | null>(null);
  // Рекорды перечитываются после закрытия игры (openGame → null)
  const records = Object.fromEntries(
    GAMES.map((g) => [g.id, getBest(g.recordKey)]),
  ) as Record<GameId, number>;

  const challenge = CHALLENGES[dayOfYear() % CHALLENGES.length] ?? CHALLENGES[0]!;
  const challengeDone = records[challenge.game] >= challenge.target;

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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1C3F35] to-[#0A1A12] dark:from-[#050505] dark:to-[#111111] flex items-center justify-center border border-white/10 shadow-lg">
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

        {/* Челлендж дня */}
        <button
          type="button"
          onClick={() => setOpenGame(challenge.game)}
          className={`rounded-[2rem] p-6 md:p-7 border text-left transition-all active:scale-[0.99] ${
            challengeDone
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-[#FF7A00]/10 border-[#FF7A00]/30 hover:bg-[#FF7A00]/15'
          }`}
        >
          <div className="flex items-center gap-4">
            <Trophy
              className={`w-8 h-8 shrink-0 ${challengeDone ? 'text-emerald-500' : 'text-[#FF7A00]'}`}
            />
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/60 dark:text-white/50">
                Челлендж дня {challengeDone && '· выполнен ✓'}
              </p>
              <p className="font-sans font-extrabold text-lg md:text-xl text-[#1C3F35] dark:text-white tracking-tight">
                {challenge.text}
              </p>
            </div>
          </div>
        </button>

        {/* Карточки-автоматы */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {GAMES.map((game) => (
            <motion.button
              key={game.id}
              type="button"
              whileHover={{ y: -4 }}
              onClick={() => setOpenGame(game.id)}
              className="group rounded-[2.5rem] p-8 bg-gradient-to-br from-[#1C3F35] to-[#0A1A12] dark:from-[#050505] dark:to-[#111111] border border-black/5 dark:border-white/10 shadow-2xl relative overflow-hidden text-left transition-shadow hover:shadow-[0_20px_50px_rgba(255,122,0,0.15)]"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF7A00]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none group-hover:bg-[#FF7A00]/20 transition-all" />
              <p className="text-4xl mb-5">{game.emoji}</p>
              <p className="font-sans font-extrabold text-white text-xl tracking-tight leading-none mb-1.5">
                {game.title}
              </p>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#FF7A00] mb-6">
                {game.subtitle}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-mono text-white/50">
                  ⭐ {records[game.id] > 0
                    ? `${records[game.id].toLocaleString('ru-RU')} ${game.unit}`
                    : 'нет рекорда'}
                </p>
                <span className="px-4 h-9 rounded-xl bg-white/10 text-white text-xs font-bold uppercase tracking-widest flex items-center border border-white/5 group-hover:bg-[#FF7A00] transition-colors">
                  Играть
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Оверлеи игр */}
      {openGame === 'match' && <PacificRide onClose={() => setOpenGame(null)} />}
      {openGame === 'game512' && <Game512 onClose={() => setOpenGame(null)} />}
      {openGame === 'snake' && <GoldenSnake onClose={() => setOpenGame(null)} />}
    </div>
  );
}
