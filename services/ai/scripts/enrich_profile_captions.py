"""
Enrich Profile Captions Script
Visits individual Instagram post URLs for designated creators and extracts:
- Real authentic captions from og:title and og:description
- Genuine likes and comments count
- Exact hashtags
Updates SQLite database entangled_echo.db so every post has genuine creator captions.
"""

import asyncio
import re
import sys
import sqlite3
import logging
from pathlib import Path
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "entangled_echo.db"

def parse_metric_string(s: str) -> int:
    if not s:
        return 0
    clean = s.replace(",", "").strip()
    if clean.lower().endswith("k"):
        return int(float(clean[:-1]) * 1000)
    elif clean.lower().endswith("m"):
        return int(float(clean[:-1]) * 1000000)
    elif clean.lower().endswith("b"):
        return int(float(clean[:-1]) * 1000000000)
    try:
        return int(float(clean))
    except Exception:
        return 0

async def enrich_handles(handles: list[str]):
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    cur = conn.cursor()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        )

        async def fetch_post(post_id, post_url):
            page = await context.new_page()
            try:
                await page.goto(post_url, wait_until="domcontentloaded", timeout=12000)
                data = await page.evaluate("""() => {
                    const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
                    const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
                    return { ogTitle, ogDesc };
                }""")
                return post_id, post_url, data
            except Exception as e:
                return post_id, post_url, {"error": str(e)}
            finally:
                await page.close()

        for handle in handles:
            clean_handle = handle.strip().lstrip("@").lower()
            cur.execute("SELECT id, post_url, caption FROM scraped_posts WHERE LOWER(handle) = ?", (clean_handle,))
            rows = cur.fetchall()
            if not rows:
                logger.info(f"No posts found in db for @{clean_handle}")
                continue

            logger.info(f"Enriching {len(rows)} posts for @{clean_handle}...")
            chunk_size = 4
            all_results = []
            for i in range(0, len(rows), chunk_size):
                chunk = rows[i:i + chunk_size]
                tasks = [fetch_post(r[0], r[1]) for r in chunk]
                res = await asyncio.gather(*tasks)
                all_results.extend(res)
                await asyncio.sleep(0.3)

            for post_id, url, data in all_results:
                og_title = data.get("ogTitle", "")
                og_desc = data.get("ogDesc", "")

                caption = ""
                # 1. From og:title
                m1 = re.search(r'on Instagram(?:\u200e)?:\s*[\"“](.*?)[\"”](?:\s*$|\s*#)', og_title, re.DOTALL)
                if m1 and len(m1.group(1).strip()) > 0:
                    caption = m1.group(1).strip()
                elif og_desc:
                    # 2. From og:description
                    m2 = re.search(r'[\d.,]+[KkMmBb]?\s*comments\s*-\s*[^:]+:\s*[\"“](.*?)[\"”]', og_desc, re.DOTALL)
                    if m2 and len(m2.group(1).strip()) > 0:
                        caption = m2.group(1).strip()

                likes = 0
                comments = 0
                l_match = re.search(r'([\d.,]+[KkMmBb]?)\s*likes', og_desc, re.I)
                if l_match:
                    likes = parse_metric_string(l_match.group(1))
                c_match = re.search(r'([\d.,]+[KkMmBb]?)\s*comments', og_desc, re.I)
                if c_match:
                    comments = parse_metric_string(c_match.group(1))

                hashtags = re.findall(r'#\w+', caption) if caption else [f"#{clean_handle}"]

                final_caption = caption if caption else "No caption provided."
                cur.execute("""
                    UPDATE scraped_posts
                    SET caption = ?,
                        likes = CASE WHEN ? > 0 THEN ? ELSE likes END,
                        comments = CASE WHEN ? > 0 THEN ? ELSE comments END
                    WHERE id = ?
                """, (final_caption, likes, likes, comments, comments, post_id))

            conn.commit()
            logger.info(f"✓ Saved authentic captions & metrics for @{clean_handle}")

        await browser.close()

    conn.close()
    logger.info("Enrichment batch completed successfully!")

if __name__ == "__main__":
    handles_to_enrich = [
        "farishafi",
        "cristiano",
        "virat.kohli",
        "mrbeast",
        "tenzofficial",
        "zakirkhan_208",
        "claudeai",
        "bytebytego",
        "hafeezisnt",
        "kaleem._.abbasi830"
    ]
    if len(sys.argv) > 1:
        handles_to_enrich = sys.argv[1:]

    asyncio.run(enrich_handles(handles_to_enrich))
