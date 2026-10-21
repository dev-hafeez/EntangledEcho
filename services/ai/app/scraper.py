import re
import urllib.request
import json
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


def extract_clean_handle(input_str: str) -> str:
    cleaned = input_str.strip()
    cleaned = re.sub(r'^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com)\/', '', cleaned, flags=re.I)
    cleaned = re.sub(r'[/?#].*$', '', cleaned)
    cleaned = cleaned.lstrip('@')
    return cleaned


def scrape_instagram_profile(handle_or_url: str) -> Dict[str, Any]:
    """
    Attempts to scrape real public Instagram profile data and posts.
    Extracts real followers, following, posts count, bio, and any SSR post items.
    """
    handle = extract_clean_handle(handle_or_url)
    url = f"https://www.instagram.com/{handle}/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }

    result = {
        "platform": "instagram",
        "handle": handle,
        "url": url,
        "is_real_scrape": True,
        "followers": None,
        "following": None,
        "media_count": None,
        "bio": None,
        "full_name": None,
        "posts": [],
        "status": "pending",
        "raw_message": ""
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

        # 1. Parse OpenGraph / Meta Description
        # e.g.: '268M Followers, 196 Following, 32K Posts - National Geographic (@natgeo) on Instagram: "Step into wonder..."'
        desc_match = re.search(r'<meta content=\"([^\"]+)\" name=\"description\"', html)
        if not desc_match:
            desc_match = re.search(r'<meta property=\"og:description\" content=\"([^\"]+)\"', html)

        if desc_match:
            desc = desc_match.group(1)
            result["raw_message"] = desc

            # Parse numbers
            m_foll = re.search(r'([\d.,]+[KkMmBb]?)\s*Followers', desc)
            if m_foll:
                result["followers"] = m_foll.group(1)

            m_folw = re.search(r'([\d.,]+[KkMmBb]?)\s*Following', desc)
            if m_folw:
                result["following"] = m_folw.group(1)

            m_post = re.search(r'([\d.,]+[KkMmBb]?)\s*Posts', desc)
            if m_post:
                result["media_count"] = m_post.group(1)

            # Bio text inside quotes
            m_bio = re.search(r'&quot;(.*?)&quot;', desc) or re.search(r'\"(.*?)\"', desc)
            if m_bio:
                result["bio"] = m_bio.group(1)

        # 2. Parse title
        title_match = re.search(r'<title>([^<]+)</title>', html)
        if title_match:
            result["full_name"] = title_match.group(1).replace(" • Instagram photos and videos", "").strip()

        # 3. Check for SSR JSON scripts with post captions
        scripts = re.findall(r'<script type=\"application/json\"[^>]*>(.*?)</script>', html)
        found_posts = []

        for s in scripts:
            # Look for captions
            caps = re.findall(r'\"caption\":\{\"text\":\"(.*?)\"\}', s)
            for c in caps[:12]:
                clean_cap = c.encode().decode('unicode_escape', errors='ignore')
                found_posts.append({
                    "caption": clean_cap,
                    "media_type": "carousel" if "carousel" in s.lower() else "reel" if "reel" in s.lower() else "image"
                })

        result["posts"] = found_posts
        result["status"] = "success"
        return result

    except urllib.error.HTTPError as he:
        result["status"] = f"http_{he.code}"
        result["raw_message"] = f"Instagram responded with HTTP {he.code}: {he.reason}. Meta anti-scraping active."
        return result
    except Exception as e:
        result["status"] = "error"
        result["raw_message"] = str(e)
        return result


def scrape_facebook_page(handle_or_url: str) -> Dict[str, Any]:
    """
    Attempts to scrape real public Facebook page data.
    Extracts real followers, 'talking about this' metric, title, and bio.
    """
    handle = extract_clean_handle(handle_or_url)
    url = f"https://www.facebook.com/{handle}/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    }

    result = {
        "platform": "facebook",
        "handle": handle,
        "url": url,
        "is_real_scrape": True,
        "followers": None,
        "talking_about": None,
        "bio": None,
        "title": None,
        "status": "pending",
        "raw_message": ""
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

        desc_match = re.search(r'<meta name=\"description\" content=\"([^\"]+)\"', html)
        if desc_match:
            desc = desc_match.group(1)
            result["raw_message"] = desc

            m_foll = re.search(r'([\d.,]+)\s*followers', desc, re.I)
            if m_foll:
                result["followers"] = m_foll.group(1)

            m_talk = re.search(r'([\d.,]+)\s*talking about this', desc, re.I)
            if m_talk:
                result["talking_about"] = m_talk.group(1)

            # Bio text after talking about this
            parts = desc.split('talking about this.')
            if len(parts) > 1:
                result["bio"] = parts[1].strip()

        title_match = re.search(r'<title>([^<]+)</title>', html)
        if title_match:
            result["title"] = title_match.group(1).replace(" - Home", "").replace(" | Facebook", "").strip()

        result["status"] = "success"
        return result

    except urllib.error.HTTPError as he:
        result["status"] = f"http_{he.code}"
        result["raw_message"] = f"Facebook responded with HTTP {he.code}: {he.reason}."
        return result
    except Exception as e:
        result["status"] = "error"
        result["raw_message"] = str(e)
        return result
