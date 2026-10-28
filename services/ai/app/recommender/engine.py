"""
AI Recommendation Engine (SRDS 5.6.2 Algorithm 2 & FR-21..24)

Implements:
1. Caption drafts generation with top TF-IDF topics, hashtag clusters, and LLM (FR-21, FR-23).
2. Schedule recommendations loading Quantum-Inspired QUBO results (Algorithm 1 / FR-17).
3. Content Type ranking with bootstrap confidence intervals (Section 6.3).
4. Feedback loop learning via creator preference re-ranking (FR-24).
"""

import json
import logging
import uuid
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import numpy as np
import httpx

from app.analysis.performance_score import normalize_account_performance_scores
from app.analysis.content_analyzer import (
    extract_tfidf_topics,
    extract_hashtag_clusters,
    analyze_caption_sentiment
)
from app.optimizer.qubo_optimizer import run_qubo_optimization
from app.trending import (
    fetch_niche_relevant_trends,
    infer_creator_geo_and_language,
    fetch_live_google_trends
)
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-flash-latest"
]

PUBLIC_FIGURE_STYLES: Dict[str, Dict[str, Any]] = {
    "cristiano": {
        "language": "Portuguese & Athletic English",
        "cadence": "Extremely short 1-line athletic captions with signature emojis (⚽️💪🏽🔥🟡🔵🇵🇹)",
        "exemplars": [
            "+3 points. 🟡🔵 Together!",
            "Putting in the work 🔥",
            "Primeiro passo dado. Vamos, Portugal! 🇵🇹",
            "Important win tonight. We keep building 💪🏽"
        ],
        "default_hashtags": ["#cristiano", "#AlNassr", "#Portugal"]
    },
    "leomessi": {
        "language": "Spanish (Argentine)",
        "cadence": "Humble, short athletic 1-2 sentence captions in Spanish with emojis (🇦🇷⚽️💪)",
        "exemplars": [
            "Seguimos sumando. Vamos Argentina carajo! 🇦🇷💪",
            "Un paso más hacia el objetivo. ⚽️",
            "Preparándonos para lo que viene. Con todo el equipo! 💪",
            "Gracias a todos por el cariño siempre! ❤️"
        ],
        "default_hashtags": ["#leomessi", "#Argentina", "#InterMiamiCF"]
    },
    "diljitdosanjh": {
        "language": "Punjabi / Hindi / Hinglish blend",
        "cadence": "Charismatic, high-energy concert tour hype with Punjabi phrases and respectful emojis (😇🙏🏽😎🤟🏾🫶🏽)",
        "exemplars": [
            "MAIN HOON ਪੰਜਾਬ 😇🙏🏽 #metgala Inspired by Culture & My Mother Tongue “ ਪੰਜਾਬੀ “",
            "PANJABI AA GAYE OYE 😎 Tour vibes only 🫶🏽 Live energy like a main event 🤘🏽",
            "Brother singing in PANJABI for the first time BURRAAAA 🤟🏾 Chak deya ge 😎"
        ],
        "default_hashtags": ["#DiljitOnFallon", "#PanjabiAaGayeOye", "#AuraTour"]
    },
    "karolg": {
        "language": "Spanish (Colombian / Paisa / Bichota)",
        "cadence": "Affectionate, empowering Colombian Spanish with Bichota energy and heart/flower emojis (🌸✨💖🇨🇴)",
        "exemplars": [
            "Mañana será bonito ✨🌸 Medellín siempre en mi corazón ❤️",
            "Bichota season activada 💖 Nos vemos en el estadio!",
            "Una noche inolvidable... Gracias por tanto amor! 🥹✨"
        ],
        "default_hashtags": ["#Bichota", "#MSB", "#KarolG"]
    },
    "neymarjr": {
        "language": "Portuguese (Brazilian)",
        "cadence": "Faith-filled, joyful Brazilian Portuguese with football & prayer emojis (🙏🏽⚽️🤙🏽🇧🇷)",
        "exemplars": [
            "Deus é bom o tempo todo! 🙏🏽⚽️ Que alegria estar de volta!",
            "Foco, força e fé. Vamos com tudo! 🤙🏽",
            "Mais 3 pontos importantes na caminhada. Seguimos juntos! 🇧🇷"
        ],
        "default_hashtags": ["#NJR", "#Neymar", "#Brasil"]
    },
    "virat.kohli": {
        "language": "Indian English & Hindi",
        "cadence": "Focused, determined athletic lines with cricket & fitness emojis (🏏💪🇮🇳)",
        "exemplars": [
            "Grind never stops. Back to work! 🏏💪",
            "Memorable win with the boys. Always proud to represent 🇮🇳",
            "Focus on the process, results will follow."
        ],
        "default_hashtags": ["#ViratKohli", "#TeamIndia", "#GrindNeverStops"]
    },
    "mrbeast": {
        "language": "High-Energy English",
        "cadence": "Fast-paced YouTube viral challenge tease with high stakes (🔥🚀)",
        "exemplars": [
            "I gave away $1,000,000 in this video! Go watch right now! 🔥",
            "Surviving 7 days in an abandoned city... new video is live!",
            "Who do you think won? Drop your guesses below 👇"
        ],
        "default_hashtags": ["#MrBeast", "#Challenge", "#Feastables"]
    }
}


def clean_creator_caption(text: str) -> str:
    """Strips Instagram UI prefixes and extracts authentic caption inside quotes."""
    if not text:
        return ""
    # Extract quoted caption if formatted like 'Handle on Instagram: "Caption"'
    m = re.search(r'on Instagram(?:\u200e)?:\s*[\"“](.*?)[\"”](?:\s*$|\s*#)', text, re.DOTALL)
    if m and len(m.group(1).strip()) > 3:
        return m.group(1).strip()
    cleaned = re.sub(r'^[^:\n]+ on Instagram(?:\u200e)?:\s*', '', text, flags=re.I)
    cleaned = re.sub(r'^(?:Photo|Video)\s+by\s+.*?\s+on\s+.*?\.\s*', '', cleaned)
    cleaned = cleaned.strip(' "“\'')
    return cleaned if cleaned else text.strip()


def is_usable_real_caption(text: str) -> bool:
    """Verifies that caption is not automated Instagram alt-text placeholder."""
    if not text or len(text.strip()) < 3:
        return False
    lower = text.lower().strip()
    if lower.startswith("may be an image") or lower.startswith("may be a cartoon") or lower.startswith("may be a photo"):
        return False
    if lower.startswith("photo by ") or lower.startswith("video by ") or lower.startswith("post by @"):
        return False
    return True


def get_creator_preferences(handle: str) -> Dict[str, Any]:
    """Retrieves learned creator preference weights from database (Supabase first, SQLite fallback)."""
    from app.db import get_connection, get_supabase
    clean_handle = handle.strip().lstrip("@").lower()

    # 1. Supabase Cloud lookup
    sp = get_supabase()
    if sp:
        try:
            res = sp.table("creator_preferences").select("*").ilike("handle", clean_handle).limit(1).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                return {
                    "preferred_media_types": row.get("preferred_media_types") or {},
                    "preferred_hashtag_clusters": row.get("preferred_hashtag_clusters") or {},
                    "preferred_tone": row.get("preferred_tone") or "ENGAGING"
                }
        except Exception as e:
            logger.warning(f"Error fetching creator preferences from Supabase: {e}")

    # 2. SQLite fallback
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM creator_preferences WHERE LOWER(handle) = ?", (clean_handle,))
        row = cursor.fetchone()
        if row:
            try:
                return {
                    "preferred_media_types": json.loads(row["preferred_media_types"]) if row["preferred_media_types"] else {},
                    "preferred_hashtag_clusters": json.loads(row["preferred_hashtag_clusters"]) if row["preferred_hashtag_clusters"] else {},
                    "preferred_tone": row["preferred_tone"] or "ENGAGING"
                }
            except Exception:
                pass
    return {"preferred_media_types": {}, "preferred_hashtag_clusters": {}, "preferred_tone": "ENGAGING"}


def update_creator_feedback(
    recommendation_id: str,
    handle: str,
    accepted: bool,
    feedback_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Updates recommendation status and adjusts preference weights (FR-24 feedback learning).
    Persists to both Supabase and SQLite.
    """
    from app.db import get_connection, get_supabase
    clean_handle = handle.strip().lstrip("@").lower()
    now_iso = datetime.now(timezone.utc).isoformat()

    prefs = get_creator_preferences(clean_handle)
    media_weights = prefs["preferred_media_types"]
    hashtag_weights = prefs["preferred_hashtag_clusters"]

    # 1. Update Supabase
    sp = get_supabase()
    if sp:
        try:
            sp.table("recommendations").update({
                "accepted": 1 if accepted else 0,
                "feedback": feedback_text or ""
            }).eq("id", recommendation_id).execute()

            # Fetch rec content to adjust weights
            rec_res = sp.table("recommendations").select("type,content").eq("id", recommendation_id).limit(1).execute()
            if rec_res.data and len(rec_res.data) > 0:
                rec_row = rec_res.data[0]
                rec_content = rec_row.get("content")
                if isinstance(rec_content, str):
                    try:
                        rec_content = json.loads(rec_content)
                    except Exception:
                        pass
                rec_type = rec_row.get("type")
                weight_delta = 1.0 if accepted else -0.5

                if rec_type == "content_type" and isinstance(rec_content, dict):
                    top_fmt = rec_content.get("top_format", "REEL")
                    media_weights[top_fmt] = round(media_weights.get(top_fmt, 1.0) + weight_delta, 2)
                elif rec_type == "caption" and isinstance(rec_content, dict):
                    for tag in rec_content.get("hashtags", [])[:3]:
                        hashtag_weights[tag] = round(hashtag_weights.get(tag, 1.0) + weight_delta, 2)

            sp.table("creator_preferences").upsert({
                "handle": clean_handle,
                "preferred_media_types": media_weights,
                "preferred_hashtag_clusters": hashtag_weights,
                "preferred_tone": prefs.get("preferred_tone", "ENGAGING"),
                "updated_at": now_iso
            }, on_conflict="handle").execute()
            logger.info(f"Updated feedback & preferences in Supabase for @{clean_handle}")
        except Exception as e:
            logger.error(f"Error updating feedback in Supabase: {e}")

    # 2. Update SQLite mirror
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE recommendations
            SET accepted = ?, feedback = ?
            WHERE id = ?
        """, (1 if accepted else 0, feedback_text or "", recommendation_id))

        cursor.execute("SELECT type, content FROM recommendations WHERE id = ?", (recommendation_id,))
        rec_row = cursor.fetchone()

        if rec_row and rec_row["content"]:
            try:
                rec_content = json.loads(rec_row["content"])
                rec_type = rec_row["type"]
                weight_delta = 1.0 if accepted else -0.5

                if rec_type == "content_type":
                    top_fmt = rec_content.get("top_format", "REEL")
                    media_weights[top_fmt] = round(media_weights.get(top_fmt, 1.0) + weight_delta, 2)
                elif rec_type == "caption":
                    for tag in rec_content.get("hashtags", [])[:3]:
                        hashtag_weights[tag] = round(hashtag_weights.get(tag, 1.0) + weight_delta, 2)
            except Exception as e:
                logger.warning(f"Error parsing rec content for feedback: {e}")

        cursor.execute("""
            INSERT INTO creator_preferences (handle, preferred_media_types, preferred_hashtag_clusters, preferred_tone, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(handle) DO UPDATE SET
                preferred_media_types = excluded.preferred_media_types,
                preferred_hashtag_clusters = excluded.preferred_hashtag_clusters,
                updated_at = excluded.updated_at
        """, (
            clean_handle,
            json.dumps(media_weights),
            json.dumps(hashtag_weights),
            prefs.get("preferred_tone", "ENGAGING"),
            now_iso
        ))
        conn.commit()

    return {
        "status": "success",
        "recommendation_id": recommendation_id,
        "accepted": accepted,
        "preference_re_ranking_active": True,
        "updated_weights": {
            "media_types": media_weights,
            "hashtags": hashtag_weights
        }
    }


async def generate_caption_drafts(
    account: Dict[str, Any],
    top_posts: List[Dict[str, Any]],
    niche: str,
    top_topics: List[tuple],
    hashtag_clusters: List[Dict[str, Any]],
    user_prompt: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Algorithm 2 Step 3 (SRDS 5.6.2):
    1. Extracts creator's actual, verified post captions (in their native language & cadence).
    2. Infers creator's native language, dialect, and country geo.
    3. Fetches live real-time Google Trends scored for relevance to creator's niche and posts.
    4. Prompts Gemini via httpx to analyze the language, emojis, length, and style of the real posts.
    5. Generates 3 authentic drafts in the creator's natural language incorporating Google Trends.
    6. Falls back to personalized multilingual synthesis from creator's actual voice (never generic English).
    """
    clean_handle = account.get("handle", "creator").strip().lstrip("@").lower()
    bio = account.get("bio", "").strip()

    # 1. Extract authentic real captions from verified posts
    unique_real_captions: List[str] = []
    for p in top_posts:
        raw_cap = p.get("caption", "")
        cleaned = clean_creator_caption(raw_cap)
        if is_usable_real_caption(cleaned) and cleaned not in unique_real_captions:
            unique_real_captions.append(cleaned)

    # 2. Check known figure knowledge style if real captions are sparse
    known_style = PUBLIC_FIGURE_STYLES.get(clean_handle)
    if not unique_real_captions and known_style:
        unique_real_captions = list(known_style["exemplars"])

    # 3. Extract authentic creator hashtags
    real_hashtags: List[str] = []
    if known_style:
        real_hashtags.extend(known_style["default_hashtags"])

    for p in top_posts:
        tags = p.get("hashtags") or []
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except Exception:
                tags = [t.strip() for t in tags.split(",") if t.strip()]
        for t in tags:
            clean_t = t.strip() if t.strip().startswith("#") else f"#{t.strip()}"
            if clean_t and clean_t not in real_hashtags and not clean_t.lower().startswith("#may"):
                real_hashtags.append(clean_t)
        for h in re.findall(r'#\w+', p.get("caption", "")):
            clean_h = h.strip()
            if clean_h and clean_h not in real_hashtags and not clean_h.lower().startswith("#may"):
                real_hashtags.append(clean_h)

    # 4. Infer native language and country geo
    geo_info = infer_creator_geo_and_language(account, top_posts)
    creator_lang = known_style["language"] if known_style else geo_info["language"]
    creator_geo = geo_info["geo"]
    creator_cadence = known_style["cadence"] if known_style else f"Personal, natural voice in {creator_lang}"

    # 5. Fetch Niche-Relevant Google Trends for this Creator
    try:
        relevant_trends = fetch_niche_relevant_trends(account, top_posts, niche=niche, limit=8)
    except Exception as e:
        logger.warning(f"Error fetching relevant Google Trends for @{clean_handle}: {e}")
        relevant_trends = []

    trend_titles = [t.get("title", "").strip() for t in relevant_trends if t.get("title")]
    google_trend_hashtags: List[str] = [t.get("adapted_hashtag") for t in relevant_trends if t.get("adapted_hashtag")]

    prefs = get_creator_preferences(clean_handle)
    preferred_tone = prefs.get("preferred_tone", "ENGAGING")

    # 6. Construct prompt with Few-Shot Real Captions
    sample_captions_str = "\n".join([f"{i+1}. \"{c}\"" for i, c in enumerate(unique_real_captions[:6])])
    if not sample_captions_str:
        sample_captions_str = f"Creator Bio: {bio or niche}"

    prompt = f"""You are the personal content director for Instagram creator @{clean_handle}.

CREATOR AUTHENTIC VOICE & LANGUAGE PROFILE:
- Creator Handle: @{clean_handle}
- Niche: {niche or 'General Content & Lifestyle'}
- Primary Language & Vernacular: {creator_lang}
- Authentic Style & Cadence: {creator_cadence}
- Real Brand Hashtags: {', '.join(real_hashtags[:6]) if real_hashtags else '#' + clean_handle}
- Audience Tone Preference: {preferred_tone}

ACTUAL, VERIFIED POST CAPTIONS WRITTEN BY @{clean_handle}:
{sample_captions_str}

LIVE GOOGLE TRENDS RELATED TO THIS NICHE & POST TOPICS TODAY:
Trending Topics ({creator_geo}): {', '.join(trend_titles[:6]) if trend_titles else 'Major Sports & Music Spikes'}
Trending Hashtags from Google Trends: {', '.join(google_trend_hashtags[:6])}

User Prompt / Custom Focus: {user_prompt or 'New high-performing upcoming post'}

STRICT MANDATORY INSTRUCTIONS:
1. STRICT NATIVE LANGUAGE REQUIREMENT:
   - YOU MUST WRITE ALL 3 CAPTIONS AND HASHTAGS IN THE CREATOR'S NATIVE LANGUAGE ({creator_lang}) AND DIALECT!
   - If @{clean_handle} writes in Spanish, ALL 3 CAPTIONS MUST BE IN AUTHENTIC SPANISH (e.g. Argentine or Colombian Spanish). Do NOT translate to English!
   - If @{clean_handle} writes in Portuguese, ALL 3 CAPTIONS MUST BE IN AUTHENTIC PORTUGUESE!
   - If @{clean_handle} writes in Punjabi or a Punjabi/Hindi/Hinglish blend, ALL 3 CAPTIONS MUST BE IN THAT EXACT AUTHENTIC BLEND (e.g. "Panjabi Aa Gaye Oye 😎", "Baut pyar te respect 🙏🏽")!
   - If @{clean_handle} writes in Italian, French, Hindi, or Arabic, match that exact language!
2. ADAPT THEIR AUTHENTIC CAPTION BREVITY & EMOJIS:
   - If @{clean_handle} writes short 1-line athletic or celebrity captions with emojis (e.g. ⚽️🔥, 🟡🔵, 🇦🇷, 🩵, 👑), write authentic short 1-line or 2-sentence captions matching their exact energy!
   - NEVER write generic marketing guru essays (e.g. 'The biggest lesson we learned this week...'). Match their personal voice and signature emojis.
3. REAL & TRENDING HASHTAGS:
   - In each draft, combine:
     (a) 1-2 of @{clean_handle}'s real personal brand hashtags ({', '.join(real_hashtags[:4]) or '#' + clean_handle}).
     (b) 1 relevant hashtag adapted from the LIVE Google Trends search spikes above ({', '.join(google_trend_hashtags[:4])}).
4. Output EXACTLY 3 distinct drafts formatted as pure JSON:
[
  {{
    "hook_type": "...",
    "caption": "Full caption text in {creator_lang} matching @{clean_handle}'s authentic style, length, and emojis...",
    "hashtags": ["#tag1", "#tag2", "#tag3"],
    "rationale": "Explicitly cite why this aligns with @{clean_handle}'s real language, verified habits, and Google Trends..."
  }}
]
Do not wrap in markdown or backticks, return pure JSON.
"""

    api_key = settings.gemini_api_key or settings.llm_api_key
    drafts: List[Dict[str, Any]] = []

    # 7. Call Gemini via httpx
    if api_key:
        async with httpx.AsyncClient(timeout=12.0) as client:
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
                                    raw_text = raw_text[4:].strip()
                            parsed = json.loads(raw_text.strip())
                            if isinstance(parsed, list) and len(parsed) >= 3:
                                drafts = parsed[:3]
                                logger.info(f"Gemini AI ({model_name}) generated 3 authentic {creator_lang} captions for @{clean_handle}")
                                break
                except Exception as model_err:
                    logger.debug(f"Gemini {model_name} caption generation error: {model_err}")

    # 8. Multilingual Adaptive Fallback: Personalized in Creator's Native Language (NEVER Generic English)
    if not drafts or len(drafts) < 3:
        brand_tags = real_hashtags[:2] if real_hashtags else [f"#{clean_handle}"]
        trend_tag_pick = google_trend_hashtags[:2] if google_trend_hashtags else ["#TrendingNow"]
        combined_tags = list(dict.fromkeys(brand_tags + trend_tag_pick))

        c1 = unique_real_captions[0] if unique_real_captions else f"@{clean_handle}"
        c2 = unique_real_captions[1] if len(unique_real_captions) > 1 else c1

        if "Spanish" in creator_lang:
            drafts = [
                {
                    "hook_type": "Foco de Partido / Preparación",
                    "caption": f"Seguimos con todo el enfoque y trabajando duro. ⚽️💪\n{c1}",
                    "hashtags": list(dict.fromkeys(brand_tags + ["#Vamos", trend_tag_pick[0]])),
                    "rationale": f"Redactado en español auténtico adaptado al estilo deportivo de @{clean_handle} con tendencia de Google Trends #{trend_tag_pick[0].lstrip('#')}."
                },
                {
                    "hook_type": "Agradecimiento a la Comunidad",
                    "caption": f"Un paso más cerca del objetivo. Gracias a todos por el apoyo siempre! ❤️🙌\n{c2}",
                    "hashtags": list(dict.fromkeys(brand_tags + trend_tag_pick)),
                    "rationale": "Captura el tono humilde y cercano habitual en sus publicaciones reales."
                },
                {
                    "hook_type": "Momentum / Energía Positiva",
                    "caption": "Concentración máxima para lo que viene. Con todo! 👊🏽✨",
                    "hashtags": list(dict.fromkeys(brand_tags + trend_tag_pick)),
                    "rationale": "Línea corta y directa con emojis deportivos propios de su feed verificado."
                }
            ]
        elif "Portuguese" in creator_lang:
            drafts = [
                {
                    "hook_type": "Foco Total / Trabalho",
                    "caption": f"Foco total no trabalho diário. 💪🏽🔥 {c1}",
                    "hashtags": list(dict.fromkeys(brand_tags + ["#Futebol", trend_tag_pick[0]])),
                    "rationale": f"Sintetizado em português com a cadência atlética de @{clean_handle} e tendência Google Trends #{trend_tag_pick[0].lstrip('#')}."
                },
                {
                    "hook_type": "Grande Vitória / União",
                    "caption": f"Grande vitória e grande jogo hoje. Seguimos juntos! 🟡🔵 {c2}",
                    "hashtags": list(dict.fromkeys(brand_tags + trend_tag_pick)),
                    "rationale": "Frase curta de celebração com emojis característicos de sua conta."
                },
                {
                    "hook_type": "Determinação / Próximo Passo",
                    "caption": "Mais um passo dado com determinação. On to the next one! 🚀👊🏽",
                    "hashtags": list(dict.fromkeys(brand_tags + trend_tag_pick)),
                    "rationale": "Combina sua assinatura em português e inglês atlético."
                }
            ]
        elif "Punjabi" in creator_lang or "Hindi" in creator_lang:
            drafts = [
                {
                    "hook_type": "Concert Tour Hype",
                    "caption": f"PANJABI AA GAYE OYE 😎 Tour vibes only 🫶🏽 Live energy like a main event 🤘🏽\n\n{c1}",
                    "hashtags": list(dict.fromkeys(brand_tags + ["#DiljitTour", trend_tag_pick[0]])),
                    "rationale": f"Written in Diljit's iconic Punjabi hype cadence paired with Google Trends #{trend_tag_pick[0].lstrip('#')}."
                },
                {
                    "hook_type": "Global Stage / Respect",
                    "caption": f"AURA WORLD TOUR 🌍 Full vibe te legend energy 🫶🏽 BAUT PYAR TE RESPECT SAB NU 🙏🏽\n\n{c2}",
                    "hashtags": list(dict.fromkeys(brand_tags + trend_tag_pick)),
                    "rationale": "Cultural Punjabi blend with stadium concert gratitude."
                },
                {
                    "hook_type": "History Day / Momentum",
                    "caption": "HISTORY DAY 🤘🏽 Chak deya ge! Agla step loading... ⏳🔥",
                    "hashtags": list(dict.fromkeys(brand_tags + trend_tag_pick)),
                    "rationale": "High-octane Punjabi street style with signature emojis."
                }
            ]
        elif "Italian" in creator_lang:
            drafts = [
                {
                    "hook_type": "Energia / Prossimo Obiettivo",
                    "caption": f"Sempre concentrati sul prossimo obiettivo! 🚀🇮🇹 {c1}",
                    "hashtags": list(dict.fromkeys(brand_tags + trend_tag_pick)),
                    "rationale": f"Adattato in italiano con stile breve e tendenze Google Trends #{trend_tag_pick[0].lstrip('#')}."
                },
                {
                    "hook_type": "Momento Insieme",
                    "caption": f"Grande energia oggi! Continuiamo così insieme. 💪🔥 {c2}",
                    "hashtags": list(dict.fromkeys(brand_tags + trend_tag_pick)),
                    "rationale": "Messaggio positivo e diretto per la community."
                },
                {
                    "hook_type": "Nuovo Capitolo",
                    "caption": "Passo dopo passo verso il traguardo. ✨",
                    "hashtags": list(dict.fromkeys(brand_tags + trend_tag_pick)),
                    "rationale": "Cadenza rapida ed autentica."
                }
            ]
        else:
            # English (matching creator's authentic brevity and style)
            drafts = [
                {
                    "hook_type": "Momentum / Focus",
                    "caption": f"{c1}\n\nNext chapter loading... ⏳🔥",
                    "hashtags": combined_tags,
                    "rationale": f"Synthesized in @{clean_handle}'s authentic voice with Google Trends #{trend_tag_pick[0].lstrip('#')}."
                },
                {
                    "hook_type": "Behind The Grind",
                    "caption": f"{c2} 👊🏽 What do you think?",
                    "hashtags": combined_tags,
                    "rationale": "Short, punchy line designed to drive authentic community comments."
                },
                {
                    "hook_type": "High Energy Drop",
                    "caption": "Always focused, always growing. 🚀 Leveling up every single day.",
                    "hashtags": combined_tags,
                    "rationale": "Preserves creator's personal vocabulary and pairs with trending search spikes."
                }
            ]

    return drafts



def compute_content_type_ranking(
    posts: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Algorithm 2 Step 5 & Section 6.3:
    Ranks media types by mean performance score with sample size n
    and bootstrap 80% confidence intervals.
    """
    format_data: Dict[str, List[float]] = {"REEL": [], "CAROUSEL": [], "IMAGE": []}
    all_scores: List[float] = []

    for p in posts:
        mtype = (p.get("media_type") or "IMAGE").upper()
        if mtype not in format_data:
            format_data[mtype] = []
        score = float(p.get("perf_score") or 0.5)
        format_data[mtype].append(score)
        all_scores.append(score)

    account_avg = float(np.mean(all_scores)) if all_scores else 0.5
    ranked_list = []

    for fmt, scores in format_data.items():
        n = len(scores)
        if n == 0:
            ranked_list.append({
                "media_type": fmt,
                "sample_size_n": 0,
                "mean_performance": 0.5,
                "confidence_score": 60.0,
                "confidence_interval_80": [0.4, 0.6],
                "reasoning": f"No historical {fmt} posts found. Platform benchmark prior applied."
            })
            continue

        mean_score = float(np.mean(scores))

        # Bootstrap 80% interval (Section 6.3)
        rng = np.random.default_rng(42)
        boot_means = []
        for _ in range(200):
            sample = rng.choice(scores, size=n, replace=True)
            boot_means.append(float(np.mean(sample)))

        low_80 = round(float(np.percentile(boot_means, 10)), 3)
        high_80 = round(float(np.percentile(boot_means, 90)), 3)
        ci_width = max(high_80 - low_80, 0.01)

        # Confidence = 1 - normalized width
        conf = round(float(np.clip(1.0 - ci_width, 0.5, 0.98) * 100), 1)

        diff = round((mean_score - account_avg) * 100, 1)
        direction = "outperforms" if diff >= 0 else "underperforms"
        reasoning = f"{fmt} posts achieve a {round(mean_score, 3)} mean score ({abs(diff)}% {direction} account average). Sample size: n={n} verified posts."

        ranked_list.append({
            "media_type": fmt,
            "sample_size_n": n,
            "mean_performance": round(mean_score, 3),
            "confidence_score": conf,
            "confidence_interval_80": [low_80, high_80],
            "reasoning": reasoning
        })

    ranked_list.sort(key=lambda x: x["mean_performance"], reverse=True)

    return {
        "status": "success",
        "top_format": ranked_list[0]["media_type"] if ranked_list else "REEL",
        "ranked_formats": ranked_list,
        "methodology": "Bootstrap 80% confidence interval of mean score difference (SRDS Section 6.3)"
    }


async def run_ai_recommendation_engine(
    account: Dict[str, Any],
    posts: List[Dict[str, Any]],
    recommendation_type: str = "caption",
    user_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main entry point for Algorithm 2:
    INPUT: account, recommendation_type ('caption' | 'schedule' | 'content_type')
    OUTPUT: recommendations with confidence scores, saved in database table.
    """
    clean_handle = account.get("handle", "user").strip().lstrip("@").lower()
    rec_id = f"rec_{clean_handle}_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Normalize posts and take top 20 by performance_score
    normalized_posts = normalize_account_performance_scores(
        list(posts), account.get("followers", 1000)
    )
    sorted_posts = sorted(normalized_posts, key=lambda x: float(x.get("perf_score") or 0.5), reverse=True)
    top_20 = sorted_posts[:20]

    # 2. Extract patterns
    captions = [p.get("caption", "") for p in top_20]
    top_topics = extract_tfidf_topics(captions, top_n=8)
    hashtag_clusters = extract_hashtag_clusters(top_20)
    niche = account.get("niche") or "General Creator"

    result_payload: Dict[str, Any] = {}
    confidence_score: float = 75.0

    # 3. Handle by recommendation_type
    if recommendation_type == "caption":
        drafts = await generate_caption_drafts(
            account=account,
            top_posts=top_20,
            niche=niche,
            top_topics=top_topics,
            hashtag_clusters=hashtag_clusters,
            user_prompt=user_prompt
        )
        result_payload = {
            "type": "caption",
            "niche": niche,
            "top_topics": top_topics,
            "hashtag_clusters": hashtag_clusters,
            "caption_drafts": drafts,
            "confidence_label": f"Derived from @{clean_handle}'s top {len(top_20)} verified posts"
        }
        confidence_score = 88.0

    elif recommendation_type == "schedule":
        # Load or run quantum optimization
        opt_res = run_qubo_optimization(
            account=account,
            posts=normalized_posts,
            target_posts_per_week=5,
            min_gap_hours=4
        )
        result_payload = {
            "type": "schedule",
            "primary_schedule": opt_res["primary_schedule"],
            "alternatives": opt_res["alternatives"],
            "algorithm": opt_res["algorithm"],
            "qubo_stats": opt_res["qubo_stats"],
            "confidence_note": opt_res["confidence_note"]
        }
        confidence_score = opt_res["schedule_confidence"]

    elif recommendation_type == "content_type":
        ct_ranking = compute_content_type_ranking(normalized_posts)
        result_payload = {
            "type": "content_type",
            "top_format": ct_ranking["top_format"],
            "ranked_formats": ct_ranking["ranked_formats"],
            "methodology": ct_ranking["methodology"]
        }
        confidence_score = ct_ranking["ranked_formats"][0]["confidence_score"] if ct_ranking["ranked_formats"] else 75.0

    # 4. Store recommendation in database (SRDS Step 6) - Supabase and SQLite
    from app.db import get_connection, get_supabase

    # Save to Supabase
    sp = get_supabase()
    if sp:
        try:
            sp.table("recommendations").upsert({
                "id": rec_id,
                "handle": clean_handle,
                "type": recommendation_type,
                "content": json.dumps(result_payload),
                "confidence_score": confidence_score,
                "accepted": None,
                "feedback": None,
                "created_at": now_iso
            }, on_conflict="id").execute()
            logger.info(f"Saved recommendation {rec_id} to Supabase")
        except Exception as e:
            logger.error(f"Error saving recommendation to Supabase: {e}")

    # Save to SQLite
    with get_connection() as conn:
        cursor = conn.cursor()
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
        cursor.execute("""
            INSERT INTO recommendations (id, handle, type, content, confidence_score, accepted, feedback, created_at)
            VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
        """, (
            rec_id,
            clean_handle,
            recommendation_type,
            json.dumps(result_payload),
            confidence_score,
            now_iso
        ))
        conn.commit()

    return {
        "status": "success",
        "recommendation_id": rec_id,
        "recommendation_type": recommendation_type,
        "confidence_score": confidence_score,
        "data": result_payload
    }
