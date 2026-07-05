"""
Base Agent — общий каркас агента-разработчика.

Агент = роль + инструкция (docs/<роль>_agent.md) + правила (docs/<роль>_rules.md)
+ реестр скиллов. Каркас отвечает за загрузку базы знаний и доступ к скиллам;
конкретный цикл работы (verify и т.п.) определяет наследник.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from src.agents.skill_registry import SkillRegistry, SkillResult

DOCS_DIR = Path(__file__).parent / "docs"


class BaseAgent(ABC):
    """Базовый агент: знает свою роль, читает свою документацию, владеет скиллами."""

    def __init__(self, role: str) -> None:
        self.role = role
        self.skills = SkillRegistry()

    @property
    def instructions_path(self) -> Path:
        """Путь к инструкции агента (роль → docs/<role>_agent.md)."""
        return DOCS_DIR / f"{self.role}_agent.md"

    @property
    def rules_path(self) -> Path:
        """Путь к правилам кода агента (роль → docs/<role>_rules.md)."""
        return DOCS_DIR / f"{self.role}_rules.md"

    def load_instructions(self) -> str:
        """Инструкция агента: роль, workflow, команды верификации."""
        return self.instructions_path.read_text(encoding="utf-8")

    def load_rules(self) -> str:
        """Жёсткие правила кодовой базы для этой роли."""
        return self.rules_path.read_text(encoding="utf-8")

    @abstractmethod
    def verify(self, project_dir: Path) -> list[SkillResult]:
        """Прогоняет цепочку верификации роли; порядок и состав — у наследника."""
