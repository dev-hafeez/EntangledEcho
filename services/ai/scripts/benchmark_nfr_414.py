"""
Benchmark NFR 4.1.4:
Target: AI Caption & Hashtag generation < 5s
Measures the latency of Algorithm 2 (Caption & Hashtag Recommendation Engine).
"""

import sys
import time
import asyncio
from pathlib import Path

AI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_DIR))

from app.recommender.engine import run_ai_recommendation_engine
from app.db import get_connection

async def benchmark_caption_generation():
    # Pick a real account with posts from DB
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("SELECT handle, followers, bio, niche FROM scraped_profiles WHERE media_count > 0 LIMIT 1")
        row = c.fetchone()
        handle = row["handle"]
        acc = dict(row)
        c.execute("SELECT * FROM scraped_posts WHERE handle = ? LIMIT 6", (handle,))
        posts = [dict(r) for r in c.fetchall()]

    print(f"Benchmarking Caption & Hashtag Generation for @{handle} ({len(posts)} posts)...")
    print(f"Target: < 5.0 seconds\n")

    runtimes = []
    runs = 3

    for r in range(1, runs + 1):
        t0 = time.perf_counter()
        res = await run_ai_recommendation_engine(
            account=acc,
            posts=posts,
            recommendation_type="caption",
            user_prompt="Launching a new flagship project this weekend"
        )
        elapsed = time.perf_counter() - t0
        runtimes.append(elapsed)
        draft_count = len(res.get("caption_recommendations", []))
        print(f"Run {r}: {elapsed:.2f}s -> {draft_count} drafts generated (Source: {res.get('recommendation_type')})")

    avg_time = sum(runtimes) / len(runtimes)
    target = 5.0
    passed = avg_time < target

    print("\n" + "=" * 60)
    print(f"NFR 4.1.4 RESULT: Avg {avg_time:.2f}s (Min: {min(runtimes):.2f}s, Max: {max(runtimes):.2f}s)")
    print(f"Target: < {target}s | Status: {'PASSED' if passed else 'FAILED'}")
    print("=" * 60)

    return {
        "avg_seconds": round(avg_time, 2),
        "runtimes": [round(x, 2) for x in runtimes],
        "target_seconds": target,
        "passed": passed
    }

if __name__ == "__main__":
    asyncio.run(benchmark_caption_generation())
