/**
 * DeductionCalculator — «введи сумму → сколько вернёшь». Чистый расчёт на сервере
 * (13% с базы в пределах лимита и уплаченного НДФЛ), без LLM.
 */
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Wallet } from 'lucide-react';
import { fetchDeductionKinds, calcDeduction, type DeductionResult } from '@/api/client';

const fmt = (v: string) => Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 });

export function DeductionCalculator({ onExplain }: { onExplain?: (q: string) => void }) {
  const { data: kinds = [] } = useQuery({
    queryKey: ['deductionKinds'],
    queryFn: fetchDeductionKinds,
    staleTime: 10 * 60_000,
  });

  const [kind, setKind] = useState('');
  const [amount, setAmount] = useState('');
  const [income, setIncome] = useState('');
  const [result, setResult] = useState<DeductionResult | null>(null);

  const activeKind = kind || kinds[0]?.kind || '';

  const calc = useMutation({
    mutationFn: () => calcDeduction(activeKind, amount || '0', income || undefined),
    onSuccess: setResult,
  });

  return (
    <div className="rounded-[2rem] bg-gradient-to-br from-[#1C3F35] to-[#0A1A12] dark:from-[#111] dark:to-[#0A0A0A] p-7 md:p-8 text-white shadow-xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-[#FF7A00]/20 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-[#FF7A00]" />
        </div>
        <div>
          <h2 className="text-lg font-sans font-extrabold">Калькулятор вычета</h2>
          <p className="text-[11px] text-white/50">Узнайте, сколько вернёт налоговая</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/50">Вид вычета</span>
          <select
            value={activeKind}
            onChange={(e) => {
              setKind(e.target.value);
              setResult(null);
            }}
            className="rounded-xl bg-white/10 px-4 py-3 text-sm outline-none focus:ring-2 ring-[#FF7A00]/50 [&>option]:text-black"
          >
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/50">Сумма расходов, ₽</span>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/\D/g, ''));
              setResult(null);
            }}
            placeholder="120 000"
            className="rounded-xl bg-white/10 px-4 py-3 text-sm outline-none focus:ring-2 ring-[#FF7A00]/50 placeholder:text-white/30"
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/50">
            Годовой доход, ₽ <span className="text-white/30 normal-case">— необязательно, ограничит возврат уплаченным НДФЛ</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={income}
            onChange={(e) => {
              setIncome(e.target.value.replace(/\D/g, ''));
              setResult(null);
            }}
            placeholder="напр. 900 000"
            className="rounded-xl bg-white/10 px-4 py-3 text-sm outline-none focus:ring-2 ring-[#FF7A00]/50 placeholder:text-white/30"
          />
        </label>
      </div>

      <button
        onClick={() => calc.mutate()}
        disabled={!activeKind || !amount || calc.isPending}
        className="mt-5 w-full py-3.5 rounded-2xl bg-[#FF7A00] hover:bg-[#FF7A00]/90 font-sans font-extrabold text-sm active:scale-[0.99] transition-transform disabled:opacity-40"
      >
        Рассчитать возврат
      </button>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 rounded-2xl bg-white/10 p-5 flex items-center gap-4">
              <Wallet className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/50">Вы вернёте</p>
                <p className="text-3xl font-sans font-black text-emerald-400 tabular-nums leading-none mt-0.5">
                  {fmt(result.refund)} ₽
                </p>
                <p className="text-xs text-white/60 mt-2">
                  С базы {fmt(result.eligible_base)} ₽ · {result.note}
                  {result.capped_by_income && ' · ограничено уплаченным НДФЛ'}
                </p>
                {onExplain && (
                  <button
                    onClick={() => onExplain(result.label)}
                    className="mt-3 text-xs font-bold text-[#FF7A00] hover:underline"
                  >
                    Как оформить вычет →
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
