/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DSN проекта Sentry. Пусто/не задан — мониторинг ошибок выключен. */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
