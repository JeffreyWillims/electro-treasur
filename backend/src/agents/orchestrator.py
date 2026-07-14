"""
Orchestrator — маршрутизация задач по агентам-ролям.

Держит реестр агентов (роль → агент), выдаёт агента по роли и умеет
запускать верификацию роли. Кросс-ролевые задачи идут последовательно
(Backend → docs/API_REFERENCE.md → Frontend → QA — см. README).
"""

from __future__ import annotations

from pathlib import Path

from src.agents.base_agent import BaseAgent
from src.agents.skill_registry import SkillResult


class Orchestrator:
    """Реестр агентов и точка входа для запуска их верификации."""

    def __init__(self) -> None:
        self._agents: dict[str, BaseAgent] = {}

    def register(self, agent: BaseAgent) -> None:
        """Регистрирует агента; вторая регистрация той же роли — ошибка конфигурации."""
        if agent.role in self._agents:
            raise ValueError(f"Agent for role '{agent.role}' is already registered")
        self._agents[agent.role] = agent

    def get(self, role: str) -> BaseAgent:
        """Возвращает агента роли; отсутствие — ошибка с перечнем доступных."""
        try:
            return self._agents[role]
        except KeyError:
            available = ", ".join(sorted(self._agents)) or "<none>"
            raise KeyError(f"No agent for role '{role}'. Available: {available}") from None

    def roles(self) -> list[str]:
        """Отсортированный список зарегистрированных ролей."""
        return sorted(self._agents)

    def verify(self, role: str, project_dir: Path) -> list[SkillResult]:
        """Запускает цепочку верификации агента указанной роли."""
        return self.get(role).verify(project_dir)
