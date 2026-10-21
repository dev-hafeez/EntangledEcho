"""
Gemini AI Creator Chatbot Strategist
Powers interactive niche discovery onboarding (for 0-post creators) and ongoing personalized strategy consultation.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-3.8-flash"


def build_system_instruction(account: Dict[str, Any], niche_info: Optional[Dict[str, Any]] = None) -> str:
    handle = account.get("handle", "creator")
    followers = account.get("followers", 0)
    has_posts = account.get("has_posts", True)

    niche = niche_info.get("primary_niche", "Not yet determined") if niche_info else "Unassigned"
    sub_niche = niche_info.get("sub_niche", "") if niche_info else ""
    pillars = ", ".join(niche_info.get("content_pillars", [])) if niche_info else "None"
    audience = niche_info.get("target_audience", "General Instagram users") if niche_info else ""

    if not has_posts:
        return f"""You are Entangled Echo's AI Creator Strategist.
The user is a new creator (@{handle}, {followers} followers) with ZERO POSTS on their account.
Your mission:
1. Warmly welcome them and guide them through an interactive Niche Discovery Interview.
2. Ask 2-3 punchy questions to uncover their core passions, technical skills, or humor style.
3. Suggest 2-3 tailored niches (e.g., Short-form Video Editing, Tech Tips, Fitness, Comedy Skits).
4. Once they agree on a niche, provide a complete 'First 3 Posts Blueprint' (formats, hooks, captions, and hashtag strategy).
Keep answers encouraging, structured, concise, and formatted in clean markdown."""

    return f"""You are Entangled Echo's AI Social Media Strategist, built to maximize organic engagement on Instagram.
Current Creator Context:
- Handle: @{handle}
- Followers: {followers:,}
- Detected Niche: {niche} ({sub_niche})
- Content Pillars: {pillars}
- Target Audience: {audience}

Your mission:
1. Provide actionable, high-engagement content recommendations specifically for this creator's niche.
2. Formulate viral Reel hooks, carousel outlines, and engaging caption drafts matching their authentic voice.
3. If they ask about current trends or what to post, give concrete ideas with specific camera angles, transitions, and audio suggestions.
4. Keep advice sharp, practical, and formatted in clean markdown bullet points."""


async def chat_with_gemini(
    messages: List[Dict[str, str]],
    account: Dict[str, Any],
    niche_info: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Sends conversation history with creator context to Gemini API.
    """
    system_prompt = build_system_instruction(account, niche_info)

    # Format contents for Gemini API:
    # [{"role": "user"|"model", "parts": [{"text": "..."}]}]
    contents = []

    # Inject system instruction as first user/model context exchange
    contents.append({
        "role": "user",
        "parts": [{"text": f"[SYSTEM INSTRUCTION FOR AGENT]:\n{system_prompt}\n\nPlease acknowledge and assist the user."}]
    })
    contents.append({
        "role": "model",
        "parts": [{"text": f"Understood. I am ready to advise @{account.get('handle', 'creator')} with personalized Instagram growth strategy."}]
    })

    for m in messages:
        role = "user" if m.get("role") == "user" else "model"
        text = m.get("text", "")
        if text.strip():
            contents.append({
                "role": role,
                "parts": [{"text": text}]
            })

    api_key = settings.gemini_api_key or settings.llm_api_key
    if not api_key:
        # Graceful fallback response if key is missing
        return {
            "status": "success",
            "reply": f"Hi @{account.get('handle', 'creator')}! I'm your Entangled Echo AI Strategist. For your niche ({niche_info.get('primary_niche', 'Creative Content') if niche_info else 'General'}), focus on posting 5-7 second Reels with strong first-second visual hooks!",
            "engine": "mock_fallback"
        }

    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                gemini_url,
                json={
                    "contents": contents,
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 800
                    }
                }
            )

            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    reply_text = candidates[0]["content"]["parts"][0]["text"].strip()
                    return {
                        "status": "success",
                        "reply": reply_text,
                        "engine": "gemini-3.8-flash"
                    }
            else:
                logger.error(f"Gemini API returned error {resp.status_code}: {resp.text}")
                return {
                    "status": "error",
                    "reply": f"I encountered a temporary connection issue with the Gemini service ({resp.status_code}). Please try again in a moment!",
                    "engine": "error_handler"
                }

    except Exception as e:
        logger.error(f"Chatbot Gemini exception: {e}")
        return {
            "status": "error",
            "reply": f"Sorry, I had trouble reaching the AI service: {str(e)}",
            "engine": "error_handler"
        }
