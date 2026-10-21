"""
Database Layer for Entangled Echo
Provides persistent relational storage and instant caching for all scraped Instagram profiles and posts.
Supports SQLite out of the box (zero-config, high performance, relational).
Guarantees strict deduplication by canonical post URL so re-scraping never doubles posts.
"""

import sqlite3
import json
import logging
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "entangled_echo.db"


def normalize_post_url(url: Optional[str]) -> str:
    """Normalizes Instagram post URL by stripping query parameters and trailing slashes."""
    if not url:
        return ""
    clean = url.split("?")[0].strip().rstrip("/")
    return clean + "/"


def extract_shortcode(post_url: str) -> str:
    """Extracts shortcode from Instagram post/reel URL."""
    match = re.search(r'/(?:p|reel|tv)/([^/]+)', post_url)
    return match.group(1) if match else ""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes tables and unique constraints if they do not exist."""
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
                post_url TEXT NOT NULL,
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

        # Deduplicate any existing duplicate rows before creating unique index
        cursor.execute("""
            DELETE FROM scraped_posts 
            WHERE rowid NOT IN (
                SELECT MAX(rowid) 
                FROM scraped_posts 
                GROUP BY LOWER(handle), post_url
            )
        """)

        # Indexes for high-speed queries and strict deduplication
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_posts_handle ON scraped_posts(handle)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON scraped_posts(posted_at)")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_handle_url ON scraped_posts(handle, post_url)")

        conn.commit()
    logger.info(f"Database initialized and deduplicated at {DB_PATH}")


# Auto-initialize tables on module import
init_db()


def get_cached_profile_and_posts(handle: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves stored profile and posts from database.
    Returns None if profile has never been saved.
    Guarantees no duplicate posts.
    """
    clean_handle = handle.strip().lstrip("@").lower()

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM scraped_profiles WHERE LOWER(handle) = ?", (clean_handle,))
        row = cursor.fetchone()

        if not row:
            return None

        # Fetch distinct posts by post_url
        cursor.execute("""
            SELECT * FROM scraped_posts 
            WHERE LOWER(handle) = ? 
            GROUP BY post_url
            ORDER BY posted_at DESC
        """, (clean_handle,))
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
            "media_count": len(posts),
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
    Strictly prevents duplicates: matches existing posts by canonical post_url
    and updates metrics without increasing post count.
    """
    clean_handle = handle.strip().lstrip("@").lower()
    now_iso = datetime.now(timezone.utc).isoformat()

    niche_str = None
    if niche_info:
        niche_str = json.dumps(niche_info)

    with get_connection() as conn:
        cursor = conn.cursor()

        # Insert or replace posts with strict post_url deduplication
        for idx, p in enumerate(posts, 1):
            raw_url = p.get("post_url", "")
            clean_url = normalize_post_url(raw_url)
            if not clean_url:
                continue

            shortcode = extract_shortcode(clean_url)

            # Check if this post URL already exists in database for this handle
            cursor.execute("""
                SELECT id FROM scraped_posts 
                WHERE LOWER(handle) = ? AND post_url = ?
            """, (clean_handle, clean_url))
            existing_row = cursor.fetchone()

            if existing_row:
                post_id = existing_row["id"]
            else:
                post_id = f"post_{clean_handle}_{shortcode}" if shortcode else f"post_{clean_handle}_{idx}_{int(time.time())}"

            cursor.execute("""
                INSERT INTO scraped_posts (
                    id, handle, post_url, media_url, media_type, caption,
                    hashtags, posted_at, perf_score, likes, comments,
                    reach, sentiment, topics, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(handle, post_url) DO UPDATE SET
                    likes = excluded.likes,
                    comments = excluded.comments,
                    reach = excluded.reach,
                    perf_score = excluded.perf_score,
                    sentiment = excluded.sentiment,
                    media_url = COALESCE(excluded.media_url, scraped_posts.media_url),
                    caption = COALESCE(excluded.caption, scraped_posts.caption)
            """, (
                post_id,
                clean_handle,
                clean_url,
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

        # Query exact distinct post count after update
        cursor.execute("SELECT COUNT(DISTINCT post_url) FROM scraped_posts WHERE LOWER(handle) = ?", (clean_handle,))
        actual_post_count = cursor.fetchone()[0]

        # Upsert profile with accurate distinct media count
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
            actual_post_count,
            account_info.get("avatar_url"),
            account_info.get("bio", ""),
            account_info.get("niche") or (niche_info.get("primary_niche") if niche_info else None),
            niche_str,
            now_iso,
            now_iso
        ))

        conn.commit()
    logger.info(f"Saved @{clean_handle} (Distinct posts in DB: {actual_post_count})")


def list_all_cached_profiles() -> List[Dict[str, Any]]:
    """
    Lists all stored profiles in the database (for Admin management).
    Guarantees post_count is the true distinct count of posts.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                p.*,
                (SELECT COUNT(DISTINCT post_url) FROM scraped_posts WHERE LOWER(handle) = LOWER(p.handle)) as post_count
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
                "media_count": r["post_count"],
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
