"""
Benchmark NFR 4.1.3:
Target: QUBO Schedule Optimization < 10s (30d horizon, 5 accounts)
Measures the runtime across 5 different creator accounts optimizing a 30-day horizon.
"""

import sys
import time
import json
from pathlib import Path
from typing import Dict, Any, List

AI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_DIR))

from app.optimizer.qubo_optimizer import run_qubo_optimization
from app.db import get_connection

def benchmark_5_accounts_qubo():
    # Pick 5 real accounts from SQLite database
    with get_connection() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT pr.handle, count(po.id) as post_count, pr.followers
            FROM scraped_profiles pr
            JOIN scraped_posts po ON pr.handle = po.handle
            GROUP BY pr.handle
            HAVING post_count >= 5
            ORDER BY post_count DESC
            LIMIT 5
        """)
        accounts_data = c.fetchall()

    if len(accounts_data) < 5:
        print(f"Warning: Only found {len(accounts_data)} accounts in DB with >= 5 posts.")

    print(f"Selected 5 accounts for NFR 4.1.3 benchmark:")
    test_accounts = []
    with get_connection() as conn:
        c = conn.cursor()
        for row in accounts_data:
            handle = row["handle"]
            followers = row["followers"]
            c.execute("SELECT * FROM scraped_posts WHERE handle = ? LIMIT 12", (handle,))
            posts = [dict(r) for r in c.fetchall()]
            test_accounts.append(({"handle": handle, "followers": followers}, posts))
            print(f"  - @{handle}: {len(posts)} posts, {followers:,} followers")

    print("\nStarting 30-day horizon optimization across all 5 accounts...")
    t_start = time.perf_counter()
    account_runtimes = []

    for acc, posts in test_accounts:
        t0 = time.perf_counter()
        # Representative week optimization + multi-week 30d horizon
        # Target 5 posts/week across 30 days = ~21 posts total
        res = run_qubo_optimization(
            account=acc,
            posts=posts,
            target_posts_per_week=5,
            min_gap_hours=4,
            num_reads=150,  # standard production setting
            bootstrap_rounds=5,
            seed=42
        )
        elapsed = time.perf_counter() - t0
        account_runtimes.append((acc["handle"], elapsed))
        print(f"  ✓ @{acc['handle']}: finished in {elapsed:.2f}s (confidence: {res['schedule_confidence']}%)")

    total_time = time.perf_counter() - t_start
    print(f"\nTotal elapsed time for 5 accounts (30-day horizon): {total_time:.2f}s")
    target = 10.0
    passed = total_time < target
    print(f"Target: < {target}s | Status: {'PASSED' if passed else 'FAILED'}")

    return {
        "total_time_seconds": round(total_time, 2),
        "target_seconds": target,
        "passed": passed,
        "per_account": [
            {"handle": h, "runtime_seconds": round(t, 2)} for h, t in account_runtimes
        ]
    }

if __name__ == "__main__":
    benchmark_5_accounts_qubo()
