# api

Типизированный доступ к backend API.

- `client.ts` — типизированные fetch-обёртки для всех эндпоинтов бэкенда: все ответы
  валидируются по контрактным типам (`@/types`), без `any` в публичном API.
  Авторизация — httpOnly-cookie (`credentials: 'include'`), на 401 делает один
  прозрачный refresh и повторяет запрос.
- `useLLMInsight.ts` — TanStack Query хук с 3-фазным поллингом «AI Анализа»:
  POST `/v1/insights/` → получить `task_id` → поллинг статуса до готового результата.
