"""
Агентная система — запуск верификации кода из UI (кнопка «Запустить проверку кода»).

POST /verify — статические проверки backend-кода (ruff → mypy, fail-fast как в
цепочке BackendAgent) через скиллы агентной подсистемы (src/agents). pytest из
веб-запроса намеренно НЕ запускается: интеграционные тесты ходят в БД и не
должны касаться боевой базы. В образе без dev-инструментов скиллы честно
возвращают «Command not found» — эндпоинт сообщает это пользователю.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.agents.skills.test_skills import build_mypy_command, build_ruff_command, run_command
from src.dependencies import get_current_user
from src.domain.models import User

router = APIRouter(tags=["Agents"])

# /app/src/api/v1/agents.py → parents[3] = корень backend (/app в контейнере).
BACKEND_DIR = Path(__file__).resolve().parents[3]
CHECK_TIMEOUT_S = 180
OUTPUT_LIMIT = 1500

CHECKS: list[tuple[str, list[str]]] = [
    ("ruff", build_ruff_command()),
    ("mypy", build_mypy_command()),
]


class CheckResult(BaseModel):
    check: str
    ok: bool
    output: str


class VerifyResponse(BaseModel):
    passed: bool
    results: list[CheckResult]


@router.post("/verify", response_model=VerifyResponse)
def verify_code(current_user: User = Depends(get_current_user)) -> VerifyResponse:
    """Синхронный def — subprocess уходит в threadpool и не блокирует event loop."""
    results: list[CheckResult] = []
    for name, cmd in CHECKS:
        r = run_command(cmd, cwd=BACKEND_DIR, timeout=CHECK_TIMEOUT_S)
        results.append(CheckResult(check=name, ok=r.ok, output=r.output[-OUTPUT_LIMIT:]))
        if not r.ok:
            break  # fail-fast: как verify() у BackendAgent
    return VerifyResponse(passed=all(r.ok for r in results), results=results)
