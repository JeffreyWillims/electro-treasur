# agents/skills

Низкоуровневые «скиллы» — атомарные действия, которые агенты вызывают через `SkillRegistry`.

- `__init__.py` — маркер пакета, пустой.
- `file_skills.py` — `read_file`/`write_file`/`list_files` в песочнице: все пути
  разрешаются строго внутри `root` (абсолютные пути и выход через `..`/симлинки отклоняются),
  чтение ограничено 1 МБ.
- `test_skills.py` — верификация кода: `build_ruff_command`/`build_mypy_command`/`build_pytest_command`
  (чистые функции-конструкторы команд) + `run_command`/`run_ruff`/`run_mypy`/`run_pytest`
  (запуск через `subprocess.run` без `shell=True`, с таймаутом и обрезкой вывода).
