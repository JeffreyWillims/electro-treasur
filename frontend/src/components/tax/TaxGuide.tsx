/**
 * TaxGuide — бесплатный справочник «Налоги и вычеты» с умным поиском (Postgres FTS).
 *
 * Пользователь пишет запрос («вычет за лечение», «продал квартиру», «ИИС») —
 * сервер возвращает релевантные нормы, ранжированные по ts_rank. Без LLM.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, BookOpen, Scale, Sparkles } from 'lucide-react';
import { searchTaxRules, fetchTaxCategories, type TaxRule } from '@/api/client';

const SUGGESTIONS = ['вычет за лечение', 'покупка квартиры', 'продал машину', 'ИИС', 'самозанятый'];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function TaxGuide() {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const debounced = useDebounced(query, 300);

  const { data: categories = [] } = useQuery({
    queryKey: ['taxCategories'],
    queryFn: fetchTaxCategories,
    staleTime: 10 * 60_000,
  });

  const { data: rules = [], isFetching } = useQuery({
    queryKey: ['taxSearch', debounced],
    queryFn: () => searchTaxRules(debounced),
    staleTime: 60_000,
  });

  const visible = useMemo(
    () => (activeCat ? rules.filter((r) => r.category === activeCat) : rules),
    [rules, activeCat],
  );

  return (
    <div className="max-w-4xl mx-auto pt-12 pb-24 px-4">
      {/* Hero */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF7A00] to-[#FFB020] flex items-center justify-center shadow-lg shadow-[#FF7A00]/20">
          <Scale className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-[2rem] font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
            Налоги и вычеты
          </h1>
          <p className="text-xs font-sans text-[#1C3F35]/50 dark:text-white/40 mt-1.5">
            Бесплатный справочник · верните деньги, которые вам положены
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mt-8 relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1C3F35]/40 dark:text-white/40" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Спросите: «вычет за обучение», «продажа квартиры»…"
          className="w-full rounded-2xl bg-white/70 dark:bg-white/5 border border-black/10 dark:border-white/10 pl-13 pr-5 py-4 text-base outline-none focus:ring-2 ring-[#FF7A00]/40 text-[#1C3F35] dark:text-white"
          style={{ paddingLeft: '3.25rem' }}
        />
      </div>

      {/* Suggestions (when empty) */}
      {!query && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs font-bold text-[#1C3F35]/40 dark:text-white/40 self-center flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Популярное:
          </span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setQuery(s)}
              className="px-3 py-1.5 rounded-full bg-[#FF7A00]/10 text-[#FF7A00] text-xs font-bold hover:bg-[#FF7A00]/20 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Chip label="Все" active={activeCat === null} onClick={() => setActiveCat(null)} />
          {categories.map((c) => (
            <Chip key={c} label={c} active={activeCat === c} onClick={() => setActiveCat(c)} />
          ))}
        </div>
      )}

      {/* Results */}
      <div className="mt-6 space-y-3">
        {visible.length === 0 && !isFetching && (
          <div className="py-16 text-center text-[#1C3F35]/50 dark:text-white/40">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-bold">Ничего не нашлось</p>
            <p className="text-sm mt-1">Попробуйте переформулировать запрос</p>
          </div>
        )}
        {visible.map((rule, i) => (
          <RuleCard key={rule.id} rule={rule} index={i} />
        ))}
      </div>

      <p className="mt-10 text-[11px] text-[#1C3F35]/40 dark:text-white/30 text-center">
        Справочно, не индивидуальная консультация. Актуальные лимиты — на nalog.gov.ru
      </p>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
        active
          ? 'bg-[#1C3F35] dark:bg-[#FF7A00] text-white'
          : 'bg-black/5 dark:bg-white/10 text-[#1C3F35]/60 dark:text-white/50 hover:bg-black/10'
      }`}
    >
      {label}
    </button>
  );
}

function RuleCard({ rule, index }: { rule: TaxRule; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="rounded-3xl bg-white/70 dark:bg-white/5 border border-black/5 dark:border-white/10 p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="px-2.5 py-1 rounded-full bg-[#FF7A00]/10 text-[#FF7A00] text-[10px] font-extrabold uppercase tracking-wide">
          {rule.category}
        </span>
        {rule.source && (
          <span className="text-[11px] font-mono text-[#1C3F35]/40 dark:text-white/30">
            {rule.source}
          </span>
        )}
      </div>
      <h3 className="text-lg font-sans font-extrabold text-[#1C3F35] dark:text-white">
        {rule.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[#1C3F35]/80 dark:text-white/70">
        {rule.body}
      </p>
    </motion.div>
  );
}
