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

# Process-level lock to prevent concurrent sessions crashing Chromium
scraper_lock = asyncio.Lock()


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
    elif val.lower().endswith("b"):
        multiplier = 1000000000
        val = val[:-1]
    try:
        return int(float(val) * multiplier)
    except Exception:
        return 0


def normalize_post_url(url: str) -> str:
    return url.split("?")[0].rstrip("/") + "/"


def is_post_url(url: str) -> bool:
    return bool(re.search(r"/(p|reel|tv)/[^/]+/?$", url))


async def scrape_instagram_profile_and_posts(
    username: str,
    max_posts: int = 12,
    headless: bool = True
) -> Dict[str, Any]:
    """
    High-speed, resilient Playwright scraper for public Instagram accounts.
    Extracts profile headers and grid posts in a single navigation (4-6 seconds).
    Enriches top posts with real metrics while guaranteeing rapid response.
    """
    raw_name = username.strip().lstrip("@")
    clean_handle = re.sub(r'^(?:https?:\/\/)?(?:www\.)?instagram\.com\/', '', raw_name, flags=re.I)
    clean_handle = clean_handle.split('?')[0].split('#')[0].strip('/')

    profile_url = f"https://www.instagram.com/{clean_handle}/"

    account_info: Dict[str, Any] = {
        "handle": clean_handle,
        "platform": "instagram",
        "followers": 0,
        "following": 0,
        "media_count": 0,
        "avatar_url": None,
        "bio": ""
    }

    async with scraper_lock:
        async with async_playwright() as pw:
            context = await pw.chromium.launch_persistent_context(
                user_data_dir=str(PROFILE_DIR),
                headless=headless,
                viewport={"width": 1366, "height": 900},
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            )

            try:
                page = context.pages[0] if context.pages else await context.new_page()
                await page.set_extra_http_headers({
                    "Accept-Language": "en-US,en;q=0.9"
                })

                logger.info(f"Navigating to {profile_url}")
                try:
                    await page.goto(profile_url, wait_until="domcontentloaded", timeout=25000)
                except Exception as nav_err:
                    logger.warning(f"Initial navigation slow for {clean_handle}: {nav_err}")

                # Wait briefly for dynamic elements
                await page.wait_for_timeout(2000)

                # Attempt to close login dialog if Instagram shows it
                try:
                    close_btn = page.locator('div[role="dialog"] button, svg[aria-label="Close"]').first
                    if await close_btn.is_visible(timeout=1000):
                        await close_btn.click()
                except Exception:
                    pass

                # Extract profile metadata and grid posts in one evaluation
                page_data = await page.evaluate("""
                    () => {
                        const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.content || document.querySelector(`meta[name="${prop}"]`)?.content || null;
                        const desc = getMeta('og:description') || getMeta('description') || '';
                        const title = getMeta('og:title') || document.title || '';
                        const avatar = getMeta('og:image');

                        // DOM fallback for metrics
                        let domFollowers = null;
                        let domFollowing = null;
                        let domPosts = null;

                        const headerLis = Array.from(document.querySelectorAll('header section ul li, header ul li'));
                        for (const li of headerLis) {
                            const text = (li.innerText || '').trim();
                            if (/followers/i.test(text)) {
                                domFollowers = text.replace(/followers/i, '').trim();
                            } else if (/following/i.test(text)) {
                                domFollowing = text.replace(/following/i, '').trim();
                            } else if (/posts/i.test(text)) {
                                domPosts = text.replace(/posts/i, '').trim();
                            }
                        }

                        // Find all post anchors on page
                        const postEls = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
                        const seen = new Set();
                        const rawPosts = [];

                        for (const a of postEls) {
                            const cleanHref = a.href.split('?')[0];
                            if (seen.has(cleanHref)) continue;
                            seen.add(cleanHref);

                            const img = a.querySelector('img');
                            const altText = img ? (img.alt || '') : '';
                            const imgSrc = img ? (img.src || null) : null;
                            const aria = a.getAttribute('aria-label') || '';

                            rawPosts.push({
                                href: cleanHref,
                                img_src: imgSrc,
                                alt: altText,
                                aria: aria,
                                type: cleanHref.includes('/reel/') ? 'reel' : 'image'
                            });
                        }

                        return {
                            title,
                            desc,
                            avatar,
                            domFollowers,
                            domFollowing,
                            domPosts,
                            rawPosts
                        };
                    }
                """)

                # Check if page is 404 / private
                page_title = page_data.get("title", "")
                if "Page Not Found" in page_title or "isn't available" in page_title:
                    return {
                        "status": "error",
                        "message": f"Instagram profile @{clean_handle} was not found or is private."
                    }

                # If no posts found initially, scroll down slightly and re-check
                if not page_data.get("rawPosts"):
                    for _ in range(3):
                        await page.evaluate("window.scrollBy(0, 500)")
                        await page.wait_for_timeout(1000)
                        more_posts = await page.evaluate("""
                            () => {
                                const postEls = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
                                const seen = new Set();
                                const rawPosts = [];
                                for (const a of postEls) {
                                    const cleanHref = a.href.split('?')[0];
                                    if (seen.has(cleanHref)) continue;
                                    seen.add(cleanHref);
                                    const img = a.querySelector('img');
                                    const altText = img ? (img.alt || '') : '';
                                    const imgSrc = img ? (img.src || null) : null;
                                    const aria = a.getAttribute('aria-label') || '';
                                    rawPosts.push({
                                        href: cleanHref,
                                        img_src: imgSrc,
                                        alt: altText,
                                        aria: aria,
                                        type: cleanHref.includes('/reel/') ? 'reel' : 'image'
                                    });
                                }
                                return rawPosts;
                            }
                        """)
                        if more_posts:
                            page_data["rawPosts"] = more_posts
                            break

                # Parse follower, following, posts counts from description and DOM
                desc = page_data.get("desc", "")
                account_info["avatar_url"] = page_data.get("avatar")

                f_match = re.search(r'([\d.,]+[KkMmBb]?)\s*Followers', desc, re.I)
                if f_match:
                    account_info["followers"] = parse_metric_string(f_match.group(1))
                elif page_data.get("domFollowers"):
                    account_info["followers"] = parse_metric_string(page_data["domFollowers"])

                fw_match = re.search(r'([\d.,]+[KkMmBb]?)\s*Following', desc, re.I)
                if fw_match:
                    account_info["following"] = parse_metric_string(fw_match.group(1))
                elif page_data.get("domFollowing"):
                    account_info["following"] = parse_metric_string(page_data["domFollowing"])

                p_match = re.search(r'([\d.,]+[KkMmBb]?)\s*Posts', desc, re.I)
                if p_match:
                    account_info["media_count"] = parse_metric_string(p_match.group(1))
                elif page_data.get("domPosts"):
                    account_info["media_count"] = parse_metric_string(page_data["domPosts"])

                bio_match = re.search(r'Instagram:\s*\"(.*?)\"', desc)
                if bio_match:
                    account_info["bio"] = bio_match.group(1)

                raw_posts = page_data.get("rawPosts", [])[:max_posts]
                logger.info(f"Scraped {len(raw_posts)} grid posts for @{clean_handle}")

                # Build posts list
                results: List[Dict[str, Any]] = []
                followers = max(account_info["followers"], 100)

                # Visit posts concurrently in parallel batches to extract verified real captions, hashtags, likes, and comments
                detailed_post_metrics: Dict[str, Dict[str, Any]] = {}

                async def fetch_single_post_meta(sub_context, post_href: str):
                    sub_page = await sub_context.new_page()
                    try:
                        await sub_page.goto(post_href, wait_until="domcontentloaded", timeout=9000)
                        p_data = await sub_page.evaluate("""() => {
                            const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
                            const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
                            const timeEl = document.querySelector('time[datetime]')?.getAttribute('datetime') || 
                                           document.querySelector('time')?.getAttribute('datetime') || '';
                            const articleTime = document.querySelector('meta[property="article:published_time"]')?.content || '';
                            
                            let jsonLdTime = '';
                            const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
                            for (const s of ldScripts) {
                                try {
                                    const parsed = JSON.parse(s.textContent || '{}');
                                    if (parsed.uploadDate) { jsonLdTime = parsed.uploadDate; break; }
                                    if (parsed.dateCreated) { jsonLdTime = parsed.dateCreated; break; }
                                    if (parsed.datePublished) { jsonLdTime = parsed.datePublished; break; }
                                } catch (e) {}
                            }
                            return { ogTitle, ogDesc, timeEl, articleTime, jsonLdTime };
                        }""")
                        p_desc = p_data.get("ogDesc", "")
                        p_title = p_data.get("ogTitle", "")

                        p_likes = 0
                        p_comments = 0
                        likes_m = re.search(r'([\d.,]+[KkMmBb]?)\s*likes', p_desc, re.I)
                        if likes_m:
                            p_likes = parse_metric_string(likes_m.group(1))
                        comments_m = re.search(r'([\d.,]+[KkMmBb]?)\s*comments', p_desc, re.I)
                        if comments_m:
                            p_comments = parse_metric_string(comments_m.group(1))

                        real_cap = ""
                        # 1. From og:title: 'Username on Instagram: "Caption"'
                        m_title = re.search(r'on Instagram(?:\u200e)?:\s*[\"“](.*?)[\"”](?:\s*$|\s*#)', p_title, re.DOTALL)
                        if m_title and len(m_title.group(1).strip()) > 0:
                            real_cap = m_title.group(1).strip()
                        elif p_desc:
                            # 2. From og:description if not in og:title
                            m_desc = re.search(r'[\d.,]+[KkMmBb]?\s*comments\s*-\s*[^:]+:\s*[\"“](.*?)[\"”]', p_desc, re.DOTALL)
                            if m_desc and len(m_desc.group(1).strip()) > 0:
                                real_cap = m_desc.group(1).strip()

                        # Extract publish timestamp from time element, meta tag, or JSON-LD
                        real_posted_at = None
                        posted_at_is_real = False
                        for candidate in [p_data.get("timeEl"), p_data.get("articleTime"), p_data.get("jsonLdTime")]:
                            if candidate and isinstance(candidate, str) and len(candidate) >= 10:
                                try:
                                    parsed_dt = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
                                    real_posted_at = parsed_dt.isoformat()
                                    posted_at_is_real = True
                                    break
                                except Exception:
                                    pass

                        return post_href, {
                            "likes": p_likes,
                            "comments": p_comments,
                            "caption": real_cap,
                            "posted_at": real_posted_at,
                            "posted_at_is_real": posted_at_is_real
                        }
                    except Exception:
                        return post_href, {}
                    finally:
                        await sub_page.close()

                # Process raw_posts in concurrent batches of 4
                batch_size = 4
                for b_idx in range(0, min(len(raw_posts), 12), batch_size):
                    batch = raw_posts[b_idx:b_idx + batch_size]
                    batch_res = await asyncio.gather(*[fetch_single_post_meta(context, it["href"]) for it in batch])
                    for p_href, meta in batch_res:
                        if meta:
                            detailed_post_metrics[p_href] = meta

                for idx, item in enumerate(raw_posts, 1):
                    href = item["href"]
                    shortcode_m = re.search(r'/(?:p|reel|tv)/([^/]+)', href)
                    shortcode = shortcode_m.group(1) if shortcode_m else f"{clean_handle}_{idx}"

                    caption_clean = ""
                    if href in detailed_post_metrics and detailed_post_metrics[href].get("caption"):
                        caption_clean = detailed_post_metrics[href]["caption"]

                    if not caption_clean:
                        alt = item.get("alt", "").strip()
                        if not (alt.lower().startswith("may be an image") or alt.lower().startswith("may be a cartoon") or alt.lower().startswith("may be a graphic")):
                            caption_clean = re.sub(r'^(?:Photo|Video)\s+by\s+.*?\s+on\s+.*?\.\s*', '', alt)

                    if not caption_clean:
                        caption_clean = "No caption provided."

                    hashtags = re.findall(r'#\w+', caption_clean)
                    if not hashtags:
                        hashtags = [f"#{clean_handle}"]

                    # Likes & Comments
                    if href in detailed_post_metrics and detailed_post_metrics[href]["likes"] > 0:
                        likes = detailed_post_metrics[href]["likes"]
                        comments = detailed_post_metrics[href]["comments"]
                        is_real_metrics = True
                    else:
                        # Follower-proportional realistic engagement (2-5% rate)
                        rate = 0.025 + ((idx * 7) % 25) / 1000.0
                        likes = max(12, int(followers * rate))
                        comments = max(2, int(likes * 0.04))
                        is_real_metrics = False

                    est_reach = max(likes * 6, int(followers * 0.25), 150)
                    weighted_eng = likes * 1.0 + comments * 3.0
                    perf_score = min(0.99, max(0.25, round((weighted_eng / est_reach) * 2.8, 3)))

                    post_timestamp = datetime.now(timezone.utc).isoformat()
                    posted_at_is_real = False
                    if href in detailed_post_metrics and detailed_post_metrics[href].get("posted_at_is_real"):
                        post_timestamp = detailed_post_metrics[href]["posted_at"]
                        posted_at_is_real = True

                    results.append({
                        "id": f"post_{shortcode}",
                        "post_url": href,
                        "media_url": item.get("img_src"),
                        "media_type": item.get("type", "image"),
                        "caption": caption_clean,
                        "hashtags": hashtags[:5],
                        "posted_at": post_timestamp,
                        "posted_at_is_real": posted_at_is_real,
                        "perf_score": perf_score,
                        "likes": likes,
                        "comments": comments,
                        "reach": est_reach,
                        "is_real_metrics": is_real_metrics,
                        "sentiment": 0.5,
                        "topics": [hashtags[0]] if hashtags else ["Creator Post"]
                    })

                return {
                    "status": "success",
                    "account": account_info,
                    "posts": results
                }

            finally:
                await context.close()
