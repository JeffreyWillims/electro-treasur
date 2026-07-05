"""Мультиагентная подсистема Citrine Vault: агенты, скиллы, оркестратор.

База знаний — в docs/ (инструкции и правила по ролям), обзор — в README.md.
"""

from src.agents.agents.backend_agent import BackendAgent
from src.agents.base_agent import BaseAgent
from src.agents.orchestrator import Orchestrator
from src.agents.skill_registry import Skill, SkillRegistry, SkillResult

__all__ = [
    "BackendAgent",
    "BaseAgent",
    "Orchestrator",
    "Skill",
    "SkillRegistry",
    "SkillResult",
]
