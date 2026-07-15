# tests/e2e

Сквозные тесты через настоящий браузер (Playwright). Требуют запущенных
dev-фронтенда (`localhost:5173`) и backend API (`localhost:8000`) — см. `pytest.ini`/`TESTING.md`
для запуска. Автоматически пропускаются, если Playwright не установлен.

- `__init__.py` — маркер пакета, пустой.
- `conftest.py` — `pytest_collection_modifyitems`: пропускает E2E-тесты, если пакет
  `playwright` не установлен, вместо падения сборки.
- `test_user_journey.py` — сценарий вход → дашборд через настоящий браузер.
- `pages/` — Page Object Model для E2E-тестов, см. `pages/README.md`.
