"""
Test Skills — верификация кода: ruff → mypy → pytest (порядок как в CI).

Построители команд (build_*) — чистые функции, тестируются без subprocess.
run_command — единственная точка запуска процессов: таймаут, обрезка вывода,
никакого shell=True (команда — список аргументов, инъекции невозможны).
"""

from __future__ import annotations

import subprocess
from collections.abc import Sequence
from pathlib import Path

from src.agents.skill_registry import SkillResult

DEFAULT_TIMEOUT_SECONDS = 600
OUTPUT_TAIL_CHARS = 4000


def build_ruff_command() -> list[str]:
    """Линт всего backend-каталога."""
    return ["ruff", "check", "."]


def build_mypy_command() -> list[str]:
    """Строгая проверка типов src/ (настройки — в pyproject.toml)."""
    return ["mypy", "src/"]


def build_pytest_command(
    paths: Sequence[str] | None = None,
    marker: str | None = "not e2e",
    with_coverage: bool = False,
) -> list[str]:
    """Команда pytest: подмножество путей, маркер, опционально порог покрытия CI."""
    cmd = ["pytest", "-q"]
    cmd.extend(paths if paths is not None else ["tests/unit", "tests/integration"])
    if marker:
        cmd.extend(["-m", marker])
    if with_coverage:
        cmd.extend(["--cov=src", "--cov-fail-under=70"])
    return cmd


def run_command(
    cmd: Sequence[str], cwd: Path, timeout: int = DEFAULT_TIMEOUT_SECONDS
) -> SkillResult:
    """Запускает команду в cwd; ok = returncode 0, output = хвост stdout+stderr."""
    try:
        proc = subprocess.run(
            list(cmd),
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return SkillResult(ok=False, output=f"Timeout after {timeout}s: {' '.join(cmd)}")
    except FileNotFoundError:
        return SkillResult(ok=False, output=f"Command not found: {cmd[0]}")
    output = (proc.stdout + proc.stderr)[-OUTPUT_TAIL_CHARS:]
    return SkillResult(ok=proc.returncode == 0, output=output)


def run_ruff(cwd: Path) -> SkillResult:
    """ruff check . в каталоге backend."""
    return run_command(build_ruff_command(), cwd=cwd)


def run_mypy(cwd: Path) -> SkillResult:
    """mypy src/ в каталоге backend."""
    return run_command(build_mypy_command(), cwd=cwd)


def run_pytest(
    cwd: Path,
    paths: Sequence[str] | None = None,
    marker: str | None = "not e2e",
    with_coverage: bool = False,
) -> SkillResult:
    """pytest в каталоге backend (по умолчанию unit+integration без e2e)."""
    return run_command(
        build_pytest_command(paths=paths, marker=marker, with_coverage=with_coverage),
        cwd=cwd,
    )
