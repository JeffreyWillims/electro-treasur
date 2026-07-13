/**
 * VoiceInput — стеклянная кнопка-микрофон для голосового ввода операции.
 * Web Speech API (ru-RU) с жёстким лимитом записи 21 секунда; в браузерах
 * без поддержки честно сообщает об этом (интерфейс-заглушка по ТЗ).
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { toast } from 'sonner';

const RECORD_LIMIT_S = 21;

// Минимальная типизация Web Speech API — в lib.dom этих типов нет.
type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function createRecognizer(): Recognizer | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognizer;
    webkitSpeechRecognition?: new () => Recognizer;
  };
  const Impl = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Impl ? new Impl() : null;
}

export function VoiceInput({ onResult }: { onResult: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RECORD_LIMIT_S);
  const recRef = useRef<Recognizer | null>(null);
  const hardStopRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const transcriptRef = useRef('');

  const clearTimers = () => {
    if (hardStopRef.current) clearTimeout(hardStopRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    hardStopRef.current = null;
    tickRef.current = null;
  };

  useEffect(() => () => {
    clearTimers();
    recRef.current?.stop();
  }, []);

  const stop = () => recRef.current?.stop();

  const start = () => {
    const rec = createRecognizer();
    if (!rec) {
      toast.info('Голосовой ввод не поддерживается этим браузером — попробуйте Chrome.');
      return;
    }
    transcriptRef.current = '';
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.continuous = true;
    rec.onresult = (e) => {
      transcriptRef.current = Array.from(
        { length: e.results.length },
        (_, i) => e.results[i]?.[0]?.transcript ?? '',
      )
        .join(' ')
        .trim();
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') toast.error('Доступ к микрофону запрещён в браузере.');
    };
    rec.onend = () => {
      clearTimers();
      setRecording(false);
      recRef.current = null;
      const text = transcriptRef.current;
      if (text) onResult(text);
      else toast.info('Не расслышал — попробуйте ещё раз.');
    };
    recRef.current = rec;
    setSecondsLeft(RECORD_LIMIT_S);
    setRecording(true);
    rec.start();
    // Жёсткий лимит записи — 21 секунда.
    hardStopRef.current = window.setTimeout(() => rec.stop(), RECORD_LIMIT_S * 1000);
    tickRef.current = window.setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000,
    );
  };

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      aria-label={recording ? 'Остановить запись' : 'Голосовой ввод'}
      title={recording ? 'Остановить запись' : 'Продиктуйте операцию, например «500 кофе»'}
      className="relative ml-2 w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all bg-white/60 dark:bg-white/10 backdrop-blur border border-black/5 dark:border-white/10 shadow-sm hover:border-[#FF7A00]/50 hover:shadow-md active:scale-95"
    >
      <AnimatePresence mode="wait">
        {recording ? (
          <motion.span
            key="rec"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="flex items-center justify-center"
          >
            <Square className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="flex items-center justify-center"
          >
            <Mic className="w-[18px] h-[18px] text-[#FF7A00]" />
          </motion.span>
        )}
      </AnimatePresence>

      {recording && (
        <>
          {/* Пульсирующее кольцо записи */}
          <motion.span
            className="absolute inset-0 rounded-xl border-2 border-rose-500/60 pointer-events-none"
            animate={{ opacity: [0.9, 0.2, 0.9], scale: [1, 1.12, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Обратный отсчёт до жёсткого лимита */}
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow">
            {secondsLeft}
          </span>
        </>
      )}
    </button>
  );
}
