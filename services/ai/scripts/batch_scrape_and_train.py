"""
Batch Scraper & Global Engagement Model Training Pipeline
Scrapes the user's curated 100 creators across sports, music, film, fashion, and culture.
Extracts post dynamics and trains the global machine learning model.
"""

import sys
import os
import asyncio
import time
import json
import logging
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import pandas as pd

# Set up paths
AI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_DIR))

from app.playwright_scraper import scrape_instagram_profile_and_posts
from app.niche_detector import detect_creator_niche
from app.db import (
    get_cached_profile_and_posts,
    save_profile_and_posts,
    list_all_cached_profiles
)
from app.ml.features import extract_features, FEATURE_COLUMNS, parse_timestamp
from app.ml.train_global_model import train_global_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("batch_pipeline")

TARGET_CREATORS = [
    "instagram", "cristiano", "leomessi", "selenagomez", "kyliejenner",
    "therock", "arianagrande", "kimkardashian", "beyonce", "khloekardashian",
    "nike", "kendalljenner", "justinbieber", "taylorswift", "virat.kohli",
    "jlo", "nickiminaj", "kourtneykardash", "mileycyrus", "katyperry",
    "neymarjr", "zendaya", "kevinhart4real", "iamcardib", "ddlovato",
    "badgalriri", "kingjames", "davidbeckham", "champagnepapi", "chrisbrownofficial",
    "billieeilish", "dualipa", "shakira", "priyankachopra", "aliaabhatt",
    "deepikapadukone", "ranveersingh", "shraddhakapoor", "katrinakaif", "dishapatani",
    "urvashirautela", "jennierubyjane", "lalalalisa_m", "sooyaaa__", "roses_are_rosie",
    "thv", "j.m", "jin", "agustd", "rkive",
    "uarmyhope", "bts.bighitofficial", "blackpinkofficial", "eminem", "snoopdogg",
    "wizkhalifa", "postmalone", "travisscott", "theweeknd", "sza",
    "lilwayne", "50cent", "marshmello", "maroon5", "edsheeran",
    "shawnmendes", "camila_cabello", "harrystyles", "zayn", "tomcruise",
    "willsmith", "jackiechan", "robertdowneyjr", "gal_gadot", "jasonstatham",
    "vindiesel", "prattprattpratt", "chrishemsworth", "anushkasharma", "sachintendulkar",
    "msdhoni", "rohitsharma45", "hardikpandya93", "jaspritb1", "babarazam",
    "imrankhan.pti", "atifaslam", "mahirahkhan", "sajalaly", "ayeshaghaofficial",
    "hiraattique", "fawadkhan81", "hamzaabbasiofficial", "dananeer", "mominamustehsan",
    "asimmiaz", "itzmaazkhan"
]


async def run_batch_scrape(batch_limit: int = 40):
    """
    Scrapes uncached creators from the list and saves them to the database.
    Rate-limited gracefully with cooldown between profiles.
    """
    # Deduplicate while preserving order
    unique_handles = []
    seen = set()
    for h in TARGET_CREATORS:
        clean = h.strip().lstrip("@").lower().replace(" ", "")
        if clean and clean not in seen:
            seen.add(clean)
            unique_handles.append(clean)

    logger.info(f"Total target handles: {len(unique_handles)}")

    # Check already cached
    cached_profiles = {p["handle"].lower() for p in list_all_cached_profiles()}
    logger.info(f"Already cached in database: {len(cached_profiles)} profiles")

    pending = [h for h in unique_handles if h not in cached_profiles]
    logger.info(f"Pending to scrape: {len(pending)} profiles")

    # Process up to batch_limit to stay healthy with respect to Instagram rate limits
    to_scrape = pending[:batch_limit]
    logger.info(f"Scraping batch of {len(to_scrape)} profiles...")

    success_count = 0
    fail_count = 0

    for idx, handle in enumerate(to_scrape, 1):
        logger.info(f"[{idx}/{len(to_scrape)}] Scraping @{handle}...")
        try:
            data = await scrape_instagram_profile_and_posts(handle, max_posts=12, headless=True)
            if data.get("status") == "success" and data.get("account"):
                acc = data["account"]
                posts = data.get("posts", [])
                
                # Detect niche
                niche_res = await detect_creator_niche(acc, posts)
                acc["niche"] = niche_res.get("primary_niche")
                acc["niche_info"] = niche_res
                
                save_profile_and_posts(handle, acc, posts, niche_res)
                logger.info(f"✓ Saved @{handle}: {len(posts)} posts, niche='{acc['niche']}', {acc.get('followers', 0):,} followers")
                success_count += 1
            else:
                logger.warning(f"⚠ Could not scrape @{handle}: {data.get('error', 'empty data')}")
                fail_count += 1
        except Exception as e:
            logger.error(f"✗ Error scraping @{handle}: {e}")
            fail_count += 1

        # Graceful pause between requests
        await asyncio.sleep(1.5)

    logger.info(f"Batch Scraping Complete: {success_count} scraped, {fail_count} failed, {len(cached_profiles) + success_count} total stored in DB.")


def sync_db_to_global_dataset():
    """
    Extracts all posts stored in SQLite database, calculates feature vectors,
    and appends them to global_instagram_dataset.csv for model training.
    """
    import sqlite3
    db_path = AI_DIR / "data" / "entangled_echo.db"
    csv_path = AI_DIR / "data" / "global_instagram_dataset.csv"

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Query all posts and their profile follower count
    query = """
        SELECT p.handle, p.caption, p.media_type, p.hashtags, p.posted_at, 
               p.likes, p.comments, p.reach, pr.followers, pr.niche,
               COALESCE(p.is_real_metrics, 0) as is_real_metrics
        FROM scraped_posts p
        JOIN scraped_profiles pr ON p.handle = pr.handle
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    logger.info(f"Found {len(rows)} real posts across stored profiles in database.")
    if not rows:
        logger.warning("No posts in database to sync.")
        return

    new_records = []
    for row in rows:
        handle, caption, media_type, hashtags_raw, posted_at, likes, comments, reach, followers, niche, is_real_metrics = row
        try:
            tags = json.loads(hashtags_raw) if hashtags_raw else []
        except Exception:
            tags = []

        followers_val = max(int(followers or 1000), 100)
        likes_val = max(int(likes or 10), 1)
        comments_val = max(int(comments or 1), 0)
        reach_val = max(int(reach or followers_val * 0.3), 100)

        # Calculate engagement rate: (likes + comments) / reach * 100
        engagement_rate = round(((likes_val + comments_val) / reach_val) * 100, 3)

        feats = extract_features(
            media_type=media_type or "image",
            posted_at=posted_at or datetime.now(),
            caption=caption or "",
            hashtags=tags,
            followers=followers_val
        )

        record = {
            "handle": handle,
            "category": niche or "General",
            "media_type": media_type or "image",
            "posted_at": posted_at,
            "likes": likes_val,
            "comments": comments_val,
            "reach": reach_val,
            "followers": followers_val,
            "is_real_metrics": bool(is_real_metrics),
            "engagement_rate": engagement_rate,
            **feats
        }
        new_records.append(record)

    new_df = pd.DataFrame(new_records)

    # Merge with existing CSV if present, deduplicating
    if csv_path.exists():
        existing_df = pd.read_csv(csv_path)
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
        # Drop duplicates based on handle and posted_at
        if "posted_at" in combined_df.columns:
            combined_df = combined_df.drop_duplicates(subset=["handle", "posted_at"], keep="last")
    else:
        combined_df = new_df

    combined_df.to_csv(csv_path, index=False)
    logger.info(f"Global dataset updated at {csv_path}: {len(combined_df)} total training rows.")


def train_and_reload():
    """Trains the global ML model on the updated dataset."""
    logger.info("Starting Global Model Training...")
    result = train_global_model()
    logger.info(f"Model Training Results: R^2={result['metrics']['r2_score']}, MAE={result['metrics']['mae_engagement_rate']}%")
    logger.info(f"Top Features: {result['feature_importances']}")


async def main():
    logger.info("=== Starting Entangled Echo Batch Ingestion & Training Pipeline ===")
    
    # Run batch scraper for uncached creators
    await run_batch_scrape(batch_limit=35)
    
    # Sync DB posts into CSV training format
    sync_db_to_global_dataset()
    
    # Train the Global Engagement Model
    train_and_reload()
    
    logger.info("=== Pipeline Completed Successfully ===")


if __name__ == "__main__":
    asyncio.run(main())
