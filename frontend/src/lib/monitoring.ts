/**
 * Единая точка отправки клиентских ошибок во внешний мониторинг.
 *
 * Сейчас это тонкая обёртка над console: реальный транспорт (Sentry)
 * подключается в initMonitoring() и активируется только при заданном
 * VITE_SENTRY_DSN. Всё приложение (ErrorBoundary, обработчики) зовёт
 * captureError отсюда, не зная, включён ли Sentry, — так его можно
 * включить/выключить одной переменной окружения, не трогая вызовы.
 */

type Reporter = (error: unknown, context?: Record<string, unknown>) => void;

// По умолчанию — только консоль. initMonitoring() заменит на Sentry, если есть DSN.
let reporter: Reporter = (error, context) => {
  console.error('[monitoring]', error, context ?? '');
};

export function setReporter(fn: Reporter): void {
  reporter = fn;
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  try {
    reporter(error, context);
  } catch {
    // Мониторинг не должен сам ронять приложение.
  }
}

/**
 * Инициализирует Sentry, если задан VITE_SENTRY_DSN. Без DSN — тихо выходит,
 * и приложение работает на консольном репортёре (локальная разработка, CI).
 * Sentry грузится динамически: в сборку без DSN его код не попадёт.
 */
export async function initMonitoring(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Трасса производительности: 10% транзакций — хватает для трендов,
      // не раздувая квоту бесплатного тарифа.
      tracesSampleRate: 0.1,
      // Не шлём тело запросов/ответов — там платёжные и личные данные.
      sendDefaultPii: false,
    });
    setReporter((error, context) => {
      Sentry.captureException(error, context ? { extra: context } : undefined);
    });
  } catch (e) {
    // Sentry не загрузился — остаёмся на консоли, приложение не роняем.
    console.error('[monitoring] Sentry init failed', e);
  }
}
