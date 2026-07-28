# Deployment Runbook — боевой сервер

Пошаговый подъём Citrine Vault на проде: приложение + мониторинг (аналитика) +
создание аккаунта, который сможет войти. Деплой ручной, командами на сервере
(SSH-ключей в CI нет). Все блоки команд — **без комментариев**, копируются как есть.

Связанные документы: `docs/DEPLOYMENT.md` (архитектура и zero-downtime миграции),
`.env.example` и `backend/.env.example` (шаблоны переменных).

---

## 0. Предусловия (один раз)

```
docker --version
docker compose version
git --version
```

Домен `citrinevault.ru` указывает на сервер, порты 80/443 свободны. TLS-сертификаты
Let's Encrypt должны существовать (их требует `frontend/nginx.prod.conf`):

```
ls /etc/letsencrypt/live/citrinevault.ru/fullchain.pem /etc/letsencrypt/live/citrinevault.ru/privkey.pem
```

Если сертификатов нет — выпустить один раз (порт 80 должен быть свободен):

```
docker run --rm -p 80:80 -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot certonly --standalone -d citrinevault.ru -d www.citrinevault.ru
```

---

## 1. Код

```
cd /opt
git clone https://github.com/JeffreyWillims/electro-treasur.git
cd electro-treasur
git checkout main
git pull origin main
```

Если репозиторий уже клонирован — только последние две строки.

---

## 2. Секреты — два файла .env (оба в .gitignore)

**Корневой `.env`** — переменные для docker compose (пароль БД, Grafana, тег образа):

```
cp .env.example .env
nano .env
```

Заполнить:
- `POSTGRES_PASSWORD` — длинный случайный секрет (`openssl rand -base64 32`)
- `GRAFANA_ADMIN_USER` и `GRAFANA_ADMIN_PASSWORD` — свои
- `BACKEND_IMAGE_TAG=latest`

**`backend/.env`** — переменные приложения (ET_*):

```
cp backend/.env.example backend/.env
nano backend/.env
```

Обязательно:
- `ET_SECRET_KEY` — длинный случайный секрет
- `ET_TELEGRAM_BOT_TOKEN` — реальный токен бота
- `ET_DATABASE_URL=postgresql+asyncpg://electro:ПАРОЛЬ@pgbouncer:6432/electro_treasur`
  (ПАРОЛЬ = тот же `POSTGRES_PASSWORD` из корневого `.env`)
- `ET_REDIS_URL=redis://redis:6379/0`

> ⚠️ `POSTGRES_PASSWORD` задать ДО первого запуска — postgres берёт его при
> инициализации тома `pg_data`. На уже созданном томе пароль так не сменить
> (нужен `ALTER USER electro WITH PASSWORD '...'`).

---

## 3. Образы

Вариант А — из GHCR (CI на `main` собирает образ автоматически):

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull backend arq-worker telegram-bot
```

Вариант Б — собрать на сервере (без GHCR):

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml build backend frontend
```

`arq-worker` и `telegram-bot` в prod-оверлее используют тот же образ, что `backend` —
отдельная сборка не нужна.

---

## 4. Миграции БД (новым образом, до переключения контейнеров)

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm backend alembic upgrade head
```

---

## 5. Поднять весь стек + аналитику (мониторинг)

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
docker image prune -f
```

---

## 6. Проверка «зелёного света»

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml ps
curl -s https://citrinevault.ru/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" https://citrinevault.ru/
docker logs electro-treasur-telegram-bot-1 --tail 5
```

Ожидаемо: контейнеры `Up`/`healthy`; health → `{"status":"ok"}`; фронт → `200`;
бот → `Run polling`.

---

## 7. Аккаунт, который сможет войти

**Вариант А — через сайт (проще):** открыть `https://citrinevault.ru` → вкладка
«Регистрация» → email + пароль (не меньше 8 символов). После регистрации вход
происходит автоматически.

**Вариант Б — командой (создать и проверить вход):**

```
curl -s -X POST https://citrinevault.ru/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"owner@citrinevault.ru","password":"ChangeMe12345","full_name":"Owner"}'
```

```
curl -s -i -X POST https://citrinevault.ru/api/v1/auth/login -H "Content-Type: application/x-www-form-urlencoded" -d "username=owner@citrinevault.ru&password=ChangeMe12345" | grep -iE "HTTP/|set-cookie"
```

Ожидаемо: register → `201`; login → `200` + заголовок `Set-Cookie: access_token=...HttpOnly`.
Значит аккаунт рабочий — им можно заходить на сайте.

---

## 8. Доступ к аналитике (Grafana / Prometheus)

UI мониторинга слушает только `127.0.0.1` (наружу закрыт). Заходить через SSH-туннель
с рабочей машины:

```
ssh -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 user@212.193.26.26
```

Затем в браузере: `http://localhost:3000` (Grafana, логин из `GRAFANA_ADMIN_USER` /
`GRAFANA_ADMIN_PASSWORD`), `http://localhost:9090` (Prometheus).

---

## 9. Обновление / откат / бэкап

Бэкап БД перед миграцией (official postgres: локальный сокет = trust, пароль не нужен):

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres pg_dump -U electro electro_treasur > backup_$(date +%Y%m%d_%H%M%S).sql
```

Обновление до свежего кода: повторить шаги 1, 3, 4, 5.

Откат на предыдущую сборку: в корневом `.env` выставить `BACKEND_IMAGE_TAG=sha-<предыдущий>`
и повторить шаг 5. При сборке на сервере — `git checkout <коммит>` и пересобрать.

---

## Три разных логина — не путать

| Что | Где | Креды |
|---|---|---|
| Приложение | `https://citrinevault.ru` | обычная регистрация (шаг 7) |
| Админка SQLAdmin | `/admin` | `ET_ADMIN_USERNAME` / `ET_ADMIN_PASSWORD` (`backend/.env`) |
| Grafana | SSH-туннель `:3000` | `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` (корневой `.env`) |

---

## Заметки

- `node-exporter` на Linux-сервере работает штатно (его ошибка `path / … not a shared
  or slave mount` — только локально на Docker Desktop macOS).
- `frontend/nginx.prod.conf` содержит `resolver 127.0.0.11` — «502 после пересоздания
  backend» (виден локально на dev-`nginx.conf`) на проде не воспроизводится.
- Grafana-креды из `.env` применяются на чистом томе — первый прод-запуск как раз он.
- Порт postgres наружу не публикуется; БД доступна только по внутренней docker-сети.
