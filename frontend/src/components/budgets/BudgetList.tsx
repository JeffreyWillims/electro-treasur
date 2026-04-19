import { BudgetEnvelopes } from '@/components/dashboard/BudgetEnvelopes';
import { SafeToSpend } from '@/components/dashboard/SafeToSpend';
export function BudgetList() {
  return (
    <div className="max-w-7xl mx-auto space-y-12 px-6 md:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#1C3F35] dark:text-emerald-50 tracking-tight mb-4" style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.05)" }}>Бюджеты</h1>
          <p className="text-[9px] font-mono text-[#1C3F35] dark:text-emerald-400 uppercase tracking-[0.3em] font-bold">
            Система конвертов
          </p>
        </div>
      </div>

      <div>
        <SafeToSpend />
      </div>

      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#1C3F35] dark:text-emerald-50 tracking-tight mb-4" style={{ textShadow: "1px 1px 0px rgba(255,255,255,0.8), -1px -1px 0px rgba(0,0,0,0.05)" }}>Конверты {new Date().toLocaleString('ru', { month: 'long' })}</h2>
            <p className="text-[10px] font-mono text-[#1C3F35]/70 dark:text-emerald-400/70 uppercase tracking-widest mt-2 font-bold">
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
