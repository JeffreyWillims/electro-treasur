"""
File Skills — чтение/запись файлов проекта с песочницей.

Безопасность (обязательные инварианты):
  • Все пути — относительные и разрешаются строго внутри root;
    абсолютные пути и выход через `..`/симлинки отклоняются.
  • Чтение ограничено MAX_READ_BYTES — защита от случайного
    затягивания бинарников/дампов в контекст агента.
"""

from __future__ import annotations

from pathlib import Path

from src.agents.skill_registry import SkillResult

MAX_READ_BYTES = 1_000_000  # 1 MB


def _resolve_inside(root: Path, rel_path: str) -> Path:
    """Разрешает rel_path внутри root; любой выход за пределы — ValueError."""
    if Path(rel_path).is_absolute():
        raise ValueError(f"Absolute paths are not allowed: {rel_path}")
    resolved = (root / rel_path).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise ValueError(f"Path escapes project root: {rel_path}")
    return resolved


def read_file(root: Path, rel_path: str) -> SkillResult:
    """Читает текстовый файл внутри root (до MAX_READ_BYTES)."""
    try:
        target = _resolve_inside(root, rel_path)
    except ValueError as e:
        return SkillResult(ok=False, output=str(e))
    if not target.is_file():
        return SkillResult(ok=False, output=f"Not a file: {rel_path}")
    if target.stat().st_size > MAX_READ_BYTES:
        return SkillResult(
            ok=False, output=f"File exceeds {MAX_READ_BYTES} bytes limit: {rel_path}"
        )
    return SkillResult(ok=True, output=target.read_text(encoding="utf-8"))


def write_file(root: Path, rel_path: str, content: str) -> SkillResult:
    """Пишет текстовый файл внутри root, создавая родительские каталоги."""
    try:
        target = _resolve_inside(root, rel_path)
    except ValueError as e:
        return SkillResult(ok=False, output=str(e))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return SkillResult(ok=True, output=f"Wrote {len(content)} chars to {rel_path}")


def list_files(root: Path, pattern: str = "**/*.py") -> SkillResult:
    """Список файлов по glob-паттерну относительно root (отсортирован)."""
    if Path(pattern).is_absolute():
        return SkillResult(ok=False, output=f"Absolute patterns are not allowed: {pattern}")
    matches = sorted(str(p.relative_to(root)) for p in root.glob(pattern) if p.is_file())
    return SkillResult(ok=True, output="\n".join(matches))
