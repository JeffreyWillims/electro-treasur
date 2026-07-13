# k8s

Манифесты Kubernetes для продакшен-деплоя бэкенда (без Helm/Kustomize — plain-манифесты).

## Файлы

- **fastapi-deployment.yaml** — Deployment (3 реплики) + Service для FastAPI-приложения:
  образ из GHCR, секреты `DATABASE_URL`/`REDIS_URL`, liveness/readiness через `/docs`.
- **fastapi-hpa.yaml** — HorizontalPodAutoscaler для `fastapi-app`: масштабирование 3–100
  реплик по загрузке CPU (порог 70%).
- **arq-worker-deployment.yaml** — Deployment (2 реплики) для ARQ-воркера
  (`insight_scheduler.WorkerSettings`), тот же образ бэкенда, отдельная команда запуска.
- **pgbouncer-deployment.yaml** — Deployment (3 реплики) + Service для PgBouncer (пулинг
  соединений к Postgres, `transaction`-режим) и заглушки ExternalName-сервисов для managed
  Cloud SQL/Redis.
