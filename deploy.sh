#!/usr/bin/env bash
#
# deploy.sh — ручной пул-деплой Citrine Vault на сервере.
#
# Альтернатива SSH-джобе `deploy` в .github/workflows/ci.yml: тот вариант заходит
# на сервер САМ (нужен приватный ключ в GitHub Secrets VPS_SSH_KEY). Этот скрипт —
# наоборот: ты заходишь на сервер сам (своим SSH-ключом) и один раз запускаешь его.
# GitHub при этом вообще не знает про сервер и не хранит от него ключей.
#
# Использование:
#   ssh user@server
#   cd /путь/к/electro-treasur
#   ./deploy.sh
#
# Что делает (тот же порядок, что и автодеплой в CI — zero-downtime,
# см. docs/DEPLOYMENT.md → «Zero-Downtime миграции»):
#   1. git pull — скачивает новый код (docker-compose*.yml, миграции и т.д.)
#   2. docker compose pull — скачивает готовые образы backend/arq-worker/telegram-bot из GHCR
#   3. alembic upgrade head — миграции НОВЫМ образом, пока старые контейнеры ещё работают
#   4. docker compose build frontend — статика фронтенда собирается на месте
#   5. docker compose up -d — переключение на новые контейнеры
#   6. docker image prune -f — уборка старых слоёв образов

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Есть незакоммиченные локальные изменения на сервере — прерываю, чтобы не потерять их."
  echo "Разберись вручную (git status) и запусти скрипт снова."
  exit 1
fi

echo "1/6 — скачиваю новый код (git pull)"
git pull origin main

echo "2/6 — скачиваю образы из GHCR"
"${COMPOSE[@]}" pull backend arq-worker telegram-bot

echo "3/6 — применяю миграции новым образом"
"${COMPOSE[@]}" run --rm backend alembic upgrade head

echo "4/6 — собираю статику фронтенда"
"${COMPOSE[@]}" build frontend

echo "5/6 — переключаюсь на новые контейнеры"
"${COMPOSE[@]}" up -d

echo "6/6 — убираю старые образы"
docker image prune -f

echo "Готово. Проверка: curl -s http://localhost/api/v1/health"
