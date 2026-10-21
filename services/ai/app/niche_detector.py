"""
Creator Niche Detection Engine
Combines Gemini AI with an Advanced Semantic Knowledge Graph & Token NLP Classifier.
Accurately identifies creator identity, sports, music, cinema, visual arts, tech, fashion, and lifestyle.
"""

import os
import re
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_MODELS = [
    "gemini-3-flash-preview",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest",
]

# Curated Knowledge Base for Celebrities & Public Figures
PUBLIC_FIGURES: Dict[str, Dict[str, Any]] = {
    "cristiano": {
        "primary_niche": "Sports & Football",
        "sub_niche": "Elite Professional Football & Athletics",
        "content_pillars": ["Matchday Highlights & Wins", "High-Performance Training & Recovery", "Global Brand Partnerships & Lifestyle"],
        "target_audience": "Global football fans, aspiring athletes, and fitness enthusiasts.",
        "tone_voice": "Motivational, competitive, inspiring, and confident.",
        "trending_affinity": ["Champions League & International Football", "Elite Recovery & Training", "Athletic Motivation"],
        "content_ideas": [
            {"title": "Matchday Mindset & Routine", "format": "REEL", "description": "Behind-the-scenes view of focus, preparation, and pitch discipline."},
            {"title": "Training & Recovery Secrets", "format": "CAROUSEL", "description": "Key recovery habits, hydration, and nutrition that keep top athletes at their peak."}
        ]
    },
    "leomessi": {
        "primary_niche": "Sports & Football",
        "sub_niche": "Professional Football & World Champion",
        "content_pillars": ["Inter Miami & Argentina Matches", "Family & Personal Moments", "Athletic Brand Collaborations"],
        "target_audience": "Football fans worldwide and admirers of sporting excellence.",
        "tone_voice": "Humble, focused, family-oriented, and sporting.",
        "trending_affinity": ["World Football Highlights", "Playmaking Mastery", "Sports Milestones"],
        "content_ideas": [
            {"title": "Moments on the Pitch", "format": "REEL", "description": "Highlighting key assists, dribbles, and winning moments."},
            {"title": "Off the Pitch: Family & Team", "format": "CAROUSEL", "description": "Behind the scenes with family and teammates."}
        ]
    },
    "diljitdosanjh": {
        "primary_niche": "Music & Entertainment",
        "sub_niche": "Global Punjabi Music, Concert Tours & Cinema",
        "content_pillars": ["Live Concert Tour & Stage Performances", "Music Releases & Studio Sessions", "Cinema, Fashion & Authentic Relatable Humor"],
        "target_audience": "Global music fans, South Asian diaspora, and admirers of Punjabi pop culture & fashion.",
        "tone_voice": "Vibrant, charismatic, humorous, authentic, and culturally proud with Punjabi flair.",
        "trending_affinity": ["Dil-Luminati Global Tours", "Punjabi Pop Hits & Re-mixes", "High Fashion Streetwear"],
        "content_ideas": [
            {"title": "Live Tour Stage Energy", "format": "REEL", "description": "High-octane stadium entrance, crowd connection, and energetic vocals."},
            {"title": "Vibrant Streetwear & Concert Looks", "format": "CAROUSEL", "description": "Photo slide showing statement turbans, luxury streetwear, and backstage vibes."}
        ]
    },
    "natgeo": {
        "primary_niche": "Travel, Nature & Wildlife",
        "sub_niche": "Global Conservation, Wildlife Photography & Exploration",
        "content_pillars": ["Wildlife Photography & Animal Behavior", "Ocean & Wilderness Conservation", "Cultural Exploration & Earth Science"],
        "target_audience": "Nature lovers, conservationists, photographers, and curious global explorers.",
        "tone_voice": "Awe-inspiring, educational, urgent for conservation, and deeply visual.",
        "trending_affinity": ["Wildlife In Action", "Earth Month & Conservation", "Discovery Expeditions"],
        "content_ideas": [
            {"title": "Rare Predator Encounter", "format": "REEL", "description": "Stunning camera-trap footage of elusive animals in their natural habitats."},
            {"title": "Best of the World Expeditions", "format": "CAROUSEL", "description": "Curated photographic journey through untouched landscapes and ancient cultures."}
        ]
    },
    "tigerjackieshroff": {
        "primary_niche": "Fitness, Martial Arts & Action Cinema",
        "sub_niche": "Acrobatic Flips, Martial Arts & Bollywood Action",
        "content_pillars": ["Calisthenics & High-Flying Flips", "Gym Workouts & Shredded Physique", "Film Stunts & Dance Sequences"],
        "target_audience": "Gym enthusiasts, martial artists, dance fans, and Bollywood action cinema buffs.",
        "tone_voice": "Disciplined, humble, electrifying, and relentless.",
        "trending_affinity": ["Insane Parkour Flips", "Gym PRs & Core Training", "Action Stunt Choreography"],
        "content_ideas": [
            {"title": "Gravity-Defying Kick Combo", "format": "REEL", "description": "Slow-motion acrobatic aerial kick with intense musical drop."},
            {"title": "5 Calisthenics Movements for Core Power", "format": "CAROUSEL", "description": "Breakdown of bodyweight moves to develop explosive agility."}
        ]
    },
    "mrbeast": {
        "primary_niche": "Entertainment & Viral Stunts",
        "sub_niche": "Extreme Challenges & High-Budget Philanthropy",
        "content_pillars": ["Viral Stunts & Massive Giveaways", "Feastables & Creator Business", "High-Concept YouTube Experiments"],
        "target_audience": "Global youth, entertainment lovers, and aspiring digital creators.",
        "tone_voice": "High-energy, direct, enthusiastic, and fast-paced.",
        "trending_affinity": ["Survival Challenges", "Generous Acts & Philanthropy", "Viral Spectacle"],
        "content_ideas": [
            {"title": "I Survived 100 Hours In A Fortress", "format": "REEL", "description": "Fast-cut challenge tease with high stakes."},
            {"title": "Ranking The Craziest Sets We Built", "format": "CAROUSEL", "description": "Behind-the-scenes engineering of massive challenge arenas."}
        ]
    }
}


# Lexicon rules for semantic categorization using exact word boundaries
SEMANTIC_LEXICON = {
    "Sports & Football": [
        r"\bfootball\b", r"\bsoccer\b", r"\bmatch\b", r"\bpoints?\b", r"\bgoals?\b",
        r"\bchampions?\b", r"\btrophy\b", r"\bclub\b", r"\bstadium\b", r"\bpitch\b",
        r"\buefa\b", r"\bfifa\b", r"\bstriker\b", r"\bforward\b", r"\bjersey\b",
        r"\bball\b", r"\bteammate\b", r"\bwin\b", r"\bwon\b", r"\bgame\b"
    ],
    "Music & Performing Arts": [
        r"\bsing(er|ing)?\b", r"\bsongs?\b", r"\balbum\b", r"\btracks?\b", r"\bmusic\b",
        r"\bconcert\b", r"\btour\b", r"\blyrics?\b", r"\baudio\b", r"\bvocals?\b",
        r"\bmelody\b", r"\bband\b", r"\bstage\b", r"\bpunjabi\b", r"\bdiljit\b", r"\bdj\b"
    ],
    "Film & Cinema": [
        r"\bact(or|ress|ing)?\b", r"\bmovies?\b", r"\bcinema\b", r"\bfilms?\b",
        r"\btrailers?\b", r"\bshoot(ing)?\b", r"\bbox office\b", r"\bpremiere\b",
        r"\bbollywood\b", r"\bhollywood\b", r"\bdirector\b"
    ],
    "Video Editing & Visual Arts": [
        r"\bediting\b", r"\beditor\b", r"\bvfx\b", r"\bafter effects\b", r"\bpremiere pro\b",
        r"\bdavinci\b", r"\bcolor grade\b", r"\btransitions?\b", r"\bmotion graphics\b",
        r"\bcut\b", r"\bmontage\b", r"\btimelapse\b", r"\bkeyframes?\b", r"\bvisuals?\b"
    ],
    "Fitness & Athletics": [
        r"\bgym\b", r"\bworkout\b", r"\bfitness\b", r"\bbodybuilding\b", r"\bphysique\b",
        r"\babs\b", r"\bcardio\b", r"\bbiceps\b", r"\bbench press\b", r"\bsquats?\b",
        r"\bdeadlift\b", r"\bdumbbells?\b", r"\bcalisthenics\b", r"\bflips?\b"
    ],
    "Fashion & Beauty": [
        r"\bfashion\b", r"\boutfits?\b", r"\bootd\b", r"\bstyle\b", r"\baesthetic\b",
        r"\bmodels?\b", r"\bmakeup\b", r"\bbeauty\b", r"\bskincare\b", r"\bdress\b",
        r"\brunway\b", r"\bcouture\b"
    ],
    "Food & Culinary": [
        r"\bfood\b", r"\brecipes?\b", r"\bchef\b", r"\bcooking\b", r"\bdelicious\b",
        r"\brestaurants?\b", r"\bdishes?\b", r"\btasty\b", r"\bcuisine\b", r"\bbaking\b"
    ],
    "Travel, Nature & Wildlife": [
        r"\btravel\b", r"\bwanderlust\b", r"\bexplor(e|ing|er)?\b", r"\bdestinations?\b",
        r"\bnature\b", r"\bmountains?\b", r"\boceans?\b", r"\bwildlife\b", r"\badventure\b",
        r"\bsafari\b", r"\blandscape\b", r"\bphotography\b"
    ],
    "Tech & Software Development": [
        r"\bsoftware\b", r"\bcoding\b", r"\bprogrammer\b", r"\bdeveloper\b",
        r"\bpython\b", r"\bjavascript\b", r"\bfullstack\b", r"\bgithub\b",
        r"\bartificial intelligence\b", r"\bmachine learning\b", r"\bdeep learning\b"
    ],
    "Business, Finance & Startups": [
        r"\bbusiness\b", r"\bentrepreneur\b", r"\bstartup\b", r"\binvest(ing|or)?\b",
        r"\bmarketing\b", r"\bcrypto\b", r"\bfinance\b", r"\bwealth\b", r"\becommerce\b"
    ]
}


async def detect_creator_niche(
    account: Dict[str, Any],
    posts: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Detects creator niche with multi-tier intelligence:
    1. Known Public Figures / Celebrities Knowledge Base
    2. Google Gemini AI Models (multi-model cascade)
    3. Robust Semantic Lexicon Classifier (Strict word boundary NLP)
    """
    raw_handle = account.get("handle", "user")
    clean_handle = raw_handle.strip().lstrip("@").lower()
    bio = account.get("bio", "")

    # Zero-post condition
    if not posts or len(posts) == 0:
        # Check if known public figure first
        if clean_handle in PUBLIC_FIGURES:
            pf = PUBLIC_FIGURES[clean_handle]
            return {
                "status": "detected",
                "has_posts": False,
                "handle": clean_handle,
                "engine": "knowledge_graph",
                **pf
            }

        return {
            "status": "needs_onboarding",
            "has_posts": False,
            "handle": clean_handle,
            "primary_niche": "Personal Lifestyle",
            "sub_niche": "Needs Discovery",
            "content_pillars": ["Daily Moments", "Personal Stories", "Creative Explorations"],
            "target_audience": "General social media audience.",
            "tone_voice": "Authentic and conversational.",
            "message": f"Welcome @{clean_handle}! Explore recommendations or chat with your AI Strategist to build your content plan.",
            "suggested_actions": ["Start Niche Discovery Chat"]
        }

    # Tier 1: Check Known Celebrities / Public Figures
    if clean_handle in PUBLIC_FIGURES:
        pf = PUBLIC_FIGURES[clean_handle]
        logger.info(f"Identified known public figure @{clean_handle} -> {pf['primary_niche']}")
        return {
            "status": "detected",
            "has_posts": True,
            "handle": clean_handle,
            "engine": "knowledge_graph",
            **pf
        }

    # Aggregate captions and hashtags
    all_captions = [p.get("caption", "").strip() for p in posts if p.get("caption")]
    sample_text = "\n---\n".join(all_captions[:8])
    all_tags = []
    for p in posts:
        all_tags.extend(p.get("hashtags", []))

    # Tier 2: Try Gemini AI with Multi-Model Cascade
    api_key = settings.gemini_api_key or settings.llm_api_key
    if api_key:
        prompt = f"""You are a world-class creator intelligence and celebrity branding expert.
Analyze this Instagram account and accurately classify their creator niche:
Handle: @{clean_handle}
Bio: "{bio}"
Recent Post Captions:
{sample_text}

Hashtags used: {', '.join(all_tags[:15])}

Instructions:
1. Accurately identify their true real-world field (e.g. Sports & Football, Music & Performing Arts, Film & Cinema, Video Editing & VFX, Fitness & Athletics, Fashion & Beauty, Travel & Nature, Tech & Coding, Food & Culinary, Business & Growth, Comedy & Entertainment, Personal Lifestyle).
2. Return ONLY valid JSON with these keys:
{{
  "primary_niche": "Main creator category (e.g. 'Sports & Football', 'Music & Entertainment', 'Fitness & Athletics', 'Video Editing & Visual Arts', 'Tech & Coding', 'Fashion & Beauty', 'Travel & Nature', 'Food & Culinary', 'Business & Growth')",
  "sub_niche": "specific focus in 3-5 words",
  "content_pillars": ["pillar 1", "pillar 2", "pillar 3"],
  "target_audience": "one concise sentence describing their target viewer",
  "tone_voice": "concise description of their tone",
  "trending_affinity": ["trend theme 1", "trend theme 2", "trend theme 3"],
  "content_ideas": [
    {{"title": "Idea 1", "format": "REEL", "description": "short description"}},
    {{"title": "Idea 2", "format": "CAROUSEL", "description": "short description"}}
  ]
}}
Do not include markdown or backticks, just return raw JSON."""

        async with httpx.AsyncClient(timeout=10.0) as client:
            for model_name in GEMINI_MODELS:
                try:
                    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                    resp = await client.post(
                        gemini_url,
                        json={"contents": [{"parts": [{"text": prompt}]}]}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            raw_text = candidates[0]["content"]["parts"][0]["text"].strip()
                            if raw_text.startswith("```"):
                                raw_text = raw_text.split("```")[1]
                                if raw_text.startswith("json"):
                                    raw_text = raw_text[4:]
                            parsed = json.loads(raw_text.strip())
                            logger.info(f"Gemini AI ({model_name}) detected niche for @{clean_handle}: {parsed.get('primary_niche')}")
                            return {
                                "status": "detected",
                                "has_posts": True,
                                "handle": clean_handle,
                                "engine": f"gemini-ai ({model_name})",
                                **parsed
                            }
                except Exception as model_err:
                    logger.debug(f"Gemini {model_name} failed: {model_err}")

    # Tier 3: Semantic Lexicon & Token NLP Engine (Strict Word Boundaries)
    combined_text = f"{bio} {' '.join(all_captions)} {' '.join(all_tags)}".lower()

    niche_scores: Dict[str, int] = {}
    for niche_name, patterns in SEMANTIC_LEXICON.items():
        score = 0
        for pattern in patterns:
            matches = re.findall(pattern, combined_text, re.IGNORECASE)
            score += len(matches)
        niche_scores[niche_name] = score

    # Find highest scoring niche
    best_niche = max(niche_scores, key=niche_scores.get)
    best_score = niche_scores[best_niche]

    # If no semantic terms matched with confidence, default to Personal Lifestyle
    if best_score == 0:
        best_niche = "Personal Lifestyle"
        sub_niche = "Everyday Highlights & Personal Moments"
        pillars = ["Day In The Life", "Personal Perspectives", "Casual Entertainment"]
        audience = "Peers, casual social media followers, and lifestyle enthusiasts."
        tone = "Authentic, friendly, and relatable."
    else:
        sub_niche = f"Core {best_niche} Content"
        pillars = [f"{best_niche} Highlights", "Behind The Scenes", "Audience Engagement"]
        audience = f"Fans and community members interested in {best_niche}."
        tone = "Passionate, authentic, and engaging."

    logger.info(f"Semantic Lexicon classified @{clean_handle} -> {best_niche} (Score: {best_score})")

    return {
        "status": "detected",
        "has_posts": True,
        "handle": clean_handle,
        "engine": "semantic_nlp",
        "primary_niche": best_niche,
        "sub_niche": sub_niche,
        "content_pillars": pillars,
        "target_audience": audience,
        "tone_voice": tone,
        "trending_affinity": [f"{best_niche} Trends", "Community Highlights", "Trending Audio"],
        "content_ideas": [
            {
                "title": f"Top {best_niche} Moments",
                "format": "REEL",
                "description": f"Exciting fast-paced reel showcasing your best {best_niche.lower()} experiences."
            },
            {
                "title": f"My Guide to {best_niche}",
                "format": "CAROUSEL",
                "description": "Educational slide deck sharing personal insights and tips with your community."
            }
        ]
    }
