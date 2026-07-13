# monitoring/alertmanager

Конфигурация Alertmanager: маршрутизация алертов из Prometheus в Telegram.

## Файлы

- **alertmanager.yml** — маршрут алертов на ресивер `telegram` (группировка по `alertname`,
  `group_wait`/`group_interval`/`repeat_interval`), токен бота читается из файла, не из значения.
- **bot_token.example** — закоммиченная заглушка токена Telegram-бота (алерты выключены, пока не
  подставлен реальный `bot_token`, который в git не попадает).
