import { BudgetEnvelopes } from '@/components/dashboard/BudgetEnvelopes';
import { SafeToSpend } from '@/components/dashboard/SafeToSpend';
export function BudgetList() {
  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#1C3F35] dark:text-[#FDFBF7] font-bold mb-3 tracking-tighter">Бюджеты</h1>
          <p className="text-[10px] font-mono text-[#FF7A00] uppercase tracking-[0.3em] font-bold">
            Система конвертов
          </p>
        </div>
        <button className="bg-[#FF7A00] text-white hover:bg-[#EA6A00] shadow-[0_0_20px_rgba(255,122,0,0.3)] transition-all font-bold tracking-wide uppercase text-xs px-8 py-3 rounded-2xl">
          Новый бюджет
        </button>
      </div>

      <div className="mb-12">
        <SafeToSpend />
      </div>

      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-serif text-[#1C3F35] dark:text-[#FDFBF7] font-bold tracking-tight">Конверты {new Date().toLocaleString('ru', { month: 'long' })}</h2>
            <p className="text-[10px] font-mono text-[#FF7A00]/70 uppercase tracking-widest mt-2 font-bold">
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
