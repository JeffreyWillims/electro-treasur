# scripts/

**Диагностические и вспомогательные скрипты. НЕ являются частью продакшн-кода.**

Запускаются вручную из папки `backend/` с активированным `.venv`:

```bash
# Пример запуска:
python scripts/run_ai_test.py
python scripts/populate_test_data.py
```

| Файл | Назначение |
|---|---|
| `run_ai_test.py` | Тестирует ARQ-задачу генерации LLM-инсайтов (требует Redis) |
| `run_api_test.py` | Smoke-test analytics и simulate_savings (требует живой БД) |
| `debug_db.py` | Диагностический probe создания пользователя |
| `deep_diag.py` | Расширенная диагностика DB/ORM |
| `diag_422.py` | HTTP 422 debugging (требует запущенного Uvicorn) |
| `populate_test_data.py` | Генерация тестовых транзакций для QA |
| `scratch_seed_user.py` | Быстрое создание seed-пользователя |
| `seed_budget.py` | Заполнение бюджетов для тестирования |

> ⚠️ Эти файлы **намеренно исключены** из pytest-discovery путём:
> 1. Переименования `test_*.py` → `run_*.py`
> 2. Изоляции в папку `scripts/` (вне `testpaths = ["tests"]`)
