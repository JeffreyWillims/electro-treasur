import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchDashboard } from '@/api/client';
import type { CategoryRowSchema } from '@/types';

const COLORS = [
  '#2A6041', // emerald
  '#C5A059', // gold
  '#1A1A1A', // graphite-light
  '#3A7A57', // emerald-light
  '#D4B46E', // gold-light
  '#C0392B', // expense
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-[#1A1A1A]/90 backdrop-blur-md border border-aura-gold/20 dark:border-white/5 px-5 py-3 rounded-2xl shadow-premium">
        <p className="text-[10px] font-mono text-aura-gold/80 mb-1 uppercase font-bold tracking-widest">{payload[0].name}</p>
        <p className="text-xl font-serif tracking-tight font-semibold text-aura-graphite dark:text-aura-ivory">
          {payload[0].value.toLocaleString('ru-RU')} <span className="text-xs text-aura-gold ml-0.5">₽</span>
        </p>
      </div>
    );
  }
  return null;
};

export function CategoryPieChart({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', startDate, endDate],
    queryFn: () => fetchDashboard(startDate, endDate),
  });

  if (isLoading) {
    return (
      <div className="premium-card p-8 h-[400px] flex items-center justify-center bg-white dark:bg-[#121212]/80 border dark:border-white/5 transition-colors duration-700">
        <div className="w-8 h-8 border-2 border-aura-gold/20 border-t-aura-gold rounded-full animate-spin" />
      </div>
    );
  }

  // Generate chart data by extracting total facts from ALL rows
  // To keep it clean, let's filter rows that have a fact > 0 and sort descending
  const rawData = dashboard?.rows
    .map((r: CategoryRowSchema) => ({
      name: r.category_name,
      value: parseFloat(r.fact)
    }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value) || [];

  return (
    <div className="premium-card p-8 relative overflow-hidden group bg-white dark:bg-[#121212]/80 border dark:border-white/5 shadow-premium dark:shadow-[0_8px_30_rgba(0,0,0,0.8)] transition-all duration-700">
      {/* Decorative gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-5 bg-[radial-gradient(circle,_var(--aura-gold)_0%,_transparent_70%)] pointer-events-none transition-opacity duration-700 group-hover:opacity-10" />

      <div className="flex items-start justify-between mb-8 relative z-10">
        <div>
          <h3 className="text-premium text-2xl leading-none">Капитал</h3>
          <p className="text-[10px] font-mono text-aura-gold/60 uppercase tracking-[0.15em] mt-2">
            Структура потоков
          </p>
        </div>
      </div>

      <div className="h-[280px] w-full relative z-10">
        {rawData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-aura-graphite/40 dark:text-aura-ivory/30 font-serif italic text-sm">
            Нет данных для анализа структуры
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rawData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={105}
                paddingAngle={4}
                dataKey="value"
                stroke="transparent"
              >
                {rawData.map((_, index) => (
                  <Cell 
                    key={'cell-' + index} 
                    fill={COLORS[index % COLORS.length]} 
                    className="hover:opacity-80 transition-opacity duration-300 outline-none"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Modern Legend */}
      <div className="mt-4 pt-4 border-t border-aura-gold/[0.08] relative z-10">
        <ul className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6">
          {rawData.slice(0, 6).map((entry, index) => (
            <li key={`legend-${index}`} className="flex items-center gap-2 group/legend cursor-default">
              <span 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }} 
              />
              <span className="text-xs font-semibold text-aura-graphite/80 dark:text-aura-ivory/80 truncate group-hover/legend:text-aura-graphite dark:group-hover/legend:text-aura-ivory transition-colors">
                {entry.name}
              </span>
            </li>
          ))}
          {rawData.length > 6 && (
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-aura-gold/20" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-aura-gold/50">+{rawData.length - 6} еще</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
