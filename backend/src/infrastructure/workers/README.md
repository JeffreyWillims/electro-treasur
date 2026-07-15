# infrastructure/workers

Фоновые задачи arq (без LLM — все расчёты детерминированные, rule-based).

- `import_worker.py` — тяжёлый разбор загруженных выписок (PDF/изображение/Excel)
  через эвристический парсер `ai_vision_service`; результат читается пользователем через polling.
- `insight_scheduler.py` — задачи «AI Анализа»: `generate_period_insight` (кнопка «AI Анализ»
  и годовой отчёт, расчёт на лету) и `calculate_static_insights` (предрасчёт с записью в `insights`).
- `insight_worker.py` — `calculate_static_insights`: прогоняет транзакции и бюджеты текущего
  месяца через `RuleBasedInsightEngine` и сохраняет готовый текст в таблицу `insights`
  (фронтенд читает его мгновенно через `GET /v1/insights/latest`).
- `reminder_worker.py` — проактивные Telegram-напоминалки: `remind_inactive_users`
  (ежедневный пинг тем, у кого нет транзакций за сегодня) и `push_free_funds`
  (недельный сигнал о свободных средствах).
