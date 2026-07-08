/**
 * HealthScoreCard — индекс финансового здоровья 0–100 (считается на сервере,
 * без LLM): норма сбережений, прогресс целей, соблюдение бюджетов.
 */
import { useQuery } from '@tanstack/react-query';
import { HeartPulse } from 'lucide-react';
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
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-black/10 dark:stroke-white/10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        stroke={color(score)}
        strokeDasharray={`${dash} ${c}`}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

function FactorBar({ f }: { f: HealthFactor }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-bold text-[#1C3F35]/70 dark:text-white/60">{f.name}</span>
        <span className="tabular-nums font-extrabold" style={{ color: color(f.score) }}>
          {f.score}
        </span>
      </div>
      <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${f.score}%`, background: color(f.score) }}
        />
      </div>
      <p className="text-[10px] text-[#1C3F35]/45 dark:text-white/35 mt-1">{f.detail}</p>
    </div>
  );
}

export function HealthScoreCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['healthScore'],
    queryFn: fetchHealthScore,
    staleTime: 60_000,
  });

  if (isLoading || !data) return null;

  return (
    <section className="rounded-[2.5rem] border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-6 md:p-8">
      <div className="flex items-center gap-3 mb-5">
        <HeartPulse className="w-5 h-5 text-[#FF7A00]" />
        <h2 className="text-lg font-sans font-extrabold text-[#1C3F35] dark:text-white">
          Финансовое здоровье
        </h2>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative shrink-0 flex items-center justify-center">
          <Ring score={data.score} />
          <div className="absolute flex flex-col items-center">
            <span className="text-4xl font-sans font-black tabular-nums text-[#1C3F35] dark:text-white leading-none">
              {data.score}
            </span>
            <span
              className="text-[11px] font-extrabold uppercase tracking-wide mt-1"
              style={{ color: color(data.score) }}
            >
              {data.grade}
            </span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-4">
          {data.factors.map((f) => (
            <FactorBar key={f.name} f={f} />
          ))}
        </div>
      </div>
    </section>
  );
}
