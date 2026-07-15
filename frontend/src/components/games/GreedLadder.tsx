/**
 * «Не жадничай» 🎲 — push-your-luck лесенка удвоений (замена «Копилки»).
 *
 * Правила: ставка раунда кладётся на кон, каждая открытая карта (1–9) должна
 * быть СТРОГО выше предыдущей — тогда кон удваивается. В любой момент можно
 * «Забрать» кон в капитал. Открыл карту не выше — кон сгорает, раунд окончен.
 * Счётчик оставшихся карт колоды помогает считать шансы (на старших уровнях
 * он скрыт). Уровень пройден, когда капитал дорос до цели за отведённые раунды.
 *
 * Рейтинг: капитал в ₽ → submitScore('piggy', …) — совместим со старыми
 * рекордами Копилки. Ачивки — клиентские, в localStorage `cv_ach_piggy`.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { getBest, submitScore } from '@/lib/gameRecords';
import { SunsetBackground } from '@/components/ui/PacificRide';

interface GreedLadderProps {
  onClose: () => void;
}

const LEVELS = [
  { label: 'УРОВЕНЬ 1 · РАЗМИНКА', goal: 300, rounds: 6, stake: 25, counter: true },
  { label: 'УРОВЕНЬ 2 · АППЕТИТ', goal: 800, rounds: 6, stake: 25, counter: true },
  { label: 'УРОВЕНЬ 3 · ХЛАДНОКРОВИЕ', goal: 1600, rounds: 5, stake: 25, counter: true },
  { label: 'УРОВЕНЬ 4 · КРУПЬЕ', goal: 3000, rounds: 5, stake: 50, counter: false },
  { label: 'УРОВЕНЬ 5 · ЛЕГЕНДА ЗАКАТА', goal: 5000, rounds: 4, stake: 50, counter: false },
] as const;

const COPIES_PER_VALUE = 4; // колода: числа 1–9, по 4 штуки

const ACH_KEY = 'cv_ach_piggy';
const TOTAL_KEY = 'cv_piggy_total';

const ACHIEVEMENTS = [
  { id: 'first_cash', emoji: '🌱', title: 'Первая заначка', hint: 'Забрать первый выигрыш' },
  { id: 'streak5', emoji: '🧊', title: 'Холодная голова', hint: '5 раундов подряд без сгорания' },
  { id: 'x8', emoji: '🔥', title: 'Смелость города берёт', hint: 'Дожать лесенку до ×8' },
  { id: 'x32', emoji: '⚡', title: 'Легенда лесенки', hint: 'Дожать лесенку до ×32' },
  { id: 'phoenix', emoji: '🐦', title: 'Это было не страшно', hint: 'Сгореть и тут же выиграть' },
  { id: 'level4', emoji: '🎩', title: 'Крупье', hint: 'Дойти до уровня без счётчика' },
  { id: 'rich', emoji: '🏦', title: 'Хранитель капитала', hint: '10 000 ₽ за все партии' },
  { id: 'legend', emoji: '🌅', title: 'Легенда заката', hint: 'Пройти все 5 уровней' },
] as const;

type AchId = (typeof ACHIEVEMENTS)[number]['id'];

function loadAch(): AchId[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ACH_KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function loadTotal(): number {
  try {
    return Number(localStorage.getItem(TOTAL_KEY)) || 0;
  } catch {
    return 0;
  }
}

function freshDeck(): number[] {
  const deck: number[] = [];
  for (let v = 1; v <= 9; v++) for (let i = 0; i < COPIES_PER_VALUE; i++) deck.push(v);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

type Phase = 'idle' | 'run' | 'bust' | 'levelup' | 'gameover' | 'win';

export function GreedLadder({ onClose }: GreedLadderProps) {
  const [levelIdx, setLevelIdx] = useState(0);
  const [capital, setCapital] = useState(0);
  const [roundsLeft, setRoundsLeft] = useState<number>(LEVELS[0].rounds);
  const [phase, setPhase] = useState<Phase>('idle');
  const [deck, setDeck] = useState<number[]>(freshDeck);
  const [card, setCard] = useState<number | null>(null);
  const [prevCard, setPrevCard] = useState<number | null>(null);
  const [run, setRun] = useState(0); // кон текущего раунда
  const [steps, setSteps] = useState(0); // успешных удвоений подряд
  const [drawCount, setDrawCount] = useState(0); // ключ анимации карты
  const [best, setBest] = useState(() => getBest('piggy'));
  const [unlocked, setUnlocked] = useState<AchId[]>(loadAch);
  const [achBanner, setAchBanner] = useState<(typeof ACHIEVEMENTS)[number] | null>(null);
  const [cashStreak, setCashStreak] = useState(0);
  const [lastWasBust, setLastWasBust] = useState(false);

  const level = LEVELS[Math.min(levelIdx, LEVELS.length - 1)]!;
  const multiplier = 2 ** steps;

  // Сколько карт каждого достоинства осталось в колоде раунда.
  const remaining = useMemo(() => {
    const counts = Array.from({ length: 9 }, () => 0);
    for (const v of deck) counts[v - 1]!++;
    return counts;
  }, [deck]);

  const higherLeft = card === null ? deck.length : deck.filter((v) => v > card).length;

  const unlock = (id: AchId) => {
    if (unlocked.includes(id)) return;
    const next = [...unlocked, id];
    setUnlocked(next);
    try {
      localStorage.setItem(ACH_KEY, JSON.stringify(next));
    } catch {
      /* приватный режим */
    }
    const meta = ACHIEVEMENTS.find((a) => a.id === id);
    if (meta) {
      setAchBanner(meta);
      setTimeout(() => setAchBanner(null), 2600);
    }
  };

  const addToLifetimeTotal = (amount: number) => {
    const total = loadTotal() + amount;
    try {
      localStorage.setItem(TOTAL_KEY, String(total));
    } catch {
      /* приватный режим */
    }
    if (total >= 10_000) unlock('rich');
  };

  const drawCard = () => {
    if (phase !== 'idle' && phase !== 'run') return;
    const next = deck[0];
    if (next === undefined) return;
    setDeck((d) => d.slice(1));
    setDrawCount((n) => n + 1);

    if (phase === 'idle' || card === null) {
      // Первая карта раунда — базовая, ставка встаёт на кон.
      setCard(next);
      setPrevCard(null);
      setRun(level.stake);
      setSteps(0);
      setPhase('run');
      return;
    }

    setPrevCard(card);
    setCard(next);
    if (next > card) {
      const newSteps = steps + 1;
      setSteps(newSteps);
      setRun((r) => r * 2);
      if (2 ** newSteps >= 8) unlock('x8');
      if (2 ** newSteps >= 32) unlock('x32');
    } else {
      // Сгорело: кон потерян, раунд окончен.
      setPhase('bust');
      setCashStreak(0);
      setLastWasBust(true);
      endRound(0);
    }
  };

  const cashOut = () => {
    if (phase !== 'run' || steps === 0) return;
    const gained = run;
    const newCapital = capital + gained;
    setCapital(newCapital);
    addToLifetimeTotal(gained);
    if (submitScore('piggy', newCapital)) setBest(newCapital);
    unlock('first_cash');
    const streak = cashStreak + 1;
    setCashStreak(streak);
    if (streak >= 5) unlock('streak5');
    if (lastWasBust) unlock('phoenix');
    setLastWasBust(false);

    if (newCapital >= level.goal) {
      if (levelIdx === LEVELS.length - 1) {
        unlock('legend');
        setPhase('win');
      } else {
        setPhase('levelup');
      }
      return;
    }
    endRound(gained);
  };

  // Закрытие раунда: списываем раунд, при нуле раундов — конец партии.
  const endRound = (gained: number) => {
    const left = roundsLeft - 1;
    setRoundsLeft(left);
    if (left <= 0 && capital + gained < level.goal) {
      setPhase('gameover');
    } else if (gained > 0) {
      setPhase('idle');
      setCard(null);
      setPrevCard(null);
      setRun(0);
      setSteps(0);
      setDeck(freshDeck());
    }
    // При сгорании остаёмся в фазе 'bust' — игрок жмёт «Дальше» сам.
  };

  const nextAfterBust = () => {
    if (roundsLeft <= 0) {
      setPhase('gameover');
      return;
    }
    setPhase('idle');
    setCard(null);
    setPrevCard(null);
    setRun(0);
    setSteps(0);
    setDeck(freshDeck());
  };

  const nextLevel = () => {
    const next = levelIdx + 1;
    setLevelIdx(next);
    if (!LEVELS[next]?.counter) unlock('level4');
    setRoundsLeft(LEVELS[next]?.rounds ?? 4);
    setPhase('idle');
    setCard(null);
    setPrevCard(null);
    setRun(0);
    setSteps(0);
    setDeck(freshDeck());
  };

  const restart = () => {
    setLevelIdx(0);
    setCapital(0);
    setRoundsLeft(LEVELS[0].rounds);
    setPhase('idle');
    setCard(null);
    setPrevCard(null);
    setRun(0);
    setSteps(0);
    setCashStreak(0);
    setLastWasBust(false);
    setDeck(freshDeck());
  };

  // Пробел — открыть карту, Enter — забрать, Esc — выход.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'bust') nextAfterBust();
        else drawCard();
      }
      if (e.key === 'Enter') cashOut();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const progress = Math.min(1, capital / level.goal);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
    >
      {/* Единый фон Arcade — калифорнийский закат, как в «Десятке» */}
      <SunsetBackground />

      <div className="relative w-full max-w-md rounded-[2.5rem] bg-[#0A1A12]/80 backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-2xl">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-sans font-extrabold text-white tracking-tight">
              Не жадничай 🎲
            </h2>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
              {level.label}
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

        {/* HUD */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Капитал', value: `${capital.toLocaleString('ru-RU')} ₽` },
            { label: 'Рекорд', value: `${best.toLocaleString('ru-RU')} ₽` },
            { label: 'Уровень', value: `${levelIdx + 1}/${LEVELS.length}` },
            { label: 'Раунды', value: String(roundsLeft) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/10 px-2 py-2 text-center">
              <p className="text-[8px] font-mono font-bold uppercase tracking-[0.15em] text-white/50">
                {s.label}
              </p>
              <p className="text-sm font-sans font-extrabold text-white leading-tight tabular-nums">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Прогресс к цели уровня */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#FF7A00] to-[#FFA011]"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold text-white/50 tabular-nums whitespace-nowrap">
            цель {level.goal.toLocaleString('ru-RU')} ₽
          </span>
        </div>

        {/* Игровая зона */}
        <div className="relative rounded-[2rem] bg-white/5 border border-white/10 p-5 min-h-[240px] flex flex-col items-center justify-center gap-4 select-none overflow-hidden">
          {phase === 'gameover' || phase === 'win' || phase === 'levelup' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <p className="text-5xl mb-3">{phase === 'win' ? '🌅' : phase === 'levelup' ? '🎉' : '🌒'}</p>
              <p className="text-lg font-sans font-black text-white leading-snug">
                {phase === 'win' && 'Легенда заката! Все 5 уровней ваши'}
                {phase === 'levelup' && 'Уровень пройден!'}
                {phase === 'gameover' && 'Раунды кончились — но капитал в зачёте'}
              </p>
              <p className="text-2xl font-mono font-black text-[#FF7A00] mt-2">
                {capital.toLocaleString('ru-RU')} ₽
              </p>
              <button
                type="button"
                onClick={phase === 'levelup' ? nextLevel : restart}
                className="mt-5 px-8 py-3 rounded-2xl text-white font-bold uppercase tracking-widest text-xs bg-gradient-to-r from-[#FF7A00] to-[#FFA011] hover:opacity-90 active:scale-95 transition-all"
              >
                {phase === 'levelup' ? 'Следующий уровень →' : 'Сыграть ещё раз'}
              </button>
            </motion.div>
          ) : (
            <>
              {/* Карты: предыдущая и текущая */}
              <div className="flex items-center gap-4">
                {prevCard !== null && (
                  <div className="w-14 h-20 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-2xl font-black text-white/50">
                    {prevCard}
                  </div>
                )}
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={drawCount}
                    initial={{ rotateY: 90, scale: 0.8, opacity: 0 }}
                    animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                    className={`w-24 h-32 rounded-2xl flex items-center justify-center text-6xl font-black shadow-xl ${
                      phase === 'bust'
                        ? 'bg-rose-500/20 border-2 border-rose-500/60 text-rose-300'
                        : card === null
                          ? 'bg-white/5 border-2 border-dashed border-white/20 text-white/30'
                          : 'bg-gradient-to-b from-[#FDFBF7] to-[#F4EFE4] text-[#1C3F35]'
                    }`}
                  >
                    {card ?? '?'}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Кон и множитель */}
              {phase === 'run' ? (
                <p className="text-sm font-sans font-bold text-white/80">
                  На кону{' '}
                  <span className="text-xl font-black text-[#FF7A00] tabular-nums">
                    {run.toLocaleString('ru-RU')} ₽
                  </span>{' '}
                  <span className="text-white/40">×{multiplier}</span>
                  {level.counter && card !== null && (
                    <span className="text-white/40"> · выше: {higherLeft} карт</span>
                  )}
                </p>
              ) : phase === 'bust' ? (
                <p className="text-sm font-sans font-bold text-rose-300 text-center">
                  Сгорело {run.toLocaleString('ru-RU')} ₽ — в следующий раз заберите чуть раньше 😉
                </p>
              ) : (
                <p className="text-sm font-sans font-semibold text-white/60 text-center">
                  Каждая карта должна быть выше предыдущей — кон удваивается.
                  <br />
                  Заберите вовремя, иначе всё сгорит!
                </p>
              )}
            </>
          )}

          {/* Плашка ачивки */}
          <AnimatePresence>
            {achBanner && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-3 left-3 right-3 rounded-2xl bg-[#FF7A00]/90 backdrop-blur px-4 py-2.5 flex items-center gap-3 shadow-lg"
              >
                <span className="text-2xl">{achBanner.emoji}</span>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-wide">Ачивка: {achBanner.title}</p>
                  <p className="text-[10px] font-semibold text-white/80">{achBanner.hint}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Счётчик колоды */}
        {level.counter && phase !== 'gameover' && phase !== 'win' && (
          <div className="grid grid-cols-9 gap-1 mt-4">
            {remaining.map((count, i) => (
              <div
                key={i}
                className={`rounded-lg py-1 text-center ${count === 0 ? 'bg-white/[0.03]' : 'bg-white/10'}`}
              >
                <p className={`text-[10px] font-black ${card !== null && i + 1 > card ? 'text-[#FFB255]' : 'text-white/60'}`}>{i + 1}</p>
                <p className="text-[9px] font-mono text-white/40">{count}</p>
              </div>
            ))}
          </div>
        )}

        {/* Действия */}
        {phase !== 'gameover' && phase !== 'win' && phase !== 'levelup' && (
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={phase === 'bust' ? nextAfterBust : drawCard}
              className="flex-1 h-[52px] rounded-2xl text-white font-bold uppercase tracking-widest text-xs bg-gradient-to-r from-[#FF7A00] to-[#FFA011] hover:opacity-90 active:scale-[0.98] transition-all"
            >
              {phase === 'bust' ? 'Дальше' : card === null ? `Открыть · ставка ${level.stake} ₽` : 'Рискнуть ещё'}
            </button>
            <button
              type="button"
              onClick={cashOut}
              disabled={phase !== 'run' || steps === 0}
              className="flex-1 h-[52px] rounded-2xl font-bold uppercase tracking-widest text-xs transition-all bg-emerald-500 text-white hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
            >
              Забрать {phase === 'run' && steps > 0 ? `${run.toLocaleString('ru-RU')} ₽` : ''}
            </button>
          </div>
        )}

        {/* Ачивки: N из 8 + рестарт */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40">
            🏅 Ачивки: {unlocked.length} из {ACHIEVEMENTS.length}
          </p>
          <button
            type="button"
            onClick={restart}
            aria-label="Начать заново"
            className="w-9 h-9 rounded-xl bg-white/10 text-white/60 flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
