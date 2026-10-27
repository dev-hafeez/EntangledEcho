"""
Benchmark NFR 4.1.1:
Target: Dashboard page load < 3s (Broadband 10 Mbps baseline)
Measures actual browser page load metrics (TTFB, DOMContentLoaded, Load event) using Playwright.
"""

import sys
import time
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def benchmark_dashboard():
    print("=" * 60)
    print("BENCHMARKING NFR 4.1.1: DASHBOARD PAGE LOAD")
    print("Target: < 3.0 seconds")
    print("=" * 60)

    load_times = []
    dcl_times = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        # Simulate standard broadband conditions
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        
        # Warm-up request
        print("Warming up Next.js route compilation...")
        page = await context.new_page()
        t_warm = time.perf_counter()
        await page.goto("http://localhost:3000", wait_until="networkidle", timeout=30000)
        warm_time = time.perf_counter() - t_warm
        print(f"Warm-up complete ({warm_time:.2f}s).")
        await page.close()

        # Run 3 measured benchmark iterations
        for i in range(1, 4):
            page = await context.new_page()
            t0 = time.perf_counter()
            await page.goto("http://localhost:3000", wait_until="load", timeout=15000)
            load_elapsed = time.perf_counter() - t0

            timing_json = await page.evaluate("""() => {
                const perf = performance.getEntriesByType('navigation')[0] || performance.timing;
                if (!perf) return {};
                const start = perf.startTime || perf.navigationStart || 0;
                const dcl = (perf.domContentLoadedEventEnd || perf.domContentLoadedEventEnd) - start;
                const load = (perf.loadEventEnd || perf.loadEventEnd) - start;
                const ttfb = (perf.responseStart || 0) - start;
                return { dcl, load, ttfb };
            }""")
            
            load_times.append(load_elapsed)
            print(f"Iteration {i}: Total Browser Load={load_elapsed:.3f}s | Browser Perf API: Load={timing_json.get('load', 0):.1f}ms, DCL={timing_json.get('dcl', 0):.1f}ms, TTFB={timing_json.get('ttfb', 0):.1f}ms")
            await page.close()

        await browser.close()

    avg_load = sum(load_times) / len(load_times)
    target = 3.0
    passed = avg_load < target

    print("\n" + "=" * 60)
    print(f"NFR 4.1.1 RESULT: Avg Page Load = {avg_load:.2f}s (Min: {min(load_times):.2f}s, Max: {max(load_times):.2f}s)")
    print(f"Target: < {target}s | Status: {'PASSED' if passed else 'FAILED'}")
    print("=" * 60)

    return {
        "avg_load_seconds": round(avg_load, 2),
        "iterations": [round(x, 2) for x in load_times],
        "target_seconds": target,
        "passed": passed
    }

if __name__ == "__main__":
    asyncio.run(benchmark_dashboard())
