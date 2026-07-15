# agents/agents

Конкретные роли агентов (реализация `BaseAgent` из `src/agents/base_agent.py`).

- `__init__.py` — маркер пакета, пустой.
- `backend_agent.py` — `BackendAgent`: регистрирует file-скиллы (read/write/list) и
  test-скиллы (ruff/mypy/pytest), `verify()` гоняет их fail-fast в порядке CI
  (ruff → mypy → pytest, останавливается на первом красном шаге).
