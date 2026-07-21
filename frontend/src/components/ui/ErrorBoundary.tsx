/**
 * Граница ошибок React. Если внутри падает рендер — вместо белого экрана
 * показываем аккуратную стеклянную плашку, а сам сбой уходит в мониторинг.
 * Остальное приложение (сайдбар, другие страницы) продолжает жить.
 *
 * Границы ошибок в React обязаны быть классовыми компонентами — хуковой
 * альтернативы getDerivedStateFromError / componentDidCatch пока нет.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '@/lib/monitoring';

interface Props {
  children: ReactNode;
  /** Название блока для человекочитаемого текста плашки и контекста ошибки. */
  label?: string;
  /** Сменившееся значение (обычно pathname) сбрасывает границу при навигации. */
  resetKey?: string;
  /** Своя плашка вместо стандартной, если нужно. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError(error, {
      boundary: this.props.label ?? 'unknown',
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(prev: Props): void {
    // Ушли на другую страницу — забываем прежний сбой и пробуем отрисовать заново.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const what = this.props.label ?? 'Этот раздел';
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div className="w-full max-w-md text-center bg-white/40 dark:bg-[#111111]/40 backdrop-blur-3xl border border-black/5 dark:border-white/10 shadow-2xl rounded-[2.5rem] p-10 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FF7A00]/15 flex items-center justify-center text-3xl">
            🛠️
          </div>
          <h2 className="text-xl font-sans font-extrabold tracking-tight text-[#1C3F35] dark:text-white">
            {what} временно недоступен
          </h2>
          <p className="text-[13px] font-sans font-semibold text-[#1C3F35]/55 dark:text-white/45 leading-relaxed">
            Мы уже знаем о сбое и чиним его. Остальные разделы работают —
            можно продолжать пользоваться приложением.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-2 py-2.5 px-6 rounded-full bg-[#1C3F35] dark:bg-[#FF7A00] text-white font-sans font-semibold text-sm shadow-lg transition-transform active:scale-[0.98]"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }
}
