# Frontend Migration: httpOnly Cookies вместо localStorage

**Дата:** 2026-07-04 · **Причина:** JWT в `localStorage` уязвим к XSS. Бэкенд переехал на
`httpOnly` + `Secure` + `SameSite=lax` cookies. Токены больше **не возвращаются в теле ответа**.

## Что изменилось на бэкенде

| Эндпоинт | Было | Стало |
|---|---|---|
| `POST /api/v1/auth/login` | `{ access_token, refresh_token, token_type }` в теле | `Set-Cookie: access_token, refresh_token` (httpOnly); тело `{ "status": "authenticated" }` |
| `POST /api/v1/auth/refresh` | принимал `{ refresh_token }` в теле | читает `refresh_token` из cookie; ставит новые cookie; тело `{ "status": "refreshed" }` |
| `POST /api/v1/auth/logout` | `{ refresh_token }` в теле | читает cookie, отзывает refresh, чистит cookie; `204` |
| Все защищённые роуты | `Authorization: Bearer <token>` | `access_token` из cookie (заголовок больше не читается) |

Access-cookie живёт 15 мин, refresh-cookie — 7 дней. При `401` на защищённом запросе фронтенд
должен вызвать `POST /auth/refresh` и повторить исходный запрос (refresh идёт по cookie автоматически).

## Что нужно сделать фронтенд-разработчику

1. **Включить отправку cookie на всех запросах к API.**
   - `fetch`: добавить `credentials: 'include'` в каждый вызов (или в обёртку `request()` в
     `src/api/client.ts`).
   - `axios`: `axios.defaults.withCredentials = true` (или `withCredentials: true` на инстансе).

2. **Убрать работу с токеном в JS.**
   - Удалить чтение/запись `localStorage.getItem/setItem('aura_token')` и
     заголовок `Authorization: Bearer ...` (`src/api/client.ts`). Cookie ставит и шлёт браузер сам —
     прочитать `httpOnly`-cookie из JS **нельзя** (это и есть защита от XSS).

3. **Логин/логаут.**
   - После `POST /auth/login` НЕ ждать токен в ответе — просто проверить `200` и, при желании,
     запросить `GET /api/v1/users/me` для профиля.
   - Логаут: `POST /api/v1/auth/logout` (без тела) — браузер пришлёт cookie, сервер их очистит.

4. **Авто-refresh при `401`.**
   - В перехватчике ответа: на `401` от защищённого запроса → `POST /api/v1/auth/refresh` →
     при успехе повторить исходный запрос; при `401` от самого refresh → редирект на логин.
   - Не зацикливаться: не рефрешить сам `/auth/refresh` и `/auth/login`.

## CORS / инфраструктура (важно)

- Браузер шлёт cookie на кросс-оригин запросы только при `credentials: 'include'` **и** серверном
  `Access-Control-Allow-Credentials: true` с конкретным `Access-Control-Allow-Origin` (не `*`).
  Проверить настройки CORS в `src/main.py` (сейчас `allow_credentials=True`, origins заданы явно —
  но список origin'ов нужно сверить с реальным доменом фронтенда).
- **Secure-флаг требует HTTPS.** Локально по `http://localhost` cookie с `Secure` не установится.
  На бэкенде это управляется `ET_COOKIE_SECURE` (в проде `true`, для локальной http-разработки
  можно `false`). В тестах — `false` (см. `pyproject.toml`).
- `SameSite=lax`: cookie не уйдёт на кросс-сайтовые `fetch`-POST — фронтенд и API должны быть на
  одном сайте (общий родительский домен) либо нужно пересмотреть на `SameSite=none; Secure`.

## Безопасность: остаточные риски (для Lead)

- **CSRF.** Переход на cookie возвращает поверхность CSRF. `SameSite=lax` закрывает большинство
  кросс-сайтовых POST через `fetch/XHR`, но не всё (например, top-level form-navigation). Для
  критичных мутаций стоит добавить CSRF-токен (double-submit cookie) — отдельная задача.
- **RS256.** Алгоритм подписи всё ещё `HS256`. Переход на асимметричный `RS256` — отдельно.
- **E2E-тесты.** `backend/tests/e2e/conftest.py` до сих пор берёт токен из тела логина и кладёт в
  `localStorage` браузера — этот сценарий устарел и должен быть переписан на приём cookie вместе с
  миграцией фронтенда (e2e сейчас скипаются без Playwright и в CI не гоняются).
