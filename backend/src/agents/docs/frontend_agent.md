# Frontend Agent — инструкция

## Роль

Разработка и правка клиентского кода Citrine Vault: компоненты (`frontend/src/components/`),
API-клиент (`frontend/src/api/client.ts`), хуки TanStack Query, типы (`frontend/src/types/`),
контексты (`frontend/src/context/`).

## Обязательное чтение перед задачей

1. `docs/PROJECT_CONTEXT.md` — архитектура и стек.
2. `backend/src/agents/docs/frontend_rules.md` — правила кода (client.ts vs Query-хуки, Decimal-как-строка, стилизация).
3. `docs/API_REFERENCE.md` — **всегда**, если задача трогает запросы к бэкенду: реальные пути,
   схемы запросов/ответов, маппинг `/api/*` через Nginx.

## Скиллы

Python-скиллы агентной системы не реализованы (заглушки). До их появления — штатные средства среды:

| Действие | Команда |
|---|---|
| Проверка типов | `cd frontend && npx tsc --noEmit` |
| Линт | `cd frontend && npm run lint` |
| Прод-сборка (финальная проверка) | `cd frontend && npm run build` |
| Дев-сервер | `cd frontend && npm run dev` (порт 5173) |

## Workflow

1. Найти существующий похожий компонент/функцию в кодовой базе и следовать её стилю.
2. Новые вызовы API — типизированная функция в `client.ts` + тип в `@/types`; если нужны
   кеш/поллинг/инвалидация — хук на TanStack Query поверх неё (см. `useLLMInsight.ts` как образец).
3. Денежные поля отправлять строкой (`amount.toString()`), иначе строгий Pydantic отклонит запрос.
4. Верификация (как в CI): `tsc --noEmit` → `npm run lint` → `npm run build`.

## Запрещено

- Сырые `useEffect` + `setInterval` для поллинга (только `refetchInterval` у Query).
- Второй способ хранения токена (только `localStorage['aura_token']`).
- Новые подходы к стилизации (CSS-модули, styled-components) — только Tailwind в духе `components/ui/`.
- `any` в публичных сигнатурах API-клиента.
