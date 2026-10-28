"""
AI Task Decomposer (FR-22, UC07 & SRDS Section 3.1.5)

Decomposes high-level creator campaign goals (e.g., "Grow engagement 20% over 2 weeks with a product launch")
into structured, actionable post tasks with assigned media types, due dates, priorities, and descriptions.
"""

import json
import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

from app.config import settings

logger = logging.getLogger(__name__)


async def decompose_campaign_goal(
    account: Dict[str, Any],
    goal: str,
    platform: str = "instagram",
    horizon_days: int = 14,
    target_posts: int = 4
) -> Dict[str, Any]:
    """
    Decomposes a strategic marketing goal into discrete scheduled post tasks.
    Uses Gemini LLM with structured JSON parsing, falling back to heuristic strategy templates.
    """
    clean_handle = account.get("handle", "user").strip().lstrip("@").lower()
    strategy_id = f"strat_{clean_handle}_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    tasks: List[Dict[str, Any]] = []
    gemini_key = settings.gemini_api_key or settings.llm_api_key

    # Try LLM decomposition
    if gemini_key:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)

            prompt = f"""
You are an expert Social Media Campaign Director for @{clean_handle} on {platform}.
Creator Goal: "{goal}"
Campaign Horizon: {horizon_days} days.
Number of Posts needed: {target_posts}.

Decompose this high-level goal into exactly {target_posts} sequential, actionable post tasks spread across the {horizon_days} days.
Return a valid JSON array of {target_posts} objects with this schema:
[
  {{
    "day_offset": 2,
    "title": "Short punchy task title",
    "description": "Specific creative brief: what to film/design, caption hook angle, and CTA",
    "media_type": "REEL / CAROUSEL / IMAGE",
    "priority": "HIGH / MEDIUM / LOW"
  }}
]
Do not include markdown tags, return pure JSON.
"""
            response = client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=prompt
            )
            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:].strip()
            parsed = json.loads(raw)
            if isinstance(parsed, list) and len(parsed) >= target_posts:
                for idx, item in enumerate(parsed[:target_posts]):
                    day_offset = int(item.get("day_offset", idx * (horizon_days // target_posts) + 1))
                    day_offset = min(day_offset, horizon_days)
                    due_date = (now + timedelta(days=day_offset)).strftime("%Y-%m-%dT18:00:00Z")
                    tasks.append({
                        "id": f"task_{strategy_id}_{idx+1}",
                        "title": item.get("title", f"Post Milestone {idx+1}"),
                        "description": item.get("description", ""),
                        "media_type": item.get("media_type", "REEL").upper(),
                        "due_date": due_date,
                        "priority": item.get("priority", "HIGH").upper(),
                        "status": "PENDING"
                    })
        except Exception as e:
            logger.warning(f"Gemini decomposition failed: {e}. Using deterministic campaign template.")

    # Fallback template decomposition if LLM is unavailable
    if not tasks:
        step_days = max(1, horizon_days // max(target_posts, 1))
        phases = [
            ("Teaser & Hook", "REEL", "HIGH", "Tease the upcoming release with a high-energy short video focusing on problem awareness and curiosity."),
            ("The Reveal & Value Drop", "CAROUSEL", "HIGH", "Full breakdown carousel detailing key benefits, specifications, or core tutorial takeaways."),
            ("Social Proof & Community Q&A", "REEL", "MEDIUM", "Answer top follower questions and showcase early reactions or behind the scenes."),
            ("Final Call-to-Action", "IMAGE", "MEDIUM", "Clean visual graphic driving traffic to bio link or primary conversion action.")
        ]

        for i in range(target_posts):
            phase = phases[i % len(phases)]
            due = (now + timedelta(days=(i + 1) * step_days)).strftime("%Y-%m-%dT18:00:00Z")
            tasks.append({
                "id": f"task_{strategy_id}_{i+1}",
                "title": f"Phase {i+1}: {phase[0]}",
                "description": f"{phase[3]} Context goal: {goal}",
                "media_type": phase[1],
                "due_date": due,
                "priority": phase[2],
                "status": "PENDING"
            })

    # Save to database
    from app.db import get_connection
    with get_connection() as conn:
        cursor = conn.cursor()
        # Content strategies table
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
        # Tasks table
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
                created_at TEXT,
                FOREIGN KEY (strategy_id) REFERENCES content_strategies(id) ON DELETE CASCADE
            )
        """)

        # 1. Save to Supabase
        from app.db import get_supabase
        sp = get_supabase()
        if sp:
            try:
                sp.table("content_strategies").upsert({
                    "id": strategy_id,
                    "handle": clean_handle,
                    "goal": goal,
                    "platform": platform,
                    "horizon_days": horizon_days,
                    "created_at": now_iso
                }, on_conflict="id").execute()

                sp_tasks = []
                for t in tasks:
                    sp_tasks.append({
                        "id": t["id"],
                        "strategy_id": strategy_id,
                        "handle": clean_handle,
                        "title": t["title"],
                        "description": t["description"],
                        "media_type": t["media_type"],
                        "due_date": t["due_date"],
                        "priority": t["priority"],
                        "status": t["status"],
                        "created_at": now_iso
                    })
                if sp_tasks:
                    sp.table("tasks").upsert(sp_tasks, on_conflict="id").execute()
                logger.info(f"Saved strategy {strategy_id} and {len(tasks)} tasks to Supabase")
            except Exception as e:
                logger.error(f"Error saving strategy/tasks to Supabase: {e}")

        # 2. Save to SQLite
        cursor.execute("""
            INSERT INTO content_strategies (id, handle, goal, platform, horizon_days, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (strategy_id, clean_handle, goal, platform, horizon_days, now_iso))

        for t in tasks:
            cursor.execute("""
                INSERT INTO tasks (id, strategy_id, handle, title, description, media_type, due_date, priority, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                t["id"],
                strategy_id,
                clean_handle,
                t["title"],
                t["description"],
                t["media_type"],
                t["due_date"],
                t["priority"],
                t["status"],
                now_iso
            ))
        conn.commit()

    return {
        "status": "success",
        "strategy_id": strategy_id,
        "goal": goal,
        "platform": platform,
        "horizon_days": horizon_days,
        "total_tasks": len(tasks),
        "tasks": tasks
    }
