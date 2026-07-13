# monitoring/prometheus

Конфигурация Prometheus: что скрейпить и какие алерты вычислять.

## Файлы

- **prometheus.yml** — интервалы скрейпа/оценки (15s), адрес Alertmanager, подключение
  `alerts.yml`, список scrape-таргетов (сам Prometheus, cadvisor, node-exporter, postgres,
  redis).
- **alerts.yml** — правила алертов группы `infrastructure`: `InstanceDown`, `HighCpuUsage`,
  `HighMemoryUsage`, `PostgresDown`, `RedisDown`.
