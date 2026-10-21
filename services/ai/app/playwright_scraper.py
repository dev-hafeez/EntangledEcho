import asyncio
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timezone
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

PROFILE_DIR = Path.home() / ".instagram-scraper-profile"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)


def parse_metric_string(val: Optional[str]) -> int:
    if not val:
        return 0
    val = val.strip().replace(",", "")
    multiplier = 1
    if val.lower().endswith("k"):
        multiplier = 1000
        val = val[:-1]
    elif val.lower().endswith("m"):
        multiplier = 1000000
        val = val[:-1]
    try:
        return int(float(val) * multiplier)
    except Exception:
        return 0


def normalize_post_url(url: str) -> str:
    return url.split("?")[0].rstrip("/") + "/"


def is_post_url(url: str) -> bool:
    return bool(re.search(r"/(p|reel|tv)/[^/]+/?$", url))


async def extract_profile_header(page) -> Dict[str, Any]:
    return await page.evaluate("""
        () => {
            const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.content || null;
            const getName = (name) => document.querySelector(`meta[name="${name}"]`)?.content || null;
            const desc = getMeta("og:description") || getName("description") || "";
            const title = getMeta("og:title") || document.title || "";
            const image = getMeta("og:image") || null;

            return {
                title,
                description: desc,
                image
            };
        }
    """)


async def extract_post_links(page) -> List[Dict[str, str]]:
    return await page.locator(
        'a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]'
    ).evaluate_all("""
        elements => elements.map(a => ({
            href: a.href,
            text: (a.innerText || "").trim()
        }))
    """)


async def extract_post_metadata(page) -> Dict[str, Any]:
    return await page.evaluate("""
        () => {
            const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.content || null;
            const getName = (name) => document.querySelector(`meta[name="${name}"]`)?.content || null;
            const desc = getMeta("og:description") || getName("description") || "";

            const timeEl = document.querySelector("time");
            const published = getMeta("article:published_time") || (timeEl ? timeEl.getAttribute("datetime") : null);

            return {
                title: document.title,
                description: desc,
                image: getMeta("og:image"),
                published_time: published,
                caption: getMeta("og:title"),
                page_url: location.href,
                page_text: document.body.innerText.slice(0, 10000)
            };
        }
    """)


async def scrape_instagram_profile_and_posts(
    username: str,
    max_posts: int = 12,
    headless: bool = True
) -> Dict[str, Any]:
    """
    Executes server-side Playwright crawler to extract real profile and posts.
    Preserves session in PROFILE_DIR so login state is maintained.
    """
    username = username.strip().lstrip("@")
    profile_url = f"https://www.instagram.com/{username}/"

    results: List[Dict[str, Any]] = []
    account_info: Dict[str, Any] = {
        "handle": username,
        "platform": "instagram",
        "followers": 0,
        "following": 0,
        "media_count": 0,
        "avatar_url": None,
        "bio": ""
    }

    async with async_playwright() as pw:
        # Use chromium persistent context
        context = await pw.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=headless,
            viewport={"width": 1366, "height": 900},
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )

        try:
            page = context.pages[0] if context.pages else await context.new_page()

            # Set realistic desktop headers
            await page.set_extra_http_headers({
                "Accept-Language": "en-US,en;q=0.9"
            })

            logger.info(f"Navigating to {profile_url}")
            await page.goto(profile_url, wait_until="domcontentloaded", timeout=45000)
            await page.wait_for_timeout(3000)

            # Extract profile header
            header = await extract_profile_header(page)
            desc = header.get("description", "")
            account_info["avatar_url"] = header.get("image")

            # Parse followers & counts from description: e.g. "12K Followers, 300 Following, 45 Posts"
            f_match = re.search(r'([\d.,]+[KkMmBb]?)\s*Followers', desc)
            if f_match:
                account_info["followers"] = parse_metric_string(f_match.group(1))

            fw_match = re.search(r'([\d.,]+[KkMmBb]?)\s*Following', desc)
            if fw_match:
                account_info["following"] = parse_metric_string(fw_match.group(1))

            p_match = re.search(r'([\d.,]+[KkMmBb]?)\s*Posts', desc)
            if p_match:
                account_info["media_count"] = parse_metric_string(p_match.group(1))

            # Bio
            bio_match = re.search(r'Instagram:\s*\"(.*?)\"', desc)
            if bio_match:
                account_info["bio"] = bio_match.group(1)

            # Discover posts by scrolling
            discovered_links: Dict[str, Dict[str, str]] = {}
            for scroll_step in range(1, 8):
                links = await extract_post_links(page)
                for l in links:
                    norm = normalize_post_url(l["href"])
                    if is_post_url(norm) and norm not in discovered_links:
                        discovered_links[norm] = l
                        if len(discovered_links) >= max_posts:
                            break

                if len(discovered_links) >= max_posts:
                    break

                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await page.wait_for_timeout(1500)

            logger.info(f"Discovered {len(discovered_links)} posts for {username}")

            # Visit discovered posts to extract real image, caption, likes, comments
            for idx, (post_url, link_data) in enumerate(list(discovered_links.items())[:max_posts], 1):
                try:
                    await page.goto(post_url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(1500)

                    meta = await extract_post_metadata(page)
                    p_desc = meta.get("description") or ""

                    # Parse likes and comments from og:description
                    # e.g. "1,420 likes, 85 comments - Username on Instagram: \"Caption text\""
                    likes = 0
                    comments = 0

                    likes_m = re.search(r'([\d.,]+[KkMmBb]?)\s*likes', p_desc, re.I)
                    if likes_m:
                        likes = parse_metric_string(likes_m.group(1))

                    comments_m = re.search(r'([\d.,]+[KkMmBb]?)\s*comments', p_desc, re.I)
                    if comments_m:
                        comments = parse_metric_string(comments_m.group(1))

                    caption = meta.get("caption") or ""
                    # If caption is "Instagram post by ..." extract from description quotes
                    cap_match = re.search(r'Instagram:\s*\"(.*?)\"', p_desc, re.DOTALL)
                    if cap_match:
                        caption = cap_match.group(1)

                    media_type = "reel" if "/reel/" in post_url else "image"
                    if "carousel" in (meta.get("page_text") or "").lower():
                        media_type = "carousel"

                    # Extract hashtags from caption
                    hashtags = re.findall(r'#\w+', caption)

                    # Performance score (FR-16): likes*1 + comments*3
                    # Normalized reach estimate (if reach not visible, estimate from likes ratio)
                    est_reach = max(likes * 8, account_info["followers"] * 0.2, 100)
                    weighted_eng = likes * 1.0 + comments * 3.0
                    perf_score = min(1.0, max(0.1, round((weighted_eng / est_reach) * 3.5, 3)))

                    shortcode_m = re.search(r'/(?:p|reel|tv)/([^/]+)', post_url)
                    shortcode = shortcode_m.group(1) if shortcode_m else f"{username}_{idx}"

                    results.append({
                        "id": f"post_{shortcode}",
                        "post_url": post_url,
                        "media_url": meta.get("image"),
                        "media_type": media_type,
                        "caption": caption.strip(),
                        "hashtags": hashtags[:5],
                        "posted_at": meta.get("published_time") or datetime.now(timezone.utc).isoformat(),
                        "perf_score": perf_score,
                        "likes": likes,
                        "comments": comments,
                        "reach": int(est_reach),
                        "sentiment": 0.5,
                        "topics": [hashtags[0]] if hashtags else ["Content"]
                    })

                except Exception as post_err:
                    logger.warning(f"Error reading post {post_url}: {post_err}")

        finally:
            await context.close()

    return {
        "status": "success",
        "account": account_info,
        "posts": results
    }
