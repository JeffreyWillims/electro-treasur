"""
run_arq.py — Python 3.14+ compatible ARQ worker launcher.

Python 3.14 removed the implicit main-thread event loop created by
`asyncio.get_event_loop()`. The `arq` CLI (≤ 0.27) calls this internally in
`Worker.__init__`, causing a RuntimeError before any async code runs.

Fix (v2): Instantiate Worker INSIDE the async context so `get_event_loop()`
finds the loop created by `asyncio.run()`. We use `Worker.async_run()` which
is the fully-async entry point that avoids the run_in_executor bridging.
"""

import asyncio

from arq import Worker

from src.infrastructure.workers.llm_worker import WorkerSettings


async def _run() -> None:
    """
    Instantiate and run the ARQ worker fully inside an async context.
    This ensures asyncio.get_event_loop() succeeds inside Worker.__init__
    because we are already running inside asyncio.run().
    """
    worker = Worker(
        functions=WorkerSettings.functions,
        on_startup=WorkerSettings.on_startup,
        on_shutdown=WorkerSettings.on_shutdown,
        redis_settings=WorkerSettings.redis_settings,
        max_jobs=WorkerSettings.max_jobs,
        job_timeout=WorkerSettings.job_timeout,
    )
    await worker.async_run()


if __name__ == "__main__":
    # asyncio.run() creates a fresh event loop, sets it as the current loop,
    # and tears it down cleanly after completion.
    asyncio.run(_run())
