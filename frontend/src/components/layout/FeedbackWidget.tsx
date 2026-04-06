import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Feather, X } from 'lucide-react';

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 z-50 bg-[#FF7A00] text-white w-14 h-14 rounded-full shadow-2xl shadow-[#FF7A00]/20 flex items-center justify-center hover:scale-110 hover:bg-[#EA6A00] transition-all duration-300"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Feather className="w-6 h-6" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-8 w-80 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-6 z-50"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Написать нам</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <input 
              value="support@citrinevault.com" 
              readOnly 
              className="w-full bg-slate-100 text-slate-500 text-sm p-3 rounded-lg mb-4 outline-none" 
            />
            
            <textarea 
              placeholder="Ваша идея или вопрос..." 
              className="w-full bg-white border border-slate-200 p-3 rounded-lg h-24 resize-none outline-none focus:border-emerald-500 text-slate-900 mb-4"
            ></textarea>
            
            <button 
              onClick={() => setIsOpen(false)}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              Отправить
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
