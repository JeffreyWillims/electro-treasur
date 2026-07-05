# DevOps Agent — инструкция

## Роль

Инфраструктура Citrine Vault: Docker/Compose (`docker-compose*.yml`, `backend/Dockerfile`,
`frontend/Dockerfile`), Nginx (`frontend/nginx*.conf`), CI/CD (`.github/workflows/ci.yml`),
мониторинг (`monitoring/`), Kubernetes (`k8s/`).

## Обязательное чтение перед задачей

1. `docs/DEPLOYMENT.md` — процесс деплоя, env-переменные, healthcheck-и, известные расхождения
   (K8s-проба на `/docs` vs `/health`, несовпадение пути образа в `k8s/` с тем, что пушит CI).
2. `backend/src/agents/docs/devops_rules.md` — правила (нездоровые healthcheck-и отключены осознанно,
   `ET_` префикс, порядок джобов CI).
3. `docs/PROJECT_CONTEXT.md` — таблица сервисов и портов.

## Скиллы

Python-скиллы не реализованы (заглушки). Штатные команды:

| Действие | Команда |
|---|---|
| Локальный стек | `docker compose up -d --build` |
| Прод-оверлей | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` |
| Мониторинг | `docker compose -f docker-compose.monitoring.yml up -d` |
| Валидация compose | `docker compose config -q` |
| Логи/статус сервиса | `docker compose logs backend --tail 50` / `docker compose ps` |

## Workflow

1. Перед правкой конфига — понять, зачем текущее состояние такое (пример: `healthcheck: disable`
   у `telegram-bot`/`arq-worker` — не ошибка, у них нет HTTP-сервера).
2. Изменение сервиса в Compose → проверить, не нужно ли зеркально обновить `k8s/`-манифест.
3. Новая env-переменная → добавить в `backend/.env.example` (с плейсхолдером) и в Settings-модель;
   секреты в git не попадают.
4. Изменение CI → сохранить порядок lint → test → build и concurrency-группу.
5. После правок обновить `docs/DEPLOYMENT.md`, если изменилось поведение деплоя.

## Запрещено

- Хардкод секретов/паролей в compose, манифестах, CI.
- Открывать наружу порты, кроме 80/443 (frontend) — pgbouncer 6432 только для локальной отладки.
- «Чинить» двойной `/api` у yearly-роутера на уровне Nginx без согласования — это контракт,
  на который завязан фронтенд.
- Удалять/ослаблять шаги CI (pip-audit, coverage-порог) ради «ускорения пайплайна».
