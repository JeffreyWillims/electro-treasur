import asyncio
import sys

# Windows asyncio workaround
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.set_event_loop(asyncio.new_event_loop())

from arq.worker import run_worker
from src.infrastructure.workers.llm_worker import WorkerSettings

if __name__ == '__main__':
    run_worker(WorkerSettings)
