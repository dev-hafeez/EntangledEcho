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
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
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
                posted_at_is_real INTEGER DEFAULT 0,
                perf_score REAL,
                likes INTEGER DEFAULT 0,
                comments INTEGER DEFAULT 0,
                reach INTEGER DEFAULT 0,
                is_real_metrics INTEGER DEFAULT 0,
                sentiment REAL DEFAULT 0.5,
                topics TEXT,
                created_at TEXT,
                FOREIGN KEY (handle) REFERENCES scraped_profiles(handle) ON DELETE CASCADE
            )
        """)

        # Optimization jobs table (SRDS 5.3 & UC06)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS optimization_jobs (
                id TEXT PRIMARY KEY,
                handle TEXT NOT NULL,
                status TEXT DEFAULT 'completed',
                horizon_days INTEGER DEFAULT 7,
                target_posts INTEGER DEFAULT 5,
                min_gap_hours INTEGER DEFAULT 4,
                constraints TEXT,
                primary_schedule TEXT,
                alternatives TEXT,
                schedule_confidence REAL,
                qubo_stats TEXT,
                created_at TEXT
            )
        """)

        # AI Recommendations table (SRDS 5.3, 5.6.2 Algorithm 2)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recommendations (
                id TEXT PRIMARY KEY,
                handle TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                confidence_score REAL,
                accepted INTEGER,
                feedback TEXT,
                created_at TEXT
            )
        """)

        # Content strategies & tasks (FR-22)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS content_strategies (
                id TEXT PRIMARY KEY,
                handle TEXT NOT NULL,
                goal TEXT NOT NULL,
                platform TEXT DEFAULT 'instagram',
                horizon_days INTEGER DEFAULT 14,
                created_at TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                strategy_id TEXT,
                handle TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                media_type TEXT DEFAULT 'REEL',
                due_date TEXT,
                priority TEXT DEFAULT 'HIGH',
                status TEXT DEFAULT 'PENDING',
                created_at TEXT
            )
        """)

        # Scheduled posts table (SRDS 5.3, 5.5 State Machine)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_posts (
                id TEXT PRIMARY KEY,
                handle TEXT NOT NULL,
                title TEXT,
                caption TEXT,
                hashtags TEXT,
                media_type TEXT DEFAULT 'image',
                media_url TEXT,
                day_of_week TEXT,
                time_slot TEXT,
                scheduled_time TEXT,
                status TEXT DEFAULT 'SCHEDULED',
                created_at TEXT
            )
        """)

        # Creator preference weights (FR-24 Feedback Loop)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS creator_preferences (
                handle TEXT PRIMARY KEY,
                preferred_media_types TEXT,
                preferred_hashtag_clusters TEXT,
                preferred_tone TEXT DEFAULT 'ENGAGING',
                updated_at TEXT
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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sched_handle ON scheduled_posts(handle)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_opt_handle ON optimization_jobs(handle)")

        # Migration for is_real_metrics
        try:
            cursor.execute("ALTER TABLE scraped_posts ADD COLUMN is_real_metrics INTEGER DEFAULT 0")
        except Exception:
            pass

        # Migration for posted_at_is_real
        try:
            cursor.execute("ALTER TABLE scraped_posts ADD COLUMN posted_at_is_real INTEGER DEFAULT 0")
        except Exception:
            pass

        conn.commit()
    logger.info(f"Database initialized with all SRDS tables and deduplicated at {DB_PATH}")


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

            raw_cap = (pr["caption"] or "").strip()
            if (
                not raw_cap
                or raw_cap.lower().startswith("may be an image")
                or raw_cap.lower().startswith("may be a graphic")
                or raw_cap.lower().startswith("may be a cartoon")
                or f"@{clean_handle} on instagram" in raw_cap.lower()
                or f"@{clean_handle} post on instagram" in raw_cap.lower()
            ):
                cleaned_cap = "No caption provided."
            else:
                cleaned_cap = raw_cap

            posts.append({
                "id": pr["id"],
                "post_url": pr["post_url"],
                "media_url": pr["media_url"],
                "media_type": pr["media_type"],
                "caption": cleaned_cap,
                "hashtags": hashtags,
                "posted_at": pr["posted_at"],
                "perf_score": pr["perf_score"],
                "likes": pr["likes"],
                "comments": pr["comments"],
                "reach": pr["reach"],
                "is_real_metrics": bool(pr["is_real_metrics"]) if "is_real_metrics" in pr.keys() else False,
                "posted_at_is_real": bool(pr["posted_at_is_real"]) if "posted_at_is_real" in pr.keys() else False,
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
                    hashtags, posted_at, posted_at_is_real, perf_score, likes, comments,
                    reach, is_real_metrics, sentiment, topics, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(handle, post_url) DO UPDATE SET
                    likes = excluded.likes,
                    comments = excluded.comments,
                    reach = excluded.reach,
                    is_real_metrics = excluded.is_real_metrics,
                    posted_at = COALESCE(excluded.posted_at, scraped_posts.posted_at),
                    posted_at_is_real = excluded.posted_at_is_real,
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
                1 if p.get("posted_at_is_real") else 0,
                p.get("perf_score", 0.5),
                p.get("likes", 0),
                p.get("comments", 0),
                p.get("reach", 0),
                1 if p.get("is_real_metrics") else 0,
                p.get("sentiment", 0.5),
                json.dumps(p.get("topics", [])),
                now_iso
            ))

        # Query exact distinct post count after update
        cursor.execute("SELECT COUNT(DISTINCT post_url) FROM scraped_posts WHERE LOWER(handle) = ?", (clean_handle,))
        actual_post_count = cursor.fetchone()[0]

        # Avoid polluting database with empty 0/0 shells
        if actual_post_count == 0 and account_info.get("followers", 0) == 0:
            logger.warning(f"Aborting profile save for @{clean_handle}: 0 followers and 0 posts.")
            return

        # Upsert profile with accurate distinct media count and protect existing metrics
        cursor.execute("""
            INSERT INTO scraped_profiles (
                handle, platform, followers, following, media_count,
                avatar_url, bio, niche, niche_info, created_at, last_scraped_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(handle) DO UPDATE SET
                platform = excluded.platform,
                followers = CASE WHEN excluded.followers > 0 THEN excluded.followers ELSE scraped_profiles.followers END,
                following = CASE WHEN excluded.following > 0 THEN excluded.following ELSE scraped_profiles.following END,
                media_count = CASE WHEN excluded.media_count > 0 THEN excluded.media_count ELSE scraped_profiles.media_count END,
                avatar_url = COALESCE(excluded.avatar_url, scraped_profiles.avatar_url),
                bio = CASE WHEN LENGTH(excluded.bio) > 0 THEN excluded.bio ELSE scraped_profiles.bio END,
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
                COALESCE(cnt.post_count, 0) as post_count
            FROM scraped_profiles p
            LEFT JOIN (
                SELECT LOWER(handle) as l_handle, COUNT(DISTINCT post_url) as post_count
                FROM scraped_posts
                GROUP BY LOWER(handle)
            ) cnt ON LOWER(p.handle) = cnt.l_handle
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
        cursor.execute("DELETE FROM scheduled_posts WHERE LOWER(handle) = ?", (clean_handle,))
        cursor.execute("DELETE FROM optimization_jobs WHERE LOWER(handle) = ?", (clean_handle,))
        conn.commit()
        return cursor.rowcount > 0


def save_optimization_job(
    job_id: str,
    handle: str,
    constraints: Dict[str, Any],
    primary_schedule: Dict[str, Any],
    alternatives: List[Dict[str, Any]],
    schedule_confidence: float,
    qubo_stats: Dict[str, Any]
) -> None:
    """Stores completed quantum-inspired optimization run."""
    clean_handle = handle.strip().lstrip("@").lower()
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO optimization_jobs (
                id, handle, status, horizon_days, target_posts, min_gap_hours,
                constraints, primary_schedule, alternatives, schedule_confidence, qubo_stats, created_at
            ) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            job_id,
            clean_handle,
            constraints.get("horizon_days", 7),
            constraints.get("target_posts_per_week", 5),
            constraints.get("min_gap_hours", 4),
            json.dumps(constraints),
            json.dumps(primary_schedule),
            json.dumps(alternatives),
            schedule_confidence,
            json.dumps(qubo_stats),
            now_iso
        ))
        conn.commit()


def get_latest_optimization_job(handle: str) -> Optional[Dict[str, Any]]:
    """Retrieves most recent optimization job for creator."""
    clean_handle = handle.strip().lstrip("@").lower()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM optimization_jobs
            WHERE LOWER(handle) = ?
            ORDER BY created_at DESC LIMIT 1
        """, (clean_handle,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "handle": row["handle"],
            "status": row["status"],
            "constraints": json.loads(row["constraints"]) if row["constraints"] else {},
            "primary_schedule": json.loads(row["primary_schedule"]) if row["primary_schedule"] else {},
            "alternatives": json.loads(row["alternatives"]) if row["alternatives"] else [],
            "schedule_confidence": row["schedule_confidence"],
            "qubo_stats": json.loads(row["qubo_stats"]) if row["qubo_stats"] else {},
            "created_at": row["created_at"]
        }


def list_scheduled_posts(handle: str) -> List[Dict[str, Any]]:
    """Lists all planned posts from scheduled_posts table."""
    clean_handle = handle.strip().lstrip("@").lower()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM scheduled_posts
            WHERE LOWER(handle) = ?
            ORDER BY scheduled_time ASC, created_at DESC
        """, (clean_handle,))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            hashtags = []
            if r["hashtags"]:
                try:
                    hashtags = json.loads(r["hashtags"])
                except Exception:
                    pass
            result.append({
                "id": r["id"],
                "handle": r["handle"],
                "title": r["title"],
                "caption": r["caption"],
                "hashtags": hashtags,
                "media_type": r["media_type"],
                "media_url": r["media_url"],
                "day_of_week": r["day_of_week"],
                "time_slot": r["time_slot"],
                "scheduled_time": r["scheduled_time"],
                "status": r["status"],
                "created_at": r["created_at"]
            })
        return result


def add_scheduled_post(post_data: Dict[str, Any]) -> Dict[str, Any]:
    """Adds a scheduled post following SRDS 5.5 state machine (default SCHEDULED)."""
    clean_handle = post_data.get("handle", "user").strip().lstrip("@").lower()
    now_iso = datetime.now(timezone.utc).isoformat()
    post_id = post_data.get("id") or f"sched_{clean_handle}_{int(datetime.now().timestamp() * 1000)}"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO scheduled_posts (
                id, handle, title, caption, hashtags, media_type, media_url,
                day_of_week, time_slot, scheduled_time, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            post_id,
            clean_handle,
            post_data.get("title", "Scheduled Post"),
            post_data.get("caption", ""),
            json.dumps(post_data.get("hashtags", [])),
            post_data.get("media_type", "image"),
            post_data.get("media_url"),
            post_data.get("day_of_week"),
            post_data.get("time_slot"),
            post_data.get("scheduled_time"),
            post_data.get("status", "SCHEDULED"),
            now_iso
        ))
        conn.commit()

    return {"status": "success", "id": post_id}


def delete_scheduled_post(post_id: str) -> bool:
    """Deletes a post from scheduled_posts table."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM scheduled_posts WHERE id = ?", (post_id,))
        conn.commit()
        return cursor.rowcount > 0

