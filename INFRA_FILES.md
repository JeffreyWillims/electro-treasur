# Инфраструктурные файлы корня репозитория

Не путать с корневым `README.md` (общий обзор проекта) — здесь только служебные
конфигурационные файлы.

## docker-compose*.yml

- **docker-compose.yml** — базовый стек: postgres, pgbouncer, redis, backend, frontend,
  telegram-bot, arq-worker. Применяется всегда, отдельно или вместе с overlay-файлами ниже.
- **docker-compose.override.yml** — локальный оверлей, подхватывается автоматически (без
  `-f`), когда стек стартует без явных флагов. Добавляет MailHog для отладки писем; в проде не
  участвует (см. `.gitignore`) и явно не подключается.
- **docker-compose.prod.yml** — продакшен-оверлей: заменяет сборку из исходников на готовые
  GHCR-образы (`backend`, `arq-worker`, `telegram-bot`) и продовый nginx-конфиг фронтенда.
  Подключается явно: `-f docker-compose.yml -f docker-compose.prod.yml`.
- **docker-compose.monitoring.yml** — оверлей мониторинга: Prometheus, Grafana, cAdvisor,
  node/postgres/redis-exporter, Alertmanager. Подключается явно вместе с базовым файлом.

## Прочее

- **pyproject.toml** — корневой манифест монорепозитория (Poetry): имя, версия и метаданные
  проекта верхнего уровня; собственных зависимостей не описывает.
- **.gitignore** — что не попадает в git: артефакты сборки/тестов, `node_modules`, `.env`,
  локальный `docker-compose.override.yml`, папку `docs/` и `backend/src/agents/` (не выкатываются
  на сервер), реальный Telegram-токен Alertmanager.
