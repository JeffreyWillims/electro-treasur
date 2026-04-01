import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchDashboard, fetchCategories } from '@/api/client';
import type { CategoryRowSchema, CategoryRead } from '@/types';

function createChartData(dashboard: { rows: CategoryRowSchema[] } | undefined, categories: CategoryRead[]) {
  if (!dashboard || !dashboard.rows.length) return [];

  // Categorize rows into income and expense
  const incomeIds = new Set(categories.filter(c => c.type === 'income').map(c => c.id));
  const expenseIds = new Set(categories.filter(c => c.type === 'expense').map(c => c.id));

  // Initialize day arrays
  const days = Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    income: 0,
    expense: 0,
  }));

  dashboard.rows.forEach(row => {
    const isIncome = incomeIds.has(row.category_id);
    const isExpense = expenseIds.has(row.category_id) || (!isIncome);

    row.days.forEach(dayCell => {
      const idx = dayCell.day - 1;
      const amt = parseFloat(dayCell.amount) || 0;
      if (idx >= 0 && idx < 31) {
        if (isIncome) days[idx].income += amt;
        if (isExpense) days[idx].expense += amt;
      }
    });
  });

  return days;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 dark:bg-aura-graphite/90 backdrop-blur-md border border-aura-gold/20 p-4 rounded-xl shadow-premium">
        <p className="text-[10px] font-mono text-aura-gold/80 mb-2 uppercase font-bold">{label} Число</p>
        <div className="space-y-1 text-sm font-semibold tracking-tight">
          <p className="text-aura-emerald">
            + {(payload[0]?.value ?? 0).toLocaleString('ru-RU')} ₽ <span className="text-[10px] font-normal opacity-70 ml-1">поступления</span>
          </p>
          <p className="text-expense">
            - {(payload[1]?.value ?? 0).toLocaleString('ru-RU')} ₽ <span className="text-[10px] font-normal opacity-70 ml-1">траты</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function SpendingChart() {
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => fetchDashboard(new Date().getMonth() + 1, new Date().getFullYear()),
  });

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const chartData = useMemo(
    () => createChartData(dashboard, categories),
    [dashboard, categories]
  );
  
  const isLoading = dashLoading || catLoading;

  if (isLoading) {
    return (
      <div className="premium-card p-8 h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-aura-gold/20 border-t-aura-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="premium-card p-8 group">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h3 className="text-premium text-2xl leading-none">Ликвидность</h3>
          <p className="text-[10px] font-mono text-aura-gold/60 uppercase tracking-[0.15em] mt-2">
            Денежные потоки
          </p>
        </div>
      </div>

      <div className="h-[280px] w-full mt-4">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-aura-gold/30 font-serif italic text-sm">
            Нет данных для графика
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2A6041" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2A6041" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c0392b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#c0392b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(197, 160, 89, 0.08)" />
              <XAxis 
                dataKey="day" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
                tickMargin={12}
                fontFamily="Space Mono"
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
                tickFormatter={(value) => value >= 1000 ? (value / 1000) + 'k' : value}
                tickMargin={12}
                fontFamily="Space Mono"
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(197, 160, 89, 0.2)', strokeWidth: 1 }} />
              <Area 
                type="monotone" 
                dataKey="income" 
                stroke="#2A6041" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorIncome)" 
              />
              <Area 
                type="monotone" 
                dataKey="expense" 
                stroke="#c0392b" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorExpense)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
