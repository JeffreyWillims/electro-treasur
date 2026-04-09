import asyncio
import json
from arq import create_pool
from arq.connections import RedisSettings
from redis.asyncio import Redis


async def test_ai():
    print("Connecting to Redis...")
    arq_redis = await create_pool(
        RedisSettings(host="localhost", port=6379, database=1)
    )
    cache_redis = Redis.from_url("redis://localhost:6379/0", decode_responses=True)

    print("Enqueueing task...")
    job = await arq_redis.enqueue_job("generate_annual_llm_insight", 1, 2026)

    print(f"Waiting for job {job.job_id}...")
    for _ in range(20):
        await asyncio.sleep(1)
        res = await cache_redis.get("insight:1:2026")
        if res:
            data = json.loads(res)
            print("\n==== AI ADVISOR INSIGHT ====")
            print(data["insight"])
            print("============================")
            await cache_redis.aclose()
            return
    print("Timeout waiting for AI insight.")
    await cache_redis.aclose()


if __name__ == "__main__":
    asyncio.run(test_ai())
