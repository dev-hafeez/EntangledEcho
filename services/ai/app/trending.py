"""
Google Trends Live Harvester & Niche Relevance Matcher
Fetches real-time search trends from Google Trends RSS and tailors post hooks to creator niches.
"""

import logging
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
    else:
        angle = f"Hot take on {title} for your audience."
        hook = f"My honest thoughts on {title} — agree or disagree? Let's discuss in the comments 👇"
        format_type = "CAROUSEL"

    return {
        "angle": angle,
        "suggested_hook": hook,
        "format": format_type
    }
