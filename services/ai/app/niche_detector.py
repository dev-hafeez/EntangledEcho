"""
Creator Niche Detection Engine
Uses Gemini AI and NLP keyword extraction to classify creator niches and audience personas.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-3.8-flash"


async def detect_creator_niche(
    account: Dict[str, Any],
    posts: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Detects creator niche from scraped profile and posts.
    If no posts are available, returns 'needs_onboarding' to route to AI Chatbot.
    """
    handle = account.get("handle", "user")
    bio = account.get("bio", "")

    # Zero-post condition
    if not posts or len(posts) == 0:
        return {
            "status": "needs_onboarding",
            "has_posts": False,
            "handle": handle,
            "primary_niche": "Unassigned",
            "sub_niche": "Needs Discovery",
            "content_pillars": [],
            "target_audience": "Undetermined (No posts found)",
            "tone_voice": "Undetermined",
            "message": f"No posts detected for @{handle}. Let's chat with your AI Strategist to discover your niche and build a custom content plan!",
            "suggested_actions": ["Start Niche Discovery Chat"]
        }

    # Aggregate captions and hashtags
    all_captions = [p.get("caption", "").strip() for p in posts if p.get("caption")]
    sample_text = "\n---\n".join(all_captions[:8])
    all_tags = []
    for p in posts:
        all_tags.extend(p.get("hashtags", []))

    # Try Gemini API if key is available
    api_key = settings.gemini_api_key or settings.llm_api_key
    if api_key:
        try:
            prompt = f"""You are a professional social media branding strategist. Analyze this Instagram creator:
Handle: @{handle}
Bio: "{bio}"
Recent Post Captions:
{sample_text}

Hashtags used: {', '.join(all_tags[:15])}

Analyze their content and determine their creator identity. Return ONLY valid JSON with these keys:
{{
  "primary_niche": "one of: 'Video Editing & Visual Arts', 'Tech & Coding', 'Fitness & Health', 'Comedy & Entertainment', 'Travel & Nature', 'Fashion & Beauty', 'Food & Culinary', 'Business & Growth', 'Personal Lifestyle'",
  "sub_niche": "specific focus in 3-5 words",
  "content_pillars": ["pillar 1", "pillar 2", "pillar 3"],
  "target_audience": "one concise sentence describing their target viewer",
  "tone_voice": "concise description of their tone (e.g. casual, humorous, educational, multilingual/Roman Urdu)",
  "trending_affinity": ["trend theme 1", "trend theme 2", "trend theme 3"],
  "content_ideas": [
    {{"title": "Idea 1", "format": "REEL", "description": "short description"}},
    {{"title": "Idea 2", "format": "CAROUSEL", "description": "short description"}}
  ]
}}
Do not wrap in markdown or backticks, just return raw JSON."""

            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    gemini_url,
                    json={"contents": [{"parts": [{"text": prompt}]}]}
                )

                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        raw_text = candidates[0]["content"]["parts"][0]["text"].strip()
                        # Clean backticks if any
                        if raw_text.startswith("```"):
                            raw_text = raw_text.split("```")[1]
                            if raw_text.startswith("json"):
                                raw_text = raw_text[4:]
                        parsed = json.loads(raw_text.strip())
                        return {
                            "status": "detected",
                            "has_posts": True,
                            "handle": handle,
                            "engine": "gemini-3.8-flash",
                            **parsed
                        }
        except Exception as e:
            logger.warning(f"Gemini niche detection error, using heuristic fallback: {e}")

    # Heuristic Rule-based Fallback
    combined = (bio + " " + " ".join(all_captions) + " " + " ".join(all_tags)).lower()

    if any(k in combined for k in ["edit", "editing", "video", "transition", "camera", "clip", "vfx"]):
        niche = "Video Editing & Visual Arts"
        sub = "Creative Editing & Casual Video Content"
        pillars = ["Behind The Scenes Editing", "Casual Lifestyle & Humor", "Video Transitions"]
        audience = "Young creatives, aspiring video editors, and social media content lovers."
        tone = "Casual, witty, and relatable with multilingual flair."
    elif any(k in combined for k in ["tech", "code", "python", "developer", "software", "ai"]):
        niche = "Tech & Coding"
        sub = "Software Development & Tech Insights"
        pillars = ["Coding Tips", "Tech Reviews", "Developer Lifestyle"]
        audience = "Programmers, students, and technology enthusiasts."
        tone = "Informative, pragmatic, and modern."
    elif any(k in combined for k in ["gym", "workout", "fitness", "bodybuilding", "lifting"]):
        niche = "Fitness & Health"
        sub = "Strength Training & Discipline"
        pillars = ["Workout Routines", "Nutrition Tips", "Motivation"]
        audience = "Gym-goers and fitness beginners looking for inspiration."
        tone = "High energy, disciplined, and motivating."
    else:
        niche = "Personal Lifestyle & Creative"
        sub = "Everyday Moments & Authentic Content"
        pillars = ["Daily Highlights", "Creative Experiments", "Humorous Observations"]
        audience = "Friends, peers, and casual social media browsers."
        tone = "Authentic, relaxed, and conversational."

    return {
        "status": "detected",
        "has_posts": True,
        "handle": handle,
        "engine": "heuristic_nlp",
        "primary_niche": niche,
        "sub_niche": sub,
        "content_pillars": pillars,
        "target_audience": audience,
        "tone_voice": tone,
        "trending_affinity": ["Creative Tools", "Social Media Culture", "Trending Audio"],
        "content_ideas": [
            {
                "title": f"Next Level {sub}",
                "format": "REEL",
                "description": "Show a before-and-after comparison of your creative process."
            },
            {
                "title": "3 Mistakes Beginners Make",
                "format": "CAROUSEL",
                "description": "Educational slide deck highlighting practical lessons from your work."
            }
        ]
    }
