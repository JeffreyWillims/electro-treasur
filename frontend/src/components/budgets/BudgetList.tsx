import { BudgetEnvelopes } from '@/components/dashboard/BudgetEnvelopes';
import { SafeToSpend } from '@/components/dashboard/SafeToSpend';
export function BudgetList() {
  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-premium text-4xl mb-2 tracking-tighter">Бюджеты</h1>
          <p className="text-[10px] font-mono text-aura-gold uppercase tracking-[0.3em] font-bold">
            Система конвертов
          </p>
        </div>
        <button className="btn-primary text-xs px-6 py-2.5 shadow-glow-emerald">
          Новый бюджет
        </button>
      </div>

      <div className="mb-12">
        <SafeToSpend />
      </div>

      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-premium text-2xl">Конверты {new Date().toLocaleString('ru', { month: 'long' })}</h2>
            <p className="text-[10px] font-mono text-aura-gold/60 uppercase tracking-widest mt-1">
              Актуальные лимиты и перерасходы
            </p>
          </div>
        </div>
        
        {/* We reuse the premium BudgetEnvelopes component from the Dashboard here */}
        <BudgetEnvelopes />
      </div>
    </div>
  );
}
