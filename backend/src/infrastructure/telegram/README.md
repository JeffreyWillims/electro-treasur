# infrastructure/telegram

Telegram-бот Citrine Vault (aiogram) — быстрый ввод трат и уведомления прямо в чате.

- `bot.py` — точка входа: создаёт `Bot`/`Dispatcher`, общий Redis-клиент, регистрирует
  `DbSessionMiddleware` и хендлеры, запускает polling.
- `handlers.py` — обработчики команд и сообщений: разбор сумм/категорий из текста,
  создание транзакций через привязанный `telegram_chat_id`.
- `middleware.py` — внедряет асинхронную сессию БД и текущего `User`
  (по `telegram_chat_id`, поиск за O(1) через уникальный индекс) в данные хендлера aiogram.
- `notifier.py` — переиспользуемая best-effort отправка сообщений в Telegram для
  фоновых воркеров-напоминалок (ошибки логируются, не пробрасываются наружу).
