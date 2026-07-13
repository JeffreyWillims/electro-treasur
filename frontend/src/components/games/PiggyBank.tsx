import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { getBest, submitScore } from '@/lib/gameRecords';

/**
 * «Копилка» — тематическая аркада Citrine Vault вместо змейки.
 * Сверху падают деньги и соблазны: монета +25 ₽, купюра +100 ₽,
 * импульсивная трата (🛍️/💳/🧋) — минус одно из трёх «терпений».
 * Поймал три траты — капитал разбит. Темп растёт с капиталом.
 * Управление: стрелки / A-D / перетаскивание пальцем / экранные кнопки.
 */

type ItemKind = 'coin' | 'bill' | 'trap';

type FallingItem = {
  id: number;
  kind: ItemKind;
  emoji: string;
  x: number; // 0..100 (% ширины поля)
  y: number; // 0..100 (% высоты поля)
  speed: number; // % высоты в секунду
};

const COIN_VALUE = 25;
const BILL_VALUE = 100;
const MAX_LIVES = 3;
const PADDLE_WIDTH = 14; // % ширины поля
const CATCH_ZONE_Y = 88; // % высоты, где стоит копилка
const TRAP_EMOJIS = ['🛍️', '💳', '🧋'];

function spawnItem(id: number, capital: number): FallingItem {
  // Чем больше капитал, тем чаще соблазны и быстрее падение.
  const trapChance = Math.min(0.42, 0.22 + capital / 4000);
  const roll = Math.random();
  const kind: ItemKind = roll < trapChance ? 'trap' : roll < trapChance + 0.12 ? 'bill' : 'coin';
  const baseSpeed = 26 + Math.min(30, capital / 60);
  return {
    id,
    kind,
    emoji:
      kind === 'coin' ? '🪙' : kind === 'bill' ? '💵'
      : TRAP_EMOJIS[Math.floor(Math.random() * TRAP_EMOJIS.length)]!,
    x: 6 + Math.random() * 88,
    y: -6,
    speed: baseSpeed * (kind === 'bill' ? 1.35 : 0.85 + Math.random() * 0.4),
  };
}

export function PiggyBank({ onClose }: { onClose: () => void }) {
  const [capital, setCapital] = useState(0);
  const [best, setBest] = useState(() => getBest('piggy'));
  const [lives, setLives] = useState(MAX_LIVES);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [paddleX, setPaddleX] = useState(50);
  const [lastGain, setLastGain] = useState<{ amount: number; key: number } | null>(null);

  const fieldRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef({ left: false, right: false });
  const nextIdRef = useRef(1);
  const spawnAtRef = useRef(0);
  // Живое состояние партии — в refs: rAF-цикл мутирует их и один раз за кадр
  // зеркалит в useState для рендера (без побочных эффектов в апдейтерах).
  const itemsRef = useRef<FallingItem[]>([]);
  const paddleXRef = useRef(50);
  const capitalRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);

  const restart = () => {
    itemsRef.current = [];
    paddleXRef.current = 50;
    capitalRef.current = 0;
    livesRef.current = MAX_LIVES;
    spawnAtRef.current = 0;
    setCapital(0);
    setLives(MAX_LIVES);
    setItems([]);
    setPaddleX(50);
    setOver(false);
    setPaused(false);
    setLastGain(null);
    setRunning(true);
  };

  const togglePause = useCallback(() => {
    if (running && !over) setPaused((p) => !p);
  }, [running, over]);

  // Игровой цикл на rAF: движение копилки, падение и ловля предметов.
  useEffect(() => {
    if (!running || over || paused) return;
    let raf = 0;
    let prev = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      // Копилка: клавиши двигают, границы поля держат.
      const dir = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
      if (dir !== 0) {
        paddleXRef.current = Math.max(
          PADDLE_WIDTH / 2,
          Math.min(100 - PADDLE_WIDTH / 2, paddleXRef.current + dir * 85 * dt),
        );
      }

      let next = itemsRef.current.map((it) => ({ ...it, y: it.y + it.speed * dt }));

      // Спавн: интервал сжимается с ростом капитала.
      spawnAtRef.current -= dt;
      if (spawnAtRef.current <= 0) {
        next.push(spawnItem(nextIdRef.current++, capitalRef.current));
        spawnAtRef.current = Math.max(0.35, 0.9 - capitalRef.current / 3000);
      }

      // Ловля в зоне копилки.
      const px = paddleXRef.current;
      const caught = next.filter(
        (it) => it.y >= CATCH_ZONE_Y && it.y <= CATCH_ZONE_Y + 9 && Math.abs(it.x - px) <= PADDLE_WIDTH / 2 + 3,
      );
      if (caught.length > 0) {
        const ids = new Set(caught.map((it) => it.id));
        next = next.filter((it) => !ids.has(it.id));
        for (const it of caught) {
          if (it.kind === 'trap') {
            navigator.vibrate?.([40, 30, 40]);
            livesRef.current -= 1;
            if (livesRef.current <= 0) {
              setOver(true);
              setRunning(false);
            }
          } else {
            const gain = it.kind === 'bill' ? BILL_VALUE : COIN_VALUE;
            navigator.vibrate?.(12);
            setLastGain({ amount: gain, key: Date.now() + it.id });
            capitalRef.current += gain;
            if (submitScore('piggy', capitalRef.current)) setBest(capitalRef.current);
          }
        }
      }

      // Улетевшие за низ поля просто исчезают.
      itemsRef.current = next.filter((it) => it.y < 108);

      setItems(itemsRef.current);
      setPaddleX(paddleXRef.current);
      setCapital(capitalRef.current);
      setLives(livesRef.current);

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, over, paused]);

  useEffect(() => {
    const setKey = (e: KeyboardEvent, pressed: boolean) => {
      if (['ArrowLeft', 'a', 'ф', 'A', 'Ф'].includes(e.key)) keysRef.current.left = pressed;
      if (['ArrowRight', 'd', 'в', 'D', 'В'].includes(e.key)) keysRef.current.right = pressed;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === ' ') { e.preventDefault(); togglePause(); return; }
      if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'ф', 'в', 'A', 'D', 'Ф', 'В'].includes(e.key)) {
        e.preventDefault();
        if (!running && !over) setRunning(true);
        setKey(e, true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => setKey(e, false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onClose, togglePause, running, over]);

  // Палец/мышь: копилка следует за касанием по горизонтали.
  const moveToPointer = (clientX: number) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (!running && !over) setRunning(true);
    const x = ((clientX - rect.left) / rect.width) * 100;
    paddleXRef.current = Math.max(PADDLE_WIDTH / 2, Math.min(100 - PADDLE_WIDTH / 2, x));
    setPaddleX(paddleXRef.current);
  };

  const holdPad = (side: 'left' | 'right', pressed: boolean) => {
    if (pressed && !running && !over) setRunning(true);
    keysRef.current[side] = pressed;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0A1A12]/95 backdrop-blur-xl p-4"
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-sans font-extrabold text-white tracking-tight">
              Копилка
            </h2>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
              Лови деньги · уклоняйся от трат · пауза — пробел
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={togglePause}
              disabled={!running || over}
              aria-label={paused ? 'Продолжить' : 'Пауза'}
              className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-30"
            >
              {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть игру"
              className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Score panel */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 rounded-2xl bg-white/10 px-4 py-2.5 text-center relative overflow-visible">
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-white/50">
              Капитал
            </p>
            <p className="text-lg font-sans font-extrabold text-white leading-tight">
              {capital.toLocaleString('ru-RU')} ₽
            </p>
            <AnimatePresence>
              {lastGain && (
                <motion.span
                  key={lastGain.key}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -20 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  className="absolute top-1 right-3 text-xs font-black text-[#FFD75E] pointer-events-none"
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
          <div className="flex-1 rounded-2xl bg-white/10 px-4 py-2.5 text-center">
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-white/50">
              Терпение
            </p>
            <p className="text-lg leading-tight tracking-wider">
              {Array.from({ length: MAX_LIVES }, (_, i) => (i < lives ? '❤️' : '🖤')).join('')}
            </p>
          </div>
        </div>

        {/* Field */}
        <div
          ref={fieldRef}
          className="relative rounded-[2rem] bg-white/5 border border-white/10 overflow-hidden select-none touch-none"
          style={{ aspectRatio: '4 / 5' }}
          onPointerDown={(e) => moveToPointer(e.clientX)}
          onPointerMove={(e) => e.buttons > 0 && moveToPointer(e.clientX)}
        >
          {/* Падающие предметы */}
          {items.map((it) => (
            <span
              key={it.id}
              className="absolute text-2xl pointer-events-none"
              style={{
                left: `${it.x}%`,
                top: `${it.y}%`,
                transform: 'translate(-50%, -50%)',
                filter: it.kind === 'trap' ? 'drop-shadow(0 0 8px rgba(244,63,94,0.6))' : 'drop-shadow(0 0 8px rgba(255,215,94,0.5))',
              }}
            >
              {it.emoji}
            </span>
          ))}

          {/* Копилка */}
          <div
            className="absolute pointer-events-none text-4xl"
            style={{
              left: `${paddleX}%`,
              top: `${CATCH_ZONE_Y + 4}%`,
              transform: 'translate(-50%, -50%)',
              width: `${PADDLE_WIDTH}%`,
              textAlign: 'center',
              filter: 'drop-shadow(0 0 12px rgba(255,122,0,0.7))',
            }}
          >
            🐷
          </div>

          {/* Start / Pause / Game over */}
          <AnimatePresence>
            {(!running || over || paused) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-[2rem] bg-[#0A1A12]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10"
              >
                <p className="text-3xl">{over ? '💸' : paused ? '⏸️' : '🐷'}</p>
                <p className="text-xl font-sans font-extrabold text-white text-center px-6">
                  {over
                    ? `Импульсивные траты победили: ${capital.toLocaleString('ru-RU')} ₽`
                    : paused
                      ? 'Пауза'
                      : 'Монета +25 ₽ · купюра +100 ₽ · трата −❤️'}
                </p>
                <button
                  type="button"
                  onClick={paused ? togglePause : restart}
                  className="px-8 h-12 rounded-2xl bg-gradient-to-r from-[#FF7A00] to-[#FFA011] text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2 active:scale-95"
                >
                  <Play className="w-4 h-4" />
                  {over ? 'Ещё раз' : paused ? 'Продолжить' : 'Старт'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Экранные кнопки — управление пальцем на телефоне */}
        <div className="flex justify-center gap-3 mt-5 md:hidden">
          {(['left', 'right'] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-label={side === 'left' ? 'Влево' : 'Вправо'}
              className="h-14 w-24 rounded-2xl bg-white/10 text-white flex items-center justify-center active:bg-[#FF7A00] active:scale-95 transition-all"
              onPointerDown={() => holdPad(side, true)}
              onPointerUp={() => holdPad(side, false)}
              onPointerLeave={() => holdPad(side, false)}
            >
              {side === 'left' ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
