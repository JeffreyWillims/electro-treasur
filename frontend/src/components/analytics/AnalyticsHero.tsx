/**
 * AnalyticsHero — четыре ключевые цифры вверху аналитики.
 *
 * Экран начинался с калькулятора покупки и графиков, но не отвечал на первый
 * вопрос «как у меня дела». Здесь он закрывается за секунду. Капитал приходит
 * с бэка (total_balance_all_time) и раньше нигде не показывался.
 */
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';

interface Props {
  capital: number;
  income: number;
  expense: number;
}

/** Плавный счётчик — число «доезжает» до значения, а не появляется рывком. */
function AnimatedNumber({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 100, damping: 30, restDelta: 0.5 });
  const text = useTransform(spring, (current) => Math.round(current).toLocaleString('ru-RU'));

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return <motion.span>{text}</motion.span>;
}

export function AnalyticsHero({ capital, income, expense }: Props) {
  const savingsRate = income > 0 ? (income - expense) / income : 0;

  const tiles = [
    {
      label: 'Капитал',
      icon: Wallet,
      value: <AnimatedNumber value={capital} />,
      suffix: '₽',
      tint: 'text-[#1C3F35] dark:text-white',
      glow: 'bg-[#1C3F35]/10 dark:bg-white/10',
    },
    {
      label: 'Доход',
      icon: TrendingUp,
      value: <AnimatedNumber value={income} />,
      suffix: '₽',
      tint: 'text-emerald-600 dark:text-emerald-400',
      glow: 'bg-emerald-500/10',
    },
    {
      label: 'Расход',
      icon: TrendingDown,
      value: <AnimatedNumber value={expense} />,
      suffix: '₽',
      tint: 'text-rose-600 dark:text-rose-500',
      glow: 'bg-rose-500/10',
    },
    {
      label: 'Норма сбережений',
      icon: PiggyBank,
      value: <>{Math.round(savingsRate * 100)}</>,
      suffix: '%',
      tint: savingsRate >= 0 ? 'text-[#FF7A00]' : 'text-rose-600 dark:text-rose-500',
      glow: 'bg-[#FF7A00]/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.45, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-[2rem] border border-black/5 dark:border-white/10 bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl p-5 md:p-6 shadow-lg"
        >
          <div className={`absolute -top-8 -right-6 w-24 h-24 rounded-full blur-2xl ${tile.glow}`} />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <tile.icon className={`w-4 h-4 ${tile.tint} opacity-70`} />
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#1C3F35]/45 dark:text-white/40">
                {tile.label}
              </p>
            </div>
            <p
              className={`flex items-baseline gap-1.5 font-sans font-black tabular-nums tracking-tighter leading-none ${tile.tint}`}
            >
              <span className="text-2xl md:text-3xl">{tile.value}</span>
              <span className="text-sm font-bold opacity-40">{tile.suffix}</span>
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
