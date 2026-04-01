/**
 * MonthlySummary — Total In / Total Out cards with mini bar charts.
 * Uses Recharts BarChart for the monthly daily breakdown.
 */
import { Card } from '@/components/ui/Card';
import { MONTHLY_SUMMARY } from '@/data/mockData';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis } from 'recharts';

export function MonthlySummary() {
  const { totalIn, totalOut, inChange, outChange, dailyData } = MONTHLY_SUMMARY;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
      {/* Total In */}
      <Card className="border-l-4 border-l-income">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Доходы (Март 2026)
        </p>
        <p className="text-3xl font-extrabold text-income mt-1">
          {totalIn.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
        </p>
        <div className="flex items-center gap-1 mt-1 text-xs">
          <TrendingDown className="w-3.5 h-3.5 text-expense" />
          <span className="text-expense font-medium">{Math.abs(inChange)}%</span>
        </div>
        <div className="mt-4 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData.slice(0, 15)}>
              <XAxis dataKey="day" hide />
              <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expense" fill="#c4b5fd" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Total Out */}
      <Card className="border-l-4 border-l-expense">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Расходы (Март 2026)
        </p>
        <p className="text-3xl font-extrabold text-expense mt-1">
          {totalOut.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
        </p>
        <div className="flex items-center gap-1 mt-1 text-xs">
          <TrendingUp className="w-3.5 h-3.5 text-expense" />
          <span className="text-expense font-medium">↑ {outChange}%</span>
        </div>
        <div className="mt-4 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData.slice(0, 15)}>
              <XAxis dataKey="day" hide />
              <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="income" fill="#fca5a5" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
