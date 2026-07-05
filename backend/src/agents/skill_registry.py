"""
Skill Registry — реестр навыков агентов.

Скилл = именованная детерминированная операция (чтение файла, запуск pytest),
которую агент выполняет по инструкции из docs/. Реестр — точка обнаружения:
агент спрашивает «что я умею», получает список и описание.

Никакой магии: без LLM-вызовов, без глобального состояния — реестр создаётся
явно и наполняется при инициализации агента.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass(frozen=True)
class SkillResult:
    """Единый результат выполнения скилла."""

    ok: bool
    output: str


@dataclass(frozen=True)
class Skill:
    """Именованный навык: описание для агента + вызываемый обработчик."""

    name: str
    description: str
    handler: Callable[..., SkillResult]


@dataclass
class SkillRegistry:
    """Реестр скиллов одного агента."""

    _skills: dict[str, Skill] = field(default_factory=dict)

    def register(self, skill: Skill) -> None:
        """Регистрирует скилл; дубликат имени — ошибка конфигурации."""
        if skill.name in self._skills:
            raise ValueError(f"Skill '{skill.name}' is already registered")
        self._skills[skill.name] = skill

    def get(self, name: str) -> Skill:
        """Возвращает скилл по имени; отсутствие — ошибка с подсказкой."""
        try:
            return self._skills[name]
        except KeyError:
            available = ", ".join(sorted(self._skills)) or "<empty>"
            raise KeyError(f"Skill '{name}' not found. Available: {available}") from None

    def names(self) -> list[str]:
        """Отсортированный список имён зарегистрированных скиллов."""
        return sorted(self._skills)

    def describe(self) -> str:
        """Человекочитаемая сводка для промпта/лога агента."""
        lines = [f"- {s.name}: {s.description}" for _, s in sorted(self._skills.items())]
        return "\n".join(lines) or "<no skills registered>"
