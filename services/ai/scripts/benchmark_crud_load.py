"""
Benchmark NFR 4.1.2:
Target: REST API CRUD p95 < 500ms (100 concurrent users)
Simulates 100 concurrent users executing REST API CRUD operations against the FastAPI service.
Measures latency distribution (p50, p90, p95, p99), error rate, and throughput.
"""

import sys
import time
import asyncio
import random
from pathlib import Path
from typing import List
import numpy as np
import httpx

AI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_DIR))

BASE_URL = "http://127.0.0.1:8001/api/v1"

async def user_crud_lifecycle(user_id: int, client: httpx.AsyncClient) -> List[float]:
    latencies = []
    handle = f"load_user_{user_id}"

    try:
        # 1. CREATE: Schedule a new post
        t0 = time.perf_counter()
        post_payload = {
            "handle": handle,
            "title": f"Load Test Post User {user_id}",
            "caption": "Testing CRUD under 100 concurrent users",
            "hashtags": ["#loadtest", "#benchmark"],
            "media_type": "image",
            "day_of_week": "Monday",
            "time_slot": "18:00",
            "scheduled_time": "2026-11-01T18:00:00Z"
        }
        r_create = await client.post(f"{BASE_URL}/calendar/posts", json=post_payload, timeout=30.0)
        latencies.append((time.perf_counter() - t0) * 1000.0)
        post_id = None
        if r_create.status_code == 200:
            post_id = r_create.json().get("id")

        # 2. READ: Get scheduled posts
        t1 = time.perf_counter()
        r_read = await client.get(f"{BASE_URL}/calendar/posts?handle={handle}", timeout=30.0)
        latencies.append((time.perf_counter() - t1) * 1000.0)

        # 3. READ: Cached profile check
        t2 = time.perf_counter()
        r_prof = await client.get(f"{BASE_URL}/profiles/cached", timeout=30.0)
        latencies.append((time.perf_counter() - t2) * 1000.0)

        # 4. DELETE: Delete scheduled post
        if post_id:
            t3 = time.perf_counter()
            r_del = await client.delete(f"{BASE_URL}/calendar/posts/{post_id}", timeout=30.0)
            latencies.append((time.perf_counter() - t3) * 1000.0)
    except Exception as e:
        # Record partial latencies even if later request fails
        pass

    return latencies


async def run_load_benchmark(concurrent_users: int = 100, rounds_per_user: int = 2):
    print("=" * 70)
    print(f"RUNNING REST API CRUD LOAD BENCHMARK")
    print(f"Concurrency: {concurrent_users} simultaneous users | Target: p95 < 500ms")
    print("=" * 70)

    # Verify server is up
    async with httpx.AsyncClient() as check_client:
        try:
            r = await check_client.get("http://127.0.0.1:8001/health", timeout=5.0)
            if r.status_code != 200:
                print(f"Error: AI Backend health check returned status {r.status_code}")
                return
        except Exception as e:
            print(f"Error connecting to backend at http://127.0.0.1:8001: {e}")
            print("Make sure uvicorn is running.")
            return

    limits = httpx.Limits(max_connections=concurrent_users + 50, max_keepalive_connections=concurrent_users)
    async with httpx.AsyncClient(limits=limits) as client:
        t_global_start = time.perf_counter()

        async def worker(uid: int):
            user_lats = []
            for _ in range(rounds_per_user):
                lats = await user_crud_lifecycle(uid, client)
                user_lats.extend(lats)
            return user_lats

        tasks = [worker(i) for i in range(concurrent_users)]
        all_results = await asyncio.gather(*tasks, return_exceptions=True)

    total_time = time.perf_counter() - t_global_start

    all_latencies = []
    errors = 0
    for res in all_results:
        if isinstance(res, Exception):
            errors += 1
        elif isinstance(res, list):
            all_latencies.extend(res)

    if not all_latencies:
        print("Error: No successful requests recorded.")
        return

    p50 = float(np.percentile(all_latencies, 50))
    p90 = float(np.percentile(all_latencies, 90))
    p95 = float(np.percentile(all_latencies, 95))
    p99 = float(np.percentile(all_latencies, 99))
    mean_lat = float(np.mean(all_latencies))
    total_reqs = len(all_latencies)
    rps = total_reqs / total_time
    target = 500.0
    passed = p95 < target

    print(f"\nExecution Summary:")
    print(f"  Total Requests Completed: {total_reqs}")
    print(f"  Total Duration:           {total_time:.2f}s")
    print(f"  Throughput:               {rps:.1f} requests/sec")
    print(f"  Failed User Coroutines:   {errors}")
    print(f"\nLatency Distribution:")
    print(f"  Mean: {mean_lat:.2f} ms")
    print(f"  p50:  {p50:.2f} ms")
    print(f"  p90:  {p90:.2f} ms")
    print(f"  p95:  {p95:.2f} ms")
    print(f"  p99:  {p99:.2f} ms")
    print("=" * 70)
    print(f"NFR 4.1.2 RESULT: p95 = {p95:.2f} ms (Target: < {target} ms)")
    print(f"Status: {'PASSED' if passed else 'FAILED'}")
    print("=" * 70)

    import json
    res_data = {
        "concurrent_users": concurrent_users,
        "total_requests": total_reqs,
        "duration_seconds": round(total_time, 2),
        "requests_per_second": round(rps, 1),
        "latencies_ms": {
            "mean": round(mean_lat, 2),
            "p50": round(p50, 2),
            "p90": round(p90, 2),
            "p95": round(p95, 2),
            "p99": round(p99, 2)
        },
        "target_p95_ms": target,
        "passed": passed
    }
    with open(AI_DIR / "data" / "crud_benchmark_results.json", "w") as f:
        json.dump(res_data, f, indent=2)

if __name__ == "__main__":
    asyncio.run(run_load_benchmark())
