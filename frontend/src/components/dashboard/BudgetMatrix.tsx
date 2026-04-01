/**
 * BudgetMatrix — responsive table: Category → Plan → Fact → Delta.
 * Highlights overspend (negative delta) in red.
 */
import { Card } from '@/components/ui/Card';
import { BUDGET_ROWS } from '@/data/mockData';
import { cn } from '@/lib/utils';

export function BudgetMatrix() {
  return (
    <Card className="animate-slide-up overflow-x-auto">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        Бюджет: План vs Факт
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border">
            <th className="text-left py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Category
            </th>
            <th className="text-right py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Net Amount
            </th>
            <th className="text-right py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Total Out
            </th>
            <th className="text-right py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Total In
            </th>
          </tr>
        </thead>
        <tbody>
          {BUDGET_ROWS.map((row) => {
            const delta = parseFloat(row.delta);
            return (
              <tr
                key={row.category_id}
                className="border-b border-surface-border/50 hover:bg-surface-muted transition-colors"
              >
                <td className="py-3 px-2 font-medium text-slate-700">
                  {row.category_name}
                </td>
                <td
                  className={cn(
                    'py-3 px-2 text-right font-semibold',
                    delta >= 0 ? 'text-income' : 'text-expense',
                  )}
                >
                  {delta >= 0 ? '+' : ''}
                  ₽{row.delta}
                </td>
                <td className="py-3 px-2 text-right text-slate-600">
                  ₽{row.fact}
                </td>
                <td className="py-3 px-2 text-right text-slate-600">
                  ₽{row.planned}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
