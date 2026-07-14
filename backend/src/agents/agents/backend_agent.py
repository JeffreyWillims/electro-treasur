"""
Backend Agent — агент серверной разработки Citrine Vault.

Скиллы: файловые операции в песочнице + верификация в порядке CI
(ruff → mypy → pytest). Fail-fast: первый красный шаг останавливает
цепочку — чинить надо его, а не смотреть на следующие.
"""

from __future__ import annotations

from pathlib import Path

from src.agents.base_agent import BaseAgent
from src.agents.skill_registry import Skill, SkillResult
from src.agents.skills import file_skills, test_skills


class BackendAgent(BaseAgent):
    """Агент backend-роли: docs/backend_agent.md + file/test скиллы."""

    def __init__(self) -> None:
        super().__init__(role="backend")
        self.skills.register(
            Skill("read_file", "Прочитать файл проекта (внутри root)", file_skills.read_file)
        )
        self.skills.register(
            Skill("write_file", "Записать файл проекта (внутри root)", file_skills.write_file)
        )
        self.skills.register(
            Skill("list_files", "Список файлов по glob-паттерну", file_skills.list_files)
        )
        self.skills.register(Skill("run_ruff", "ruff check .", test_skills.run_ruff))
        self.skills.register(Skill("run_mypy", "mypy src/ (strict)", test_skills.run_mypy))
        self.skills.register(
            Skill("run_pytest", "pytest unit+integration (не e2e)", test_skills.run_pytest)
        )

    def verify(self, project_dir: Path) -> list[SkillResult]:
        """ruff → mypy → pytest, как в CI; остановка на первом провале."""
        results: list[SkillResult] = []
        for step in (test_skills.run_ruff, test_skills.run_mypy, test_skills.run_pytest):
            result = step(project_dir)
            results.append(result)
            if not result.ok:
                break
        return results
