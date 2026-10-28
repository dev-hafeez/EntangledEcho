#!/usr/bin/env python3
"""
Migrates all local SQLite data (entangled_echo.db) to remote Supabase Postgres.
Runs batch upserts using the Supabase Service Role Key.
"""

import os
import json
import sqlite3
from pathlib import Path
from supabase import create_client

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "services/ai" / "data" / "entangled_echo.db"

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://pndypqsppmgumamaeuef.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZHlwcXNwcG1ndW1hbWFldWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzE3MTQ1NywiZXhwIjoyMTA4NzQ3NDU3fQ.a5IBpu0FIs9QhDZuasfy0bXafn4jwxekUvKEV9uemiE")


def get_sqlite_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def migrate():
    print(f"Connecting to Supabase at {SUPABASE_URL}...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    conn = get_sqlite_conn()
    cursor = conn.cursor()

    # 1. Migrate scraped_profiles
    print("\n[1/7] Migrating scraped_profiles...")
    cursor.execute("SELECT * FROM scraped_profiles")
    profile_rows = cursor.fetchall()
    print(f"Found {len(profile_rows)} profiles in SQLite.")

    profiles_batch = []
    for r in profile_rows:
        niche_info = None
        if r["niche_info"]:
            try:
                niche_info = json.loads(r["niche_info"])
            except Exception:
                niche_info = None

        profiles_batch.append({
            "handle": r["handle"].strip().lstrip("@").lower(),
            "platform": r["platform"] or "instagram",
            "followers": r["followers"] or 0,
            "following": r["following"] or 0,
            "media_count": r["media_count"] or 0,
            "avatar_url": r["avatar_url"],
            "bio": r["bio"] or "",
            "niche": r["niche"],
            "niche_info": niche_info,
            "created_at": r["created_at"],
            "last_scraped_at": r["last_scraped_at"]
        })

    # Upload in chunks of 200
    for i in range(0, len(profiles_batch), 200):
        chunk = profiles_batch[i:i + 200]
        res = supabase.table("scraped_profiles").upsert(chunk, on_conflict="handle").execute()
        print(f"  Uploaded profiles {i} to {min(i + 200, len(profiles_batch))} of {len(profiles_batch)}")

    # 2. Migrate scraped_posts
    print("\n[2/7] Migrating scraped_posts...")
    cursor.execute("SELECT * FROM scraped_posts")
    post_rows = cursor.fetchall()
    print(f"Found {len(post_rows)} posts in SQLite.")

    posts_batch = []
    for r in post_rows:
        hashtags = []
        if r["hashtags"]:
            try:
                hashtags = json.loads(r["hashtags"])
            except Exception:
                hashtags = []

        topics = []
        if r["topics"]:
            try:
                topics = json.loads(r["topics"])
            except Exception:
                topics = []

        posts_batch.append({
            "id": r["id"],
            "handle": r["handle"].strip().lstrip("@").lower(),
            "post_url": r["post_url"],
            "media_url": r["media_url"],
            "media_type": r["media_type"] or "image",
            "caption": r["caption"] or "",
            "hashtags": hashtags,
            "posted_at": r["posted_at"],
            "posted_at_is_real": r["posted_at_is_real"] if "posted_at_is_real" in r.keys() else 0,
            "perf_score": r["perf_score"] or 0.5,
            "likes": r["likes"] or 0,
            "comments": r["comments"] or 0,
            "reach": r["reach"] or 0,
            "is_real_metrics": r["is_real_metrics"] if "is_real_metrics" in r.keys() else 0,
            "sentiment": r["sentiment"] or 0.5,
            "topics": topics,
            "created_at": r["created_at"]
        })

    for i in range(0, len(posts_batch), 200):
        chunk = posts_batch[i:i + 200]
        res = supabase.table("scraped_posts").upsert(chunk, on_conflict="handle,post_url").execute()
        print(f"  Uploaded posts {i} to {min(i + 200, len(posts_batch))} of {len(posts_batch)}")

    # 3. Migrate creator_preferences
    print("\n[3/7] Migrating creator_preferences...")
    cursor.execute("SELECT * FROM creator_preferences")
    pref_rows = cursor.fetchall()
    for r in pref_rows:
        pref = {
            "handle": r["handle"].strip().lstrip("@").lower(),
            "preferred_media_types": json.loads(r["preferred_media_types"]) if r["preferred_media_types"] else [],
            "preferred_hashtag_clusters": json.loads(r["preferred_hashtag_clusters"]) if r["preferred_hashtag_clusters"] else [],
            "preferred_tone": r["preferred_tone"] or "ENGAGING",
            "updated_at": r["updated_at"]
        }
        supabase.table("creator_preferences").upsert(pref, on_conflict="handle").execute()
    print(f"  Uploaded {len(pref_rows)} creator preferences.")

    # 4. Migrate optimization_jobs
    print("\n[4/7] Migrating optimization_jobs...")
    cursor.execute("SELECT * FROM optimization_jobs")
    job_rows = cursor.fetchall()
    for r in job_rows:
        job = {
            "id": r["id"],
            "handle": r["handle"],
            "status": r["status"] or "completed",
            "horizon_days": r["horizon_days"] or 7,
            "target_posts": r["target_posts"] or 5,
            "min_gap_hours": r["min_gap_hours"] or 4,
            "constraints": json.loads(r["constraints"]) if r["constraints"] else {},
            "primary_schedule": json.loads(r["primary_schedule"]) if r["primary_schedule"] else None,
            "alternatives": json.loads(r["alternatives"]) if r["alternatives"] else [],
            "schedule_confidence": r["schedule_confidence"] or 0.85,
            "qubo_stats": json.loads(r["qubo_stats"]) if r["qubo_stats"] else {},
            "created_at": r["created_at"]
        }
        supabase.table("optimization_jobs").upsert(job, on_conflict="id").execute()
    print(f"  Uploaded {len(job_rows)} optimization jobs.")

    # 5. Migrate recommendations
    print("\n[5/7] Migrating recommendations...")
    cursor.execute("SELECT * FROM recommendations")
    rec_rows = cursor.fetchall()
    for r in rec_rows:
        rec = {
            "id": r["id"],
            "handle": r["handle"],
            "type": r["type"],
            "content": json.loads(r["content"]) if r["content"] else {},
            "confidence_score": r["confidence_score"] or 0.85,
            "accepted": bool(r["accepted"]) if r["accepted"] is not None else None,
            "feedback": r["feedback"],
            "created_at": r["created_at"]
        }
        supabase.table("recommendations").upsert(rec, on_conflict="id").execute()
    print(f"  Uploaded {len(rec_rows)} recommendations.")

    # 6. Migrate scheduled_posts
    print("\n[6/7] Migrating scheduled_posts...")
    cursor.execute("SELECT * FROM scheduled_posts")
    sched_rows = cursor.fetchall()
    for r in sched_rows:
        post = {
            "id": r["id"],
            "handle": r["handle"],
            "title": r["title"] or "",
            "caption": r["caption"] or "",
            "hashtags": json.loads(r["hashtags"]) if r["hashtags"] else [],
            "media_type": r["media_type"] or "image",
            "media_url": r["media_url"],
            "day_of_week": r["day_of_week"],
            "time_slot": r["time_slot"],
            "scheduled_time": r["scheduled_time"],
            "status": r["status"] or "SCHEDULED",
            "created_at": r["created_at"]
        }
        supabase.table("scheduled_posts").upsert(post, on_conflict="id").execute()
    print(f"  Uploaded {len(sched_rows)} scheduled posts.")

    print("\n========================================================")
    print("✓ SUCCESS: All local SQLite data successfully migrated to Supabase!")
    print("========================================================")


if __name__ == "__main__":
    migrate()
