import asyncio
import sys
from pathlib import Path

# Добавляем backend/ в sys.path, чтобы импорты `src.*` резолвились корректно
# независимо от рабочей директории, из которой запущен скрипт.
sys.path.insert(0, str(Path(__file__).parent.parent))

# Обходной путь для asyncio на Windows (устарело в 3.16 — будет удалено позже)
if sys.platform == "win32":
    asyncio.set_event_loop(asyncio.new_event_loop())

from arq.worker import run_worker

from src.infrastructure.workers.insight_scheduler import WorkerSettings

if __name__ == "__main__":
    run_worker(WorkerSettings)
