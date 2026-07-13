import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Target, Trash2, Plus } from 'lucide-react';
import { fetchGoals, contributeGoal, deleteGoal, fetchDashboard, type GoalDto } from '@/api/client';
import { getLocalDateString, getMoscowDate } from '@/lib/dateUtils';

const fmt = (v: string) => Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 0 });

function GoalCard({ goal, recommended }: { goal: GoalDto; recommended: number }) {
  const queryClient = useQueryClient();
  // null = пользователь ещё не трогал поле → автоподстановка рекомендуемой суммы.
  const [amount, setAmount] = useState<string | null>(null);
  const value = amount ?? (recommended > 0 ? String(recommended) : '');
  const isRecommended = amount === null && recommended > 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    // Взнос создаёт расходную транзакцию «Цель: …» — обновляем расходы и операции.
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  const contribute = useMutation({
    mutationFn: () => contributeGoal(goal.id, value),
    onSuccess: () => {
      setAmount('');
      invalidate();
      toast.success('Пополнение зачтено');
    },
    onError: (e: Error) => toast.error(`Ошибка: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: () => deleteGoal(goal.id),
    onSuccess: () => {
      invalidate();
      toast.success(`Цель «${goal.name}» удалена`);
    },
    onError: (e: Error) => toast.error(`Ошибка: ${e.message}`),
  });

  const done = goal.progress_pct >= 100;

  return (
    <div className="rounded-3xl border border-[#FF7A00]/20 bg-white/60 dark:bg-white/5 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-sans font-extrabold text-[#1C3F35] dark:text-white">{goal.name}</p>
          <p className="text-xs text-[#1C3F35]/60 dark:text-white/50">
            {fmt(goal.current_amount)} / {fmt(goal.target_amount)} ₽
            {goal.monthly_plan && ` · план ${fmt(goal.monthly_plan)} ₽/мес`}
            {goal.target_date && ` · до ${goal.target_date}`}
          </p>
        </div>
        <button
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          className="text-[#1C3F35]/40 hover:text-rose-500 transition-colors"
          aria-label="Удалить цель"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-[#FF7A00]'}`}
          style={{ width: `${goal.progress_pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-bold text-[#FF7A00]">{goal.progress_pct}%</span>
        <span className="text-xs text-[#1C3F35]/60 dark:text-white/50">
          {done ? 'Цель достигнута ✓' : `осталось ${fmt(goal.remaining)} ₽`}
        </span>
      </div>

      {!done && (
        <>
          <form
            className="flex items-center gap-2 mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!value) return toast.error('Введите сумму пополнения');
              contribute.mutate();
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="Пополнить, ₽"
              className="flex-1 min-w-0 rounded-full bg-black/5 dark:bg-white/10 px-4 py-2 text-sm outline-none focus:ring-2 ring-[#FF7A00]/40"
            />
            <button
              type="submit"
              disabled={contribute.isPending}
              className="flex items-center gap-1 bg-[#1C3F35] dark:bg-[#FF7A00] text-white text-sm font-semibold py-2 px-4 rounded-full active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Внести
            </button>
          </form>
          {isRecommended && (
            <p className="mt-1.5 ml-4 text-[10px] font-bold uppercase tracking-wide text-[#FF7A00]/80">
              рекомендовано от свободных средств
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function GoalsProgress() {
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: fetchGoals,
    staleTime: 60_000,
  });

  // Свободные средства месяца (МСК-границы, общий кеш ['dashboard', start, end]).
  const d = getMoscowDate();
  const start = getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
  const end = getLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', start, end],
    queryFn: () => fetchDashboard(start, end),
  });

  // Рекомендуемый взнос: 10% от свободных денег месяца, не меньше 0, до сотен.
  const free =
    (parseFloat(dashboard?.period_income ?? '0') || 0) -
    (parseFloat(dashboard?.period_expense ?? '0') || 0);
  const recommended = Math.max(0, Math.round((free * 0.1) / 100) * 100);

  if (isLoading || goals.length === 0) return null; // hidden until the user sets a goal

  return (
    <section className="rounded-[2.5rem] border border-[#FF7A00]/20 bg-gradient-to-br from-[#FF7A00]/5 to-transparent p-6 md:p-8">
      <div className="flex items-center gap-3 mb-5">
        <Target className="w-5 h-5 text-[#FF7A00]" />
        <h2 className="text-lg font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white">
          Мои цели
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} recommended={recommended} />
        ))}
      </div>
    </section>
  );
}
