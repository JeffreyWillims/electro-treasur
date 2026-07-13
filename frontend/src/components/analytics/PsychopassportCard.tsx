/**
 * PsychopassportCard.tsx — «Психопаспорт» финансовой персоны.
 * Рендерит persona_title, traits (чипсы) и recommendations (список действий).
 * Возвращает null, если psychopassport отсутствует.
 */
import type { Psychopassport } from '@/api/client';

interface Props {
  psychopassport?: Psychopassport | null;
}

export function PsychopassportCard({ psychopassport }: Props) {
  if (!psychopassport) return null;

  const { persona_title, traits, recommendations } = psychopassport;

  return (
    <div className="bg-gradient-to-br from-[#1C3F35]/[0.06] to-[#FF7A00]/[0.04] border border-[#1C3F35]/10 dark:border-emerald-500/20 rounded-[2.5rem] p-8 md:p-10 shadow-lg">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">🧬</span>
        <div>
          <p className="text-[10px] font-sans font-extrabold uppercase tracking-wide text-[#FF7A00]">
            Психопаспорт
          </p>
          <h2 className="text-lg md:text-xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white">
            {persona_title}
          </h2>
        </div>
      </div>

      {traits.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {traits.map((trait, i) => (
            <span
              key={i}
              className="px-3 py-1.5 rounded-full text-xs md:text-sm font-sans font-bold text-[#1C3F35] dark:text-emerald-300 bg-[#1C3F35]/[0.06] dark:bg-emerald-500/10 border border-[#1C3F35]/10 dark:border-emerald-500/20"
            >
              {trait}
            </span>
          ))}
        </div>
      )}

      {recommendations.length > 0 && (
        <ul className="space-y-3">
          {recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-[#FF7A00] mt-0.5 flex-shrink-0">→</span>
              <span className="text-sm md:text-base font-sans font-medium text-[#1C3F35]/90 dark:text-white/85 leading-relaxed">
                {rec}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
