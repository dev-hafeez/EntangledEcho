"""
Google Trends Live Harvester & Niche Relevance Matcher
Fetches real-time search trends from Google Trends RSS and tailors post hooks to creator niches.
"""

import logging
import re
import urllib.request
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

HT_NS = "{https://trends.google.com/trending/rss}"


def fetch_live_google_trends(geo: str = "US", limit: int = 15) -> List[Dict[str, Any]]:
    """
    Fetches live real-time trending topics from Google Trends RSS feed.
    """
    url = f"https://trends.google.com/trending/rss?geo={geo.upper()}"
    trends = []

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            xml_data = resp.read()
            root = ET.fromstring(xml_data)

            items = root.findall(".//item")
            for item in items[:limit]:
                title_el = item.find("title")
                title = title_el.text.strip() if title_el is not None and title_el.text else "Trending Topic"

                traffic_el = item.find(f"{HT_NS}approx_traffic")
                traffic = traffic_el.text.strip() if traffic_el is not None and traffic_el.text else "50K+"

                pub_date_el = item.find("pubDate")
                pub_date = pub_date_el.text.strip() if pub_date_el is not None and pub_date_el.text else ""

                pic_el = item.find(f"{HT_NS}picture")
                picture_url = pic_el.text.strip() if pic_el is not None and pic_el.text else None

                news_items = []
                for news_el in item.findall(f"{HT_NS}news_item"):
                    ntitle = news_el.find(f"{HT_NS}news_item_title")
                    nurl = news_el.find(f"{HT_NS}news_item_url")
                    nsource = news_el.find(f"{HT_NS}news_item_source")
                    if ntitle is not None and ntitle.text:
                        news_items.append({
                            "title": ntitle.text.strip(),
                            "url": nurl.text.strip() if nurl is not None and nurl.text else "",
                            "source": nsource.text.strip() if nsource is not None and nsource.text else "Google News"
                        })

                trends.append({
                    "id": f"trend_{len(trends) + 1}",
                    "title": title,
                    "traffic": traffic,
                    "published_at": pub_date,
                    "picture_url": picture_url,
                    "news_headlines": news_items[:2]
                })

    except Exception as e:
        logger.warning(f"Error fetching Google Trends for geo={geo}: {e}")
        # Fallback to high-interest curated social media topics if offline
        trends = [
            {
                "id": "trend_fallback_1",
                "title": "AI Video Generation Tools 2026",
                "traffic": "500K+",
                "published_at": datetime.now().strftime("%a, %d %b %Y %H:%M:%S GMT"),
                "picture_url": None,
                "news_headlines": [{"title": "New generation of creator tools transforming Instagram Reels", "source": "TechCrunch"}]
            },
            {
                "id": "trend_fallback_2",
                "title": "Minimalist Lifestyle & Productivity Routines",
                "traffic": "200K+",
                "published_at": datetime.now().strftime("%a, %d %b %Y %H:%M:%S GMT"),
                "picture_url": None,
                "news_headlines": [{"title": "Why short-form creators are leaning into raw, unedited aesthetics", "source": "Creator Weekly"}]
            }
        ]

    return trends


def infer_creator_geo_and_language(
    account: Dict[str, Any],
    posts: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, str]:
    """
    Infers the creator's country geo (for Google Trends RSS) and primary language/dialect
    from handle, bio, and verified post captions.
    """
    handle = (account.get("handle") or "").strip().lstrip("@").lower()
    bio = (account.get("bio") or "").strip()
    captions = []
    if posts:
        for p in posts:
            cap = p.get("caption") or ""
            if cap:
                captions.append(cap)
    combined = f"{bio} {' '.join(captions)}".strip()

    # 1. Check known international figures
    known_handles = {
        # Indian / South Asian
        "diljitdosanjh": ("IN", "Punjabi / Hindi blend (Gurmukhi & English)"),
        "virat.kohli": ("IN", "Indian English & Hindi"),
        "rohitsharma45": ("IN", "Indian English & Hindi"),
        "tigerjackieshroff": ("IN", "Indian English & Hindi"),
        "deepikapadukone": ("IN", "Indian English & Hindi"),
        "priyankachopra": ("IN", "Global English & Hindi"),
        "katrinakaif": ("IN", "Indian English & Hindi"),
        "aliaabhatt": ("IN", "Indian English & Hindi"),
        "ranveersingh": ("IN", "High-Energy Hindi & English"),
        # Spanish / Latin American
        "leomessi": ("AR", "Spanish (Argentine / Rioplatense)"),
        "karolg": ("CO", "Spanish (Colombian / Paisa / Bichota)"),
        "badbunnypr": ("PR", "Spanish (Puerto Rican / Urbano)"),
        "shakira": ("CO", "Spanish (Colombian / Latin pop)"),
        "rosalia.vt": ("ES", "Spanish (Spain / Flamenco pop)"),
        "sergioramos": ("ES", "Spanish (Spain / Athletic)"),
        "canelo": ("MX", "Spanish (Mexican / Boxing)"),
        "maluma": ("CO", "Spanish (Colombian / Reggaeton)"),
        "jbalvin": ("CO", "Spanish (Colombian / Reggaeton)"),
        "anuel": ("PR", "Spanish (Puerto Rican / Trap)"),
        # Portuguese / Brazilian
        "cristiano": ("PT", "Portuguese / Global Athletic English"),
        "neymarjr": ("BR", "Portuguese (Brazilian / Menino da Vila)"),
        "anitta": ("BR", "Portuguese (Brazilian / Funk carioca)"),
        "ronaldinho": ("BR", "Portuguese (Brazilian)"),
        "vinijr": ("BR", "Portuguese (Brazilian / Real Madrid)"),
        "alissonbecker": ("BR", "Portuguese (Brazilian)"),
        # Italian
        "khaby00": ("IT", "Italian & Universal Visual"),
        "chiaraferragni": ("IT", "Italian & Fashion English"),
        "gianluigibuffon": ("IT", "Italian"),
        # French
        "k.mbappe": ("FR", "French & Athletic English"),
        "karimbenzema": ("FR", "French (KB9)"),
    }

    if handle in known_handles:
        geo, lang = known_handles[handle]
        return {"geo": geo, "language": lang}

    # 2. Script detection
    if re.search(r'[\u0A00-\u0A7F]', combined):  # Gurmukhi
        return {"geo": "IN", "language": "Punjabi (Gurmukhi & English blend)"}
    if re.search(r'[\u0900-\u097F]', combined):  # Devanagari
        return {"geo": "IN", "language": "Hindi"}
    if re.search(r'[\u0600-\u06FF]', combined):  # Arabic / Urdu
        return {"geo": "AE", "language": "Arabic"}
    if re.search(r'[\u0400-\u04FF]', combined):  # Cyrillic
        return {"geo": "UA", "language": "Ukrainian / Russian"}

    # 3. Vocabulary Frequency Heuristic for Latin-script languages
    words = set(re.findall(r'\b[A-Za-zÀ-ÿ]+\b', combined.lower()))
    spanish_tokens = {'el', 'la', 'que', 'de', 'en', 'un', 'los', 'del', 'las', 'por', 'con', 'para', 'vamos', 'gracias', 'partido', 'amor', 'dia', 'hoy', 'siempre', 'noche'}
    portuguese_tokens = {'o', 'a', 'do', 'da', 'em', 'um', 'para', 'os', 'no', 'na', 'por', 'mais', 'com', 'futebol', 'jogo', 'vitoria', 'obrigado', 'trabalho', 'passo', 'equipa'}
    italian_tokens = {'il', 'lo', 'la', 'gli', 'le', 'in', 'con', 'su', 'per', 'grazie', 'tutti', 'sempre', 'bella', 'foto', 'giorno', 'oggi'}
    french_tokens = {'le', 'la', 'les', 'des', 'du', 'dans', 'avec', 'pour', 'sur', 'merci', 'match', 'victoire', 'nouveau', 'monde'}

    sp_count = len(words & spanish_tokens)
    pt_count = len(words & portuguese_tokens)
    it_count = len(words & italian_tokens)
    fr_count = len(words & french_tokens)

    counts = [("ES", "Spanish", sp_count), ("BR", "Portuguese", pt_count), ("IT", "Italian", it_count), ("FR", "French", fr_count)]
    counts.sort(key=lambda x: x[2], reverse=True)

    if counts[0][2] >= 2:
        return {"geo": counts[0][0], "language": counts[0][1]}

    # Default to US & English
    return {"geo": "US", "language": "English"}


def fetch_niche_relevant_trends(
    account: Dict[str, Any],
    posts: Optional[List[Dict[str, Any]]] = None,
    niche: Optional[str] = None,
    limit: int = 12
) -> List[Dict[str, Any]]:
    """
    Fetches live Google Trends for both the creator's country and global,
    then scores and filters the trends so only those RELEVANT to the creator's
    posts, niche, and language are returned with adapted hashtags.
    """
    geo_info = infer_creator_geo_and_language(account, posts)
    creator_geo = geo_info["geo"]
    creator_lang = geo_info["language"]

    raw_trends: List[Dict[str, Any]] = []

    # 1. Fetch from creator's country
    local_trends = fetch_live_google_trends(geo=creator_geo, limit=limit)
    for t in local_trends:
        t["source_geo"] = creator_geo
        raw_trends.append(t)

    # 2. If creator is outside US, also fetch US/Global trends to maximize coverage
    if creator_geo != "US":
        global_trends = fetch_live_google_trends(geo="US", limit=limit)
        for t in global_trends:
            t["source_geo"] = "US"
            raw_trends.append(t)

    # Deduplicate trends by title
    seen_titles = set()
    distinct_trends = []
    for t in raw_trends:
        norm = t["title"].strip().lower()
        if norm and norm not in seen_titles:
            seen_titles.add(norm)
            distinct_trends.append(t)

    # 3. Score relevance to Creator's Niche and Posts
    niche_lower = (niche or "").lower()
    post_captions_lower = " ".join([p.get("caption", "").lower() for p in (posts or [])[:6]])
    combined_context = f"{niche_lower} {post_captions_lower}".strip()

    sports_keywords = {"football", "soccer", "match", "vs", "win", "points", "club", "game", "league", "cup", "tennis", "fight", "ufc", "player", "atp", "cricket", "f1", "race", "derby"}
    music_keywords = {"music", "song", "album", "tour", "concert", "singer", "artist", "rap", "pop", "grammy", "performance", "single", "dance", "audio"}
    cinema_keywords = {"movie", "film", "actor", "actress", "cinema", "trailer", "series", "netflix", "show", "premiere", "director"}
    tech_keywords = {"ai", "tech", "software", "code", "model", "phone", "apple", "google", "meta", "nvidia", "hardware", "cyber", "update"}
    fitness_keywords = {"fitness", "gym", "workout", "bodybuilding", "training", "physique", "lift", "exercise", "strength"}
    fashion_keywords = {"fashion", "style", "beauty", "dress", "outfit", "brand", "model", "wear", "makeup", "luxury"}

    def compute_trend_score(t: Dict[str, Any]) -> float:
        title = t.get("title", "").lower()
        headlines = " ".join([h.get("title", "").lower() for h in t.get("news_headlines", [])])
        text = f"{title} {headlines}"
        score = 1.0

        # High search traffic bonus
        traffic_str = t.get("traffic", "10K+").upper()
        if "M+" in traffic_str or "500K+" in traffic_str:
            score += 2.0
        elif "100K+" in traffic_str or "200K+" in traffic_str:
            score += 1.5

        # Check match with creator's niche category
        if any(k in niche_lower for k in ["sport", "football", "athletic"]):
            if any(k in text for k in sports_keywords):
                score += 5.0
        elif any(k in niche_lower for k in ["music", "sing"]):
            if any(k in text for k in music_keywords):
                score += 5.0
        elif any(k in niche_lower for k in ["film", "cinema", "act"]):
            if any(k in text for k in cinema_keywords):
                score += 5.0
        elif any(k in niche_lower for k in ["tech", "software", "code"]):
            if any(k in text for k in tech_keywords):
                score += 5.0
        elif any(k in niche_lower for k in ["fit", "gym"]):
            if any(k in text for k in fitness_keywords | sports_keywords):
                score += 5.0
        elif any(k in niche_lower for k in ["fashion", "beauty"]):
            if any(k in text for k in fashion_keywords):
                score += 5.0

        # Context direct keyword match with previous posts
        for token in set(title.split()):
            if len(token) > 3 and token in combined_context:
                score += 3.0

        # Favor local trends over foreign ones for international creators
        if t.get("source_geo") == creator_geo and creator_geo != "US":
            score += 2.5

        return score

    distinct_trends.sort(key=compute_trend_score, reverse=True)

    # 4. Generate clean hashtags & language-adapted hooks
    results = []
    for item in distinct_trends[:limit]:
        title = item.get("title", "")
        # Build clean hashtag
        words = re.findall(r'[A-Za-z0-9]+', title)
        tag = "#" + "".join(w.capitalize() for w in words[:3]) if words else "#Trending"

        # Adapted language tags
        lang_tags = [tag]
        if "Spanish" in creator_lang and any(k in niche_lower for k in ["sport", "football"]):
            lang_tags.append("#Vamos")
        elif "Portuguese" in creator_lang and any(k in niche_lower for k in ["sport", "football"]):
            lang_tags.append("#Futebol")
        elif "Punjabi" in creator_lang or "Hindi" in creator_lang:
            lang_tags.append("#DiljitTour" if "diljit" in account.get("handle", "") else "#DesiVibes")

        item["adapted_hashtag"] = tag
        item["hashtag_cluster"] = lang_tags
        item["creator_language"] = creator_lang
        item["target_geo"] = creator_geo
        results.append(item)

    return results


def tailor_trend_to_niche(trend: Dict[str, Any], niche: str) -> Dict[str, str]:
    """
    Generates a niche-specific angle/hook for a trending topic.
    """
    title = trend.get("title", "")
    niche_lower = (niche or "general").lower()

    if any(k in niche_lower for k in ["video", "edit", "creative", "camera"]):
        angle = f"How video editors can recreate the {title} aesthetic in 3 steps."
        hook = f"Everyone is talking about {title}, but watch how I edited this transition inspired by it! 🎬"
        format_type = "REEL"
    elif any(k in niche_lower for k in ["tech", "ai", "code", "software"]):
        angle = f"The technology and algorithms behind {title} explained simply."
        hook = f"Here is the tech side of {title} that nobody is showing you! 💻"
        format_type = "CAROUSEL"
    elif any(k in niche_lower for k in ["fitness", "gym", "health"]):
        angle = f"Fitness takeaway / discipline lesson inspired by {title}."
        hook = f"What {title} taught me about consistency and focus in training! 💪"
        format_type = "REEL"
    elif any(k in niche_lower for k in ["comedy", "humor", "meme"]):
        angle = f"Relatable comedic take on {title}."
        hook = f"When you check the news and {title} is trending everywhere... 😂"
        format_type = "REEL"
    elif any(k in niche_lower for k in ["sport", "football", "soccer"]):
        angle = f"High-energy sporting takeaway from the {title} spotlight."
        hook = f"Matchday intensity: what the buzz around {title} proves about staying at the top level! ⚽️🔥"
        format_type = "REEL"
    elif any(k in niche_lower for k in ["music", "concert", "sing"]):
        angle = f"Behind-the-scenes music energy and tour spotlight inspired by {title}."
        hook = f"Soundtrack to our journey: feeling that {title} momentum on and off the stage! 🎶✨"
        format_type = "REEL"
    else:
        angle = f"Hot take on {title} for your audience."
        hook = f"My honest thoughts on {title} — agree or disagree? Let's discuss in the comments 👇"
        format_type = "CAROUSEL"

    return {
        "angle": angle,
        "suggested_hook": hook,
        "format": format_type
    }

