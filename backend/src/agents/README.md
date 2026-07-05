# Agents — база знаний для агентов-разработчиков

Мультиагентная подсистема Citrine Vault: база знаний в `docs/` + рабочий Python-каркас
(реестр скиллов, файловые операции в песочнице, верификация ruff→mypy→pytest, оркестратор).
Код типизирован под `mypy --strict` и покрыт юнит-тестами (`tests/unit/test_agents.py`).

## Структура

```
agents/
├── docs/                        # ← база знаний
│   ├── security_audit.md        # ТОП: аудит и модернизация (безопасность, P0–P2)
│   ├── feature_playbook.md      # ТОП: разработка фич без поломок (вертикальный срез)
│   ├── backend_agent.md         # инструкция: роль, workflow, верификация
│   ├── frontend_agent.md
│   ├── qa_agent.md
│   ├── devops_agent.md
│   ├── backend_rules.md         # правила кода (что можно/нельзя)
│   ├── frontend_rules.md
│   ├── qa_rules.md
│   └── devops_rules.md
├── skill_registry.py            # Skill / SkillResult / SkillRegistry
├── base_agent.py                # BaseAgent: роль + загрузка своей документации
├── orchestrator.py              # Orchestrator: роль → агент, запуск верификации
├── agents/backend_agent.py      # BackendAgent: file+test скиллы, verify() fail-fast
└── skills/
    ├── file_skills.py           # read/write/list в песочнице (без выхода за root)
    └── test_skills.py           # build_*-команды (чистые) + run_ruff/mypy/pytest
```

Пример использования каркаса:

```python
from pathlib import Path
from src.agents import BackendAgent, Orchestrator

orch = Orchestrator()
orch.register(BackendAgent())
results = orch.verify("backend", Path("backend"))  # ruff → mypy → pytest, fail-fast
```

## Как пользоваться

Агент (или человек), берущий задачу:

1. Читает свою **инструкцию** (`docs/<роль>_agent.md`) — роль, workflow, команды верификации.
2. Читает свои **правила** (`docs/<роль>_rules.md`) — жёсткие ограничения кодовой базы.
3. Для задач анализа/модернизации — `docs/security_audit.md`; для новых фич —
   `docs/feature_playbook.md` (это два главных плейбука подсистемы).
4. Читает проектные доки по ссылкам из инструкции:
   `docs/PROJECT_CONTEXT.md`, `docs/API_REFERENCE.md`, `docs/DATABASE_SCHEMA.md`,
   `docs/DEPLOYMENT.md` (в корне репозитория) и `backend/tests/TESTING.md`.

Пример: Frontend Agent перед написанием хука читает `docs/API_REFERENCE.md`, чтобы взять
реальные пути и схемы ответов, а не выдумывать их.

## Разделение ролей

| Агент | Зона | Верификация |
|---|---|---|
| Backend | `backend/src/**` (кроме agents/), `migrations/` | ruff → mypy → pytest (cov ≥ 70%) |
| Frontend | `frontend/src/**` | tsc --noEmit → eslint → vite build |
| QA | `backend/tests/**` | полный pytest-прогон с покрытием |
| DevOps | compose/nginx/CI/k8s/monitoring | `docker compose config -q`, ручная проверка стека |

Конфликт зон (например, фича требует и API, и UI) решается последовательно:
Backend → обновление `docs/API_REFERENCE.md` → Frontend → QA.
