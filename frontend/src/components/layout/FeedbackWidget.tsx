import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);

  // 💎 Эталонные стили для полей ввода (как в QuickEntry и настройках)
  const inputWrapperStyle = cn(
    "w-full rounded-2xl p-4 transition-all duration-300 outline-none text-sm font-bold text-[#1C3F35] dark:text-white placeholder-[#1C3F35]/30 dark:placeholder-white/30",
    "bg-black/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-transparent",
    "dark:bg-black/40 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
    "focus:bg-white focus:shadow-md focus:border-[#FF7A00]/50",
    "dark:focus:bg-[#1A1A1A] dark:focus:shadow-none dark:focus:border-[#FF7A00]/50"
  );

  const labelStyle = "block mb-2 text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#1C3F35]/50 dark:text-white/40";

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 z-50 bg-gradient-to-r from-[#FF7A00] to-[#FFA011] text-white w-14 h-14 rounded-full shadow-[0_10px_30px_-5px_rgba(255,122,0,0.4)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300"
      >
        {isOpen ? <X className="w-6 h-6" /> : (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white animate-[spin_6s_linear_infinite]">
            <path d="M12 2L2 12L12 22L22 12L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M12 6L6 12L12 18L18 12L12 6Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" opacity="0.6"/>
          </svg>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-28 right-8 w-80 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-6 z-50"
          >
            {/* ── HEADER ── */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white leading-none">
                  Написать нам
                </h3>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#FF7A00]">
                  Обратная связь
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 shrink-0 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#1C3F35]/50 dark:text-white/50 hover:bg-black/10 dark:hover:bg-white/10 hover:text-[#FF7A00] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* ── EMAIL (Read Only) ── */}
              <div>
                <label className={labelStyle}>Кому</label>
                <input
                  value="ninjacodex333@gmail.com"
                  readOnly
                  className={cn(
                    inputWrapperStyle,
                    "h-12 py-0 text-[#1C3F35]/50 dark:text-white/40 cursor-not-allowed focus:bg-transparent focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] focus:border-transparent dark:focus:bg-black/40 dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]"
                  )}
                />
              </div>

              {/* ── TEXTAREA ── */}
              <div>
                <label className={labelStyle}>Сообщение</label>
                <textarea
                  placeholder="Ваша идея или вопрос..."
                  className={cn(inputWrapperStyle, "h-28 resize-none")}
                />
              </div>
            </div>

            {/* ── SUBMIT BUTTON ── */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-full h-14 bg-gradient-to-r from-[#FF7A00] to-[#FFA011] hover:from-[#EA6A00] hover:to-[#FF7A00] text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-[0_10px_30px_-5px_rgba(255,122,0,0.4)] transition-all flex items-center justify-center active:scale-[0.98]"
            >
              Отправить
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}