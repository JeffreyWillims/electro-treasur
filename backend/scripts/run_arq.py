import asyncio
import sys
from pathlib import Path

# Ensure backend/ is on sys.path so `src.*` imports resolve correctly
# regardless of the working directory the script is launched from.
sys.path.insert(0, str(Path(__file__).parent.parent))

# Windows asyncio workaround (deprecated in 3.16 — will be removed later)
if sys.platform == "win32":
    asyncio.set_event_loop(asyncio.new_event_loop())

from arq.worker import run_worker

from src.infrastructure.workers.llm_worker import WorkerSettings

if __name__ == "__main__":
    run_worker(WorkerSettings)
