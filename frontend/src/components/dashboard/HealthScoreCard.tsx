/**
 * HealthScoreCard — индекс финансового здоровья 0–100 (считается на сервере,
 * без LLM): норма сбережений, прогресс целей, соблюдение бюджетов.
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HeartPulse } from 'lucide-react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import { fetchHealthScore, type HealthFactor } from '@/api/client';

function color(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#FF7A00';
  if (score >= 40) return '#F59E0B';
  return '#F43F5E';
}

function Ring({ score }: { score: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const target = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  const tint = color(score);
  return (
    <svg viewBox="0 0 120 120" className="w-36 h-36 -rotate-90">
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        strokeWidth="11"
        className="stroke-black/10 dark:stroke-white/10"
      />
      <motion.circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        strokeWidth="11"
        strokeLinecap="round"
        stroke={tint}
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: target }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ filter: `drop-shadow(0 0 7px ${tint}99)` }}
      />
    </svg>
  );
}

function FactorBar({ f, index }: { f: HealthFactor; index: number }) {
  const tint = color(f.score);
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + index * 0.1, duration: 0.4, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-bold text-[#1C3F35]/70 dark:text-white/60">{f.name}</span>
        <span className="tabular-nums font-black" style={{ color: tint }}>
          {f.score}
          <span className="ml-0.5 text-[10px] font-bold opacity-60">/ 100</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${f.score}%` }}
          transition={{ delay: 0.25 + index * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: `linear-gradient(90deg, ${tint}, ${tint}bb)`,
            boxShadow: `0 0 10px ${tint}66`,
          }}
        />
      </div>
      <p className="text-[10px] text-[#1C3F35]/45 dark:text-white/35 mt-1.5">{f.detail}</p>
    </motion.div>
  );
}

export function HealthScoreCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['healthScore'],
    queryFn: fetchHealthScore,
    staleTime: 60_000,
  });

  // Плавный «набегающий» счётчик балла — деньги любят движение.
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22 });
  const display = useTransform(spring, (v) => Math.round(v).toString());

  useEffect(() => {
    if (data) mv.set(data.score);
  }, [data, mv]);

  if (isLoading || !data) return null;

  const tint = color(data.score);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[2.5rem] border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-6 md:p-8 shadow-lg"
    >
      {/* Живой денежный «ореол» на фоне — дышит под цвет здоровья */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${tint}33 0%, transparent 70%)` }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex items-center gap-3 mb-6">
        <span className="w-9 h-9 rounded-xl bg-[#FF7A00]/10 flex items-center justify-center">
          <HeartPulse className="w-5 h-5 text-[#FF7A00]" />
        </span>
        <h2 className="text-lg font-sans font-extrabold text-[#1C3F35] dark:text-white">
          Финансовое здоровье
        </h2>
      </div>

      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
        <div className="shrink-0 flex flex-col items-center gap-2">
          <div className="relative flex items-center justify-center">
            <Ring score={data.score} />
            <div className="absolute flex flex-col items-center">
              <motion.span
                className="text-5xl font-sans font-black tabular-nums text-[#1C3F35] dark:text-white leading-none"
                style={{ textShadow: `0 0 22px ${tint}55` }}
              >
                {display}
              </motion.span>
              <span className="mt-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#1C3F35]/40 dark:text-white/40">
                из 100
              </span>
            </div>
          </div>
          {/* Оценка — под кольцом: длинные ярлыки («Требует внимания») больше не вылезают */}
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wide whitespace-nowrap"
            style={{ color: tint, background: `${tint}1a` }}
          >
            {data.grade}
          </motion.span>
        </div>

        <div className="flex-1 w-full space-y-4">
          {data.factors.map((f, i) => (
            <FactorBar key={f.name} f={f} index={i} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
