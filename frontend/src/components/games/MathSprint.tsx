/**
 * «Устный счёт» 🧮 — аркадный спринт на скорость (тренировка счёта в уме).
 *
 * Пример на экране → вводишь ответ → верный автозачётом (как только цифры
 * совпали), комбо ×N растёт, таймер тикает: верный +2 с, ошибка −4 с и сброс
 * комбо. Сложность растёт по числу решённых (± → умножение → проценты). Рекорд
 * идёт в рейтинг топ-100 (ключ 'piggy'). Ачивки — в localStorage.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Delete, CornerDownLeft, Timer } from 'lucide-react';
import { getBest, submitScore } from '@/lib/gameRecords';
import { SunsetBackground } from '@/components/ui/PacificRide';
import {
  generateProblem,
  levelForSolved,
  comboMultiplier,
  pointsFor,
  START_SECONDS,
  TIME_BONUS,
  TIME_PENALTY,
  type Problem,
} from '@/lib/mathSprint';

interface Props {
  onClose: () => void;
}

type Phase = 'ready' | 'running' | 'over';

const ACH_KEY = 'cv_ach_math';

const ACHIEVEMENTS = [
  { id: 'first', emoji: '🌱', title: 'Первый забег', hint: 'Сыграть первую партию' },
  { id: 'combo3', emoji: '⚡', title: 'Разгон', hint: 'Комбо ×3' },
  { id: 'combo6', emoji: '🔥', title: 'В ударе', hint: 'Максимальное комбо ×6' },
  { id: 'nomiss', emoji: '🎯', title: 'Без промаха', hint: '15 верных подряд' },
  { id: 'fast', emoji: '💨', title: 'Быстрый ум', hint: '10 верных за 15 секунд' },
  { id: 'k1', emoji: '💯', title: 'Тысячник', hint: '1000 очков за партию' },
  { id: 'prof', emoji: '🎓', title: 'Профессор', hint: 'Дойти до 4-го уровня' },
  { id: 'record', emoji: '🏆', title: 'Рекордсмен', hint: 'Побить свой рекорд' },
] as const;

type AchId = (typeof ACHIEVEMENTS)[number]['id'];

const loadAch = (): AchId[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(ACH_KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

export function MathSprint({ onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<Problem>(() => generateProblem(1));
  const [timeLeft, setTimeLeft] = useState(START_SECONDS);
  const [best, setBest] = useState(() => getBest('piggy'));
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null);
  const [lastMiss, setLastMiss] = useState<number | null>(null);
  const [newRecord, setNewRecord] = useState(false);
  const [unlocked, setUnlocked] = useState<AchId[]>(loadAch);
  const [banner, setBanner] = useState<(typeof ACHIEVEMENTS)[number] | null>(null);

  const scoreRef = useRef(0);
  const deadlineRef = useRef(0);
  const startedRef = useRef(0);
  const endRef = useRef<() => void>(() => {});

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const unlock = (id: AchId) => {
    setUnlocked((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(ACH_KEY, JSON.stringify(next));
      } catch {
        /* приватный режим */
      }
      const meta = ACHIEVEMENTS.find((a) => a.id === id);
      if (meta) {
        setBanner(meta);
        window.setTimeout(() => setBanner(null), 2400);
      }
      return next;
    });
  };

  const endGame = () => {
    setPhase('over');
    const s = scoreRef.current;
    const prevBest = getBest('piggy');
    if (s > prevBest && s > 0) {
      submitScore('piggy', s);
      setBest(s);
      setNewRecord(true);
      unlock('record');
    } else {
      setNewRecord(false);
    }
    if (s >= 1000) unlock('k1');
  };
  // Держим в ref свежий endGame, чтобы таймер-интервал вызывал актуальную версию.
  useEffect(() => {
    endRef.current = endGame;
  });

  // Таймер: дедлайн в ref, дисплей — в state. Верный/ошибка сдвигают дедлайн.
  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      const left = deadlineRef.current - Date.now();
      if (left <= 0) {
        setTimeLeft(0);
        endRef.current();
        return;
      }
      setTimeLeft(left / 1000);
    };
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [phase]);

  const start = () => {
    setScore(0);
    setStreak(0);
    setSolved(0);
    setTyped('');
    setLastMiss(null);
    setNewRecord(false);
    scoreRef.current = 0;
    startedRef.current = Date.now();
    deadlineRef.current = Date.now() + START_SECONDS * 1000;
    setTimeLeft(START_SECONDS);
    setProblem(generateProblem(1));
    setPhase('running');
    unlock('first');
  };

  const correct = () => {
    const mult = comboMultiplier(streak);
    const level = levelForSolved(solved);
    const gained = pointsFor(level, mult);
    const newScore = score + gained;
    const newSolved = solved + 1;
    const newStreak = streak + 1;
    setScore(newScore);
    setSolved(newSolved);
    setStreak(newStreak);
    scoreRef.current = newScore;
    deadlineRef.current += TIME_BONUS * 1000;
    setLastMiss(null);
    setFlash('ok');
    window.setTimeout(() => setFlash(null), 200);
    navigator.vibrate?.(8);
    setTyped('');
    setProblem(generateProblem(levelForSolved(newSolved)));

    if (comboMultiplier(newStreak) >= 3) unlock('combo3');
    if (comboMultiplier(newStreak) >= 6) unlock('combo6');
    if (newStreak >= 15) unlock('nomiss');
    if (newSolved === 10 && Date.now() - startedRef.current <= 15000) unlock('fast');
    if (levelForSolved(newSolved) >= 4) unlock('prof');
    if (newScore >= 1000) unlock('k1');
  };

  const wrong = () => {
    setStreak(0);
    deadlineRef.current -= TIME_PENALTY * 1000;
    setLastMiss(problem.answer);
    setFlash('err');
    window.setTimeout(() => setFlash(null), 320);
    navigator.vibrate?.([15, 40, 15]);
    setTyped('');
    setProblem(generateProblem(levelForSolved(solved)));
  };

  const pushDigit = (d: string) => {
    if (phase !== 'running') return;
    const next = (typed + d).slice(0, 7);
    setTyped(next);
    if (Number(next) === problem.answer) correct();
  };

  const submit = () => {
    if (phase !== 'running' || typed === '') return;
    if (Number(typed) === problem.answer) correct();
    else wrong();
  };

  // Физическая клавиатура. Без массива зависимостей — замыкания всегда свежие.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (phase === 'ready' && (e.key === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        return start();
      }
      if (phase !== 'running') return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        pushDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setTyped((t) => t.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const level = levelForSolved(solved);
  const mult = comboMultiplier(streak);
  const timePct = Math.max(0, Math.min(100, (timeLeft / START_SECONDS) * 100));
  const flashBg =
    flash === 'ok' ? 'bg-emerald-500/15' : flash === 'err' ? 'bg-rose-500/15' : 'bg-transparent';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
    >
      <SunsetBackground />

      <div className="relative w-full max-w-md rounded-[2.5rem] bg-[#0A1A12]/80 backdrop-blur-2xl border border-white/10 p-5 sm:p-6 shadow-2xl overflow-hidden">
        {/* Флеш верно/ошибка */}
        <motion.div
          aria-hidden
          animate={{ opacity: flash ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className={`pointer-events-none absolute inset-0 ${flashBg}`}
        />

        {/* Шапка */}
        <div className="relative flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-sans font-extrabold text-white tracking-tight">
              Устный счёт 🧮
            </h2>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
              {phase === 'running' ? `Уровень ${level} · спринт` : 'Тренировка мозга на скорость'}
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
        <div className="relative grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Счёт', value: score.toLocaleString('ru-RU') },
            { label: 'Комбо', value: `×${mult}` },
            { label: 'Уровень', value: `${level}` },
            { label: 'Рекорд', value: best.toLocaleString('ru-RU') },
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

        {/* Таймер */}
        <div className="relative flex items-center gap-2 mb-4">
          <Timer className="w-4 h-4 text-white/50 shrink-0" />
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
                timeLeft <= 8 ? 'bg-rose-500' : 'bg-gradient-to-r from-[#FF7A00] to-[#FFA011]'
              }`}
              style={{ width: `${timePct}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-white/60 tabular-nums w-8 text-right">
            {Math.ceil(timeLeft)}
          </span>
        </div>

        {/* Игровое поле */}
        <div className="relative rounded-[2rem] bg-white/5 border border-white/10 p-6 min-h-[190px] flex flex-col items-center justify-center gap-4 select-none">
          {phase === 'over' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <p className="text-5xl mb-2">{newRecord ? '🏆' : '⏱'}</p>
              <p className="text-lg font-sans font-black text-white">
                {newRecord ? 'Новый рекорд!' : 'Время вышло'}
              </p>
              <p className="text-3xl font-mono font-black text-[#FF7A00] mt-1">
                {score.toLocaleString('ru-RU')}
              </p>
              <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-white/50 mt-1">
                решено {solved} · рекорд {best.toLocaleString('ru-RU')}
              </p>
              <button
                type="button"
                onClick={start}
                className="mt-5 px-8 py-3 rounded-2xl text-white font-bold uppercase tracking-widest text-xs bg-gradient-to-r from-[#FF7A00] to-[#FFA011] hover:opacity-90 active:scale-95 transition-all"
              >
                Ещё раз
              </button>
            </motion.div>
          ) : phase === 'ready' ? (
            <div className="text-center">
              <p className="text-white/80 font-sans font-semibold leading-relaxed mb-1">
                Решай примеры на скорость.
              </p>
              <p className="text-[12px] text-white/50 leading-relaxed mb-5">
                Верный ответ = +{TIME_BONUS} с и комбо растёт.
                <br />
                Ошибка = −{TIME_PENALTY} с и серия сгорает.
              </p>
              <button
                type="button"
                onClick={start}
                className="px-10 py-3.5 rounded-2xl text-white font-bold uppercase tracking-widest text-sm bg-gradient-to-r from-[#FF7A00] to-[#FFA011] hover:opacity-90 active:scale-95 transition-all"
              >
                Играть
              </button>
            </div>
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                <motion.p
                  key={problem.text}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.15 }}
                  className="text-4xl sm:text-5xl font-sans font-black text-white tabular-nums tracking-tight"
                >
                  {problem.text}
                </motion.p>
              </AnimatePresence>
              <div className="h-12 flex items-center justify-center">
                <span className="text-3xl font-sans font-black text-[#FFB255] tabular-nums min-h-[1em]">
                  {typed || <span className="text-white/25">?</span>}
                </span>
              </div>
              <AnimatePresence>
                {lastMiss !== null && (
                  <motion.p
                    key={lastMiss}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-3 text-[11px] font-mono font-bold text-rose-300"
                  >
                    было {lastMiss}
                  </motion.p>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Плашка ачивки */}
          <AnimatePresence>
            {banner && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="absolute -bottom-2 left-2 right-2 rounded-2xl bg-[#FF7A00]/90 backdrop-blur px-4 py-2 flex items-center gap-3 shadow-lg"
              >
                <span className="text-xl">{banner.emoji}</span>
                <div>
                  <p className="text-[11px] font-black text-white uppercase tracking-wide">
                    Ачивка: {banner.title}
                  </p>
                  <p className="text-[10px] font-semibold text-white/80">{banner.hint}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Клавиатура — только во время игры */}
        {phase === 'running' && (
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => pushDigit(d)}
                className="h-12 rounded-xl bg-white/10 border border-white/10 text-white text-xl font-sans font-black hover:bg-white/20 active:scale-95 transition-all"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTyped((t) => t.slice(0, -1))}
              className="h-12 rounded-xl bg-white/10 border border-white/10 text-white flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
            >
              <Delete className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => pushDigit('0')}
              className="h-12 rounded-xl bg-white/10 border border-white/10 text-white text-xl font-sans font-black hover:bg-white/20 active:scale-95 transition-all"
            >
              0
            </button>
            <button
              type="button"
              onClick={submit}
              className="h-12 rounded-xl bg-gradient-to-r from-[#FF7A00] to-[#FFA011] text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
            >
              <CornerDownLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        <p className="relative mt-4 text-center text-[10px] font-mono text-white/35">
          🏅 Ачивки: {unlocked.length} из {ACHIEVEMENTS.length}
        </p>
      </div>
    </motion.div>
  );
}
