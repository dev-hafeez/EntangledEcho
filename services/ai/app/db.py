"""
Database Layer for Entangled Echo
Provides persistent relational storage and instant caching for all scraped Instagram profiles and posts.
Supports SQLite out of the box (zero-config, high performance, relational).
"""

import sqlite3
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "entangled_echo.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables if they do not exist."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Profiles table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scraped_profiles (
                handle TEXT PRIMARY KEY,
                platform TEXT DEFAULT 'instagram',
                followers INTEGER DEFAULT 0,
                following INTEGER DEFAULT 0,
                media_count INTEGER DEFAULT 0,
                avatar_url TEXT,
                bio TEXT,
                niche TEXT,
                niche_info TEXT,
                created_at TEXT,
                last_scraped_at TEXT
            )
        """)

        # Posts table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scraped_posts (
                id TEXT PRIMARY KEY,
                handle TEXT NOT NULL,
                post_url TEXT,
                media_url TEXT,
                media_type TEXT DEFAULT 'image',
                caption TEXT,
                hashtags TEXT,
                posted_at TEXT,
                perf_score REAL,
                likes INTEGER DEFAULT 0,
                comments INTEGER DEFAULT 0,
                reach INTEGER DEFAULT 0,
                sentiment REAL DEFAULT 0.5,
                topics TEXT,
                created_at TEXT,
                FOREIGN KEY (handle) REFERENCES scraped_profiles(handle) ON DELETE CASCADE
            )
        """)

        # Indexes for high-speed queries
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_posts_handle ON scraped_posts(handle)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON scraped_posts(posted_at)")

        conn.commit()
    logger.info(f"Database initialized at {DB_PATH}")


# Auto-initialize tables on module import
init_db()


def get_cached_profile_and_posts(handle: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves stored profile and posts from database.
    Returns None if profile has never been saved.
    """
    clean_handle = handle.strip().lstrip("@").lower()

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM scraped_profiles WHERE LOWER(handle) = ?", (clean_handle,))
        row = cursor.fetchone()

        if not row:
            return None

        # Fetch posts
        cursor.execute("SELECT * FROM scraped_posts WHERE LOWER(handle) = ? ORDER BY posted_at DESC", (clean_handle,))
        post_rows = cursor.fetchall()

        posts = []
        for pr in post_rows:
            try:
                hashtags = json.loads(pr["hashtags"]) if pr["hashtags"] else []
            except Exception:
                hashtags = []

            try:
                topics = json.loads(pr["topics"]) if pr["topics"] else []
            except Exception:
                topics = []

            posts.append({
                "id": pr["id"],
                "post_url": pr["post_url"],
                "media_url": pr["media_url"],
                "media_type": pr["media_type"],
                "caption": pr["caption"],
                "hashtags": hashtags,
                "posted_at": pr["posted_at"],
                "perf_score": pr["perf_score"],
                "likes": pr["likes"],
                "comments": pr["comments"],
                "reach": pr["reach"],
                "sentiment": pr["sentiment"],
                "topics": topics
            })

        niche_info = {}
        if row["niche_info"]:
            try:
                niche_info = json.loads(row["niche_info"])
            except Exception:
                pass

        account_info = {
            "handle": row["handle"],
            "platform": row["platform"],
            "followers": row["followers"],
            "following": row["following"],
            "media_count": row["media_count"],
            "avatar_url": row["avatar_url"],
            "bio": row["bio"],
            "niche": row["niche"],
            "niche_info": niche_info,
            "last_scraped_at": row["last_scraped_at"],
            "source": "database_cache"
        }

        return {
            "status": "success",
            "source": "database_cache",
            "account": account_info,
            "posts": posts
        }


def save_profile_and_posts(
    handle: str,
    account_info: Dict[str, Any],
    posts: List[Dict[str, Any]],
    niche_info: Optional[Dict[str, Any]] = None
) -> None:
    """
    Saves or updates profile and posts in database.
    """
    clean_handle = handle.strip().lstrip("@").lower()
    now_iso = datetime.now(timezone.utc).isoformat()

    niche_str = None
    if niche_info:
        niche_str = json.dumps(niche_info)

    with get_connection() as conn:
        cursor = conn.cursor()

        # Upsert profile
        cursor.execute("""
            INSERT INTO scraped_profiles (
                handle, platform, followers, following, media_count,
                avatar_url, bio, niche, niche_info, created_at, last_scraped_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(handle) DO UPDATE SET
                platform = excluded.platform,
                followers = excluded.followers,
                following = excluded.following,
                media_count = excluded.media_count,
                avatar_url = COALESCE(excluded.avatar_url, scraped_profiles.avatar_url),
                bio = excluded.bio,
                niche = COALESCE(excluded.niche, scraped_profiles.niche),
                niche_info = COALESCE(excluded.niche_info, scraped_profiles.niche_info),
                last_scraped_at = excluded.last_scraped_at
        """, (
            clean_handle,
            account_info.get("platform", "instagram"),
            account_info.get("followers", 0),
            account_info.get("following", 0),
            account_info.get("media_count", len(posts)),
            account_info.get("avatar_url"),
            account_info.get("bio", ""),
            account_info.get("niche") or (niche_info.get("primary_niche") if niche_info else None),
            niche_str,
            now_iso,
            now_iso
        ))

        # Insert or replace posts
        for idx, p in enumerate(posts, 1):
            post_id = p.get("id") or f"real_{clean_handle}_{idx}"
            cursor.execute("""
                INSERT OR REPLACE INTO scraped_posts (
                    id, handle, post_url, media_url, media_type, caption,
                    hashtags, posted_at, perf_score, likes, comments,
                    reach, sentiment, topics, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                post_id,
                clean_handle,
                p.get("post_url", ""),
                p.get("media_url"),
                p.get("media_type", "image"),
                p.get("caption", ""),
                json.dumps(p.get("hashtags", [])),
                p.get("posted_at", now_iso),
                p.get("perf_score", 0.5),
                p.get("likes", 0),
                p.get("comments", 0),
                p.get("reach", 0),
                p.get("sentiment", 0.5),
                json.dumps(p.get("topics", [])),
                now_iso
            ))

        conn.commit()
    logger.info(f"Saved @{clean_handle} ({len(posts)} posts) to database.")


def list_all_cached_profiles() -> List[Dict[str, Any]]:
    """Lists all stored profiles in the database (for Admin management)."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                p.*,
                (SELECT COUNT(*) FROM scraped_posts WHERE LOWER(handle) = LOWER(p.handle)) as post_count
            FROM scraped_profiles p
            ORDER BY p.last_scraped_at DESC
        """)
        rows = cursor.fetchall()

        profiles = []
        for r in rows:
            profiles.append({
                "handle": r["handle"],
                "platform": r["platform"],
                "followers": r["followers"],
                "following": r["following"],
                "media_count": r["media_count"],
                "post_count": r["post_count"],
                "avatar_url": r["avatar_url"],
                "bio": r["bio"],
                "niche": r["niche"],
                "last_scraped_at": r["last_scraped_at"]
            })
        return profiles


def delete_cached_profile(handle: str) -> bool:
    """Deletes a profile and all its posts from the database."""
    clean_handle = handle.strip().lstrip("@").lower()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM scraped_posts WHERE LOWER(handle) = ?", (clean_handle,))
        cursor.execute("DELETE FROM scraped_profiles WHERE LOWER(handle) = ?", (clean_handle,))
        conn.commit()
        return cursor.rowcount > 0
