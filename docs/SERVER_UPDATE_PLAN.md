# План обновления сервера (для агента на VPS)

Цель: быстро доставить свежий main на сервер копией репозитория, применить
миграции и проверить аналитику. Ничего лишнего — по шагам, каждый с проверкой.

Контекст сервера: docker compose (базовый + `docker-compose.prod.yml`),
домен citrinevault.ru, публичный вход только через nginx (80/443).
`docker-compose.override.yml` (MailHog) в git НЕ входит — на сервере его нет,
это норма. Секреты живут в `backend/.env` на сервере и в git не попадают.

## 0. Перед началом

```bash
cd <PROJECT_DIR>
docker compose ps            # ядро должно быть Up: postgres, redis, pgbouncer, backend, frontend, arq-worker
git status --short           # на сервере не должно быть локальных правок
```

Если ядро лежит — сначала `docker compose up -d postgres redis`, потом остальное.

## 1. Забрать код

```bash
git fetch origin && git log --oneline HEAD..origin/main | head   # что приедет
git pull origin main
```

## 2. Проверить backend/.env (обязательные ключи)

`ET_SECRET_KEY`, `ET_DATABASE_URL` (обычно `...@pgbouncer:6432/electro_treasur`),
`ET_REDIS_URL`, `ET_ARQ_REDIS_URL`, `ET_TELEGRAM_BOT_TOKEN` (прод-бот
@citrine_vault_bot). Для писем обратной связи на реальную почту — блок
`ET_SMTP_*` по образцу из `backend/.env.example` (Gmail: порт 587,
`ET_SMTP_STARTTLS=true`, app-password). Пусто — письма уходят только в лог.

## 3. Пересобрать образы

У каждого сервиса СВОЙ тег образа: пересборка `backend` НЕ обновляет
`arq-worker`/`telegram-bot` — собирать все три + frontend:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build backend arq-worker telegram-bot frontend
```

(Альтернатива, если решите брать готовый образ из GHCR: `docker compose ... pull backend arq-worker telegram-bot` —
но это требует latest в GHCR; сборка на месте надёжнее при копии репозитория.)

Dockerfile сам переживает рассинхрон зеркала apt (fallback на deb.debian.org).

## 4. Миграции — ДО переключения контейнеров

Одноразовый контейнер новым образом, напрямую в postgres (не через pgbouncer):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --no-deps \
  -e ET_DATABASE_URL="postgresql+asyncpg://electro:<PASSWORD>@postgres:5432/electro_treasur" \
  backend alembic upgrade head
```

Ожидаемо: `Running upgrade ... -> head` без ошибок. Миграции backward-compatible,
старые контейнеры в это время продолжают работать.

## 5. Переключить контейнеры

`up -d` после build может НЕ заменить живой контейнер — только force-recreate:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate --no-deps backend arq-worker telegram-bot frontend
docker compose ps    # backend должен стать (healthy)
```

## 6. Смоук — обязательный

```bash
curl -s https://citrinevault.ru/api/v1/health          # {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" https://citrinevault.ru/   # 200
docker compose logs arq-worker --tail 5                 # без crash-loop, есть 'arq worker started'
```

## 7. Проверка аналитики (главное из свежих изменений)

Залогиньтесь на сайте живым аккаунтом и проверьте вкладку «Аналитика»:

- «Стоит ли покупать?» — на месте, вердикт по цене работает;
- «Финансовое здоровье» — оценка ПОД кольцом, факторы `N / 100`, в текстах
  нет отрицательных процентов;
- «Структура расходов» — в центре кольца общий итог, легенда с суммами и долями;
- «Пульс капитала» — водопад дней + оранжевая кумулятивная линия,
  плашки «Лучший день / Самый затратный»;
- Кнопка «AI Анализ» — карточки разбора, совет-каллаут 💡, «Скопировать» и
  «Скачать PDF-план» работают (PDF отдаёт /api/v1/reports/financial-plan.pdf).

Вкладка «Бюджеты»: конверты предлагают только расходные категории; в карточках
видна строка «осталось … · … ₽/день»; у «Безопасного лимита» подсказка ⓘ
раскрывает формулу живыми цифрами.

Колокольчик: только «Что нового» и отчёты воркеров (записей о рекордах игр нет).

## 8. Откат (если смоук красный)

```bash
git log --oneline -5                 # найти предыдущий коммит
git checkout <prev_sha> && docker compose -f docker-compose.yml -f docker-compose.prod.yml build backend arq-worker telegram-bot frontend \
  && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate --no-deps backend arq-worker telegram-bot frontend
```

Миграции этого релиза откатывать не требуется (новых схемных изменений нет;
если появятся — `alembic downgrade -1` тем же one-off контейнером).
