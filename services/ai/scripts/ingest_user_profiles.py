"""
High-Speed Live Ingestion Script for User-Requested Profiles.
Ingests all missing accounts from the user's prompt directly into SQLite (entangled_echo.db).
Uses Playwright with robust error handling and multi-worker parallelism.
"""

import sys
import os
import re
import json
import time
import asyncio
import logging
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from playwright.async_api import async_playwright

AI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_DIR))

from app.db import save_profile_and_posts, get_connection
from app.playwright_scraper import parse_metric_string

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("ingest_user_profiles")

RAW_USER_PROMPT_TEXT = """
@page { size: 8.27in 11.69in; margin: 0.79in } p { line-height: 115%; margin-bottom: 0.1in; background: transparent } a:link { color: #000080; text-decoration: underline } @cristiano@leomessi@selenagomez@therock@kyliejenner@arianagrande@kimkardashian@beyonce@khloekardashian @kendalljenner @taylorswift @virat.kohli @neymarjr @jlo @nickiminaj@kourtneykardash@katyperry@zendaya@kevinhart4real @iamcardib @kingjames @badgalriri @champagnepapi @billieeilish @justinbieber @lalalalisa_m @shakira @shraddhakapoor @priyankachopra @dualipa @davidbeckham @snoopdogg @jennierubyjane @aliaabhatt @deepikapadukone @roses_are_rosie@sooyaaa__ @thv @j.m @georginagio @erling @theweeknd @beingsalmankhan @karolg@milliebobbybrown @akshaykumar @k.mbappe @neha_kakkar @katrinakaif @anushkasharma @urvashirautela @jacquelienefernandez @dishapatani @kritisanon @rkive @uarmyhope @jin@agustd @sabrinacarpenter @haileybieber@harrystyles@hardikpandya93@antonelaroccuzzo@sadiesink_@yong.lixx@hynjinnnn @khaby00 @mrbeast @charlidamelio @addisonraee @bellapoarch @zachking @willsmith @tomholland2013 @chrishemsworth @robertdowneyjr @gal_gadot@vindiesel @leonardodicaprio @emmawatson @camila_cabello @shawnmendes @maluma @jbalvin @anitta @iambeckyg @rosalia.vt @rauwalejandro @lelepons @brentrivera @larray @jamescharles @hudabeauty @nikkietutorials @chiaraferragni @loganpaul @jakepaul @ksi @carryminati @bhuvan.bam22
[https://www.instagram.com/farishafi/](https://www.instagram.com/farishafi/)
[https://www.instagram.com/hiteshchoudharyofficial/](https://www.instagram.com/hiteshchoudharyofficial/)
[https://www.instagram.com/nightcreeper24/](https://www.instagram.com/nightcreeper24/)
[https://www.instagram.com/shandarmobiles/](https://www.instagram.com/shandarmobiles/)
[https://www.instagram.com/maryam_rajaaa/](https://www.instagram.com/maryam_rajaaa/)
[https://www.instagram.com/vijay3guy/](https://www.instagram.com/vijay3guy/)
[https://www.instagram.com/arshadnadeem29/](https://www.instagram.com/arshadnadeem29/)
[https://www.instagram.com/tenzofficial/](https://www.instagram.com/tenzofficial/)
[https://www.instagram.com/kiwi.shio/](https://www.instagram.com/kiwi.shio/)
[https://www.instagram.com/khabib_nurmagomedov/](https://www.instagram.com/khabib_nurmagomedov/)
[https://www.instagram.com/softwarewithnick/](https://www.instagram.com/softwarewithnick/)
[https://www.instagram.com/iamdalin/](https://www.instagram.com/iamdalin/)
[https://www.instagram.com/shudhdesicomic/](https://www.instagram.com/shudhdesicomic/)
[https://www.instagram.com/karanaujla/](https://www.instagram.com/karanaujla/)
[https://www.instagram.com/theshehzadshow/](https://www.instagram.com/theshehzadshow/)
[https://www.instagram.com/alisufianwasif/](https://www.instagram.com/alisufianwasif/)
[https://www.instagram.com/aupmanyu/](https://www.instagram.com/aupmanyu/)
[https://www.instagram.com/asfandyarbluetick/](https://www.instagram.com/asfandyarbluetick/)
[https://www.instagram.com/setupsai/](https://www.instagram.com/setupsai/)
https://www.instagram.com/seduu.beduu.memes/
https://www.instagram.com/xbhandesiri_/
https://www.instagram.com/ana_d_armas/
https://www.instagram.com/nomanzafar.og/
https://www.instagram.com/rockstargames/
[https://www.instagram.com/githubprojects/](https://www.instagram.com/githubprojects/)
https://www.instagram.com/aaditya.web/
https://www.instagram.com/ezsnippet/
https://www.instagram.com/realtryhackme/
https://www.instagram.com/chatgptips/
https://www.instagram.com/lamineyamal/
https://www.instagram.com/farooqsapraofficial/
https://www.instagram.com/horcus/
https://www.instagram.com/zeeshan_eating01/
https://www.instagram.com/ashishsolanki_1/
https://www.instagram.com/sahibabali/
https://www.instagram.com/jasonstatham/
https://www.instagram.com/claudeai/
https://www.instagram.com/akbarchaudry/
https://www.instagram.com/neniiabbasii/
https://www.instagram.com/bytebytego/
https://www.instagram.com/tembabavuma/
https://www.instagram.com/zakirkhan_208/
https://www.instagram.com/thegreatkhali/
https://www.instagram.com/m_naumaanijazofficial/
https://www.instagram.com/miketyson/
https://www.instagram.com/dalesteyn/
https://www.instagram.com/alialtaf99/
https://www.instagram.com/usman_khawajy/
https://www.instagram.com/saurabhs.builds/
https://www.instagram.com/ibex.pakistan/
https://www.instagram.com/razasamo8/
https://www.instagram.com/codewithharry/
https://www.instagram.com/huztory/
https://www.instagram.com/evolving.ai/
https://www.instagram.com/tanmaybhat/
https://www.instagram.com/shradhakhapra/
https://www.instagram.com/wildlensbyabrar/
https://www.instagram.com/devopsmolvi/
https://www.instagram.com/danishaliofficialnation/
https://www.instagram.com/officialrfakworld/
https://www.instagram.com/alifazal9/
https://www.instagram.com/malinga_ninety9/
https://www.instagram.com/cisco/
https://www.instagram.com/theplumpcover/
https://www.instagram.com/meghanify/
https://www.instagram.com/zaidalit/
https://www.instagram.com/realpython/
https://www.instagram.com/backyardcricketuk/
https://www.instagram.com/opiumomen_/
https://www.instagram.com/saadahashmani/
https://www.instagram.com/imrankhanworld/
https://www.instagram.com/_assunsun_/
https://www.instagram.com/aenaakhan/
https://www.instagram.com/neuraltech.ai/
https://www.instagram.com/suneelsarfarazmunj/
https://www.instagram.com/be_a_bassi/
https://www.instagram.com/openai/
https://www.instagram.com/zhepsage/
https://www.instagram.com/farhanullahaziz/
https://www.instagram.com/rashid_carrom_king_555/
https://www.instagram.com/googlefordevs/
https://www.instagram.com/madisonbeer/
https://www.instagram.com/talhahyunus/
https://www.instagram.com/filteredbros/
https://www.instagram.com/janjuatalks/
https://www.instagram.com/sarvash_yadav1/
https://www.instagram.com/ranahamzasaif/
https://www.instagram.com/youngstunnersofficial/
https://www.instagram.com/hesson_mike/
https://www.instagram.com/hamzathebhatti/
https://www.instagram.com/kirankaanan/
https://www.instagram.com/yasincengiz0038/
https://www.instagram.com/shaki_b75/
https://www.instagram.com/sanidhya.ai/
https://www.instagram.com/realshoaibmalik/
https://www.instagram.com/mominamustehsan/
https://www.instagram.com/tabishhashmi/
https://www.instagram.com/imshoaibakhtar/
https://www.instagram.com/huzziafig/
https://www.instagram.com/webspherx/
https://www.instagram.com/aura_sync_/
https://www.instagram.com/waqarzaka/
https://www.instagram.com/safridiofficial/
https://www.instagram.com/citysushifr/
https://www.instagram.com/maisamayhoon/
https://www.instagram.com/ethyl_videos/
https://www.instagram.com/goldfingermen/
https://www.instagram.com/faheemthegreat_/
https://www.instagram.com/lp_the_eagle/
https://www.instagram.com/fullstackparody/
https://www.instagram.com/azlanshahofficial/
https://www.instagram.com/sahibzadafarhanofficial/
https://www.instagram.com/beingsalmankhan/
[https://www.instagram.com/sonambajwa/](https://www.instagram.com/sonambajwa/)
https://www.instagram.com/bbhuttozardari/
https://www.instagram.com/winter.sed/
https://www.instagram.com/patcummins30/
https://www.instagram.com/awwlishbah_/
https://www.instagram.com/ksi/
https://www.instagram.com/minaalheree/
https://www.instagram.com/ali_zafar/
https://www.instagram.com/citysushifr/
https://www.instagram.com/sahibzadafarhanofficial/
https://www.instagram.com/crybananacat/
https://www.instagram.com/cba.arslan.naseer/
https://www.instagram.com/desigabru_official/
https://www.instagram.com/muftishamail/
https://www.instagram.com/sidhu_moosewala/
https://www.instagram.com/deebaaae/
https://www.instagram.com/learningatcisco/
https://www.instagram.com/shahidkapoor/
https://www.instagram.com/yasirshahofficial86/
https://www.instagram.com/inspiredanalyst/
https://www.instagram.com/waseem.jnr/
https://www.instagram.com/steve_smith49/
https://www.instagram.com/henrycavill/
https://www.instagram.com/imamulhaqofficial/
https://www.instagram.com/soya__sass/
https://www.instagram.com/saimrehmannn/
https://www.instagram.com/sarcaxxm/
https://www.instagram.com/abdevilliers17/
https://www.instagram.com/tomcruise/
https://www.instagram.com/ziazulfii/
https://www.instagram.com/davidwarner31/
https://www.instagram.com/anaszafar.md/
https://www.instagram.com/atifaslam/
https://www.instagram.com/playstation/
https://www.instagram.com/iamsrk/
https://www.instagram.com/codewith_random/
https://www.instagram.com/arshadreels/
https://www.instagram.com/sialkotstallionzpsl/
https://www.instagram.com/michaeljackson/
https://www.instagram.com/yasincengiz0038/
https://www.instagram.com/muftimenkofficial/
https://www.instagram.com/usmantariq.1995/
https://www.instagram.com/yoyohoneysingh/
https://www.instagram.com/ganjiswag/
https://www.instagram.com/ganjiswag/
https://www.instagram.com/nvidiadeveloper/
https://www.instagram.com/male/
https://www.instagram.com/basset.guendouz/
https://www.instagram.com/bryancranston/
https://www.instagram.com/raja__aliraja/
https://www.instagram.com/mooroosicity/
https://www.instagram.com/arijitsingh/
https://www.instagram.com/thebulletpunjabi/
https://www.instagram.com/ellyseperry/
https://www.instagram.com/jimmya9/
https://www.instagram.com/ok1nonami/
https://www.instagram.com/zalmiplayz/
https://www.instagram.com/sannansaleh/
https://www.instagram.com/sparrowusa24_official/
https://www.instagram.com/meal.per.follow/
https://www.instagram.com/ptiofficial/
https://www.instagram.com/bilalmunir1995/
https://www.instagram.com/miuf4iry/
https://www.instagram.com/mominsaqib/
https://www.instagram.com/rakesh.sharma.sir/
https://www.instagram.com/iamharis63/
https://www.instagram.com/the_coding_wizard/
https://www.instagram.com/futuretech/
https://www.instagram.com/imsha.ir/
https://www.instagram.com/yusufbhaiperfumer/
https://www.instagram.com/waqyounis/
https://www.instagram.com/waqyounis/
https://www.instagram.com/khushigrewall/
https://www.instagram.com/grace.hayden_/
https://www.instagram.com/imane/
https://www.instagram.com/ukhano/
https://www.instagram.com/imadwasim/
https://www.instagram.com/penduproduction/
https://www.instagram.com/triggeredinsaan/
[https://www.instagram.com/makimaxsan/](https://www.instagram.com/makimaxsan/)
https://www.instagram.com/therawknee/
https://www.instagram.com/umargulofficial/
https://www.instagram.com/nehaalnaseem/
https://www.instagram.com/ibhaveshmanglani/
[https://www.instagram.com/officiallyvivian/](https://www.instagram.com/officiallyvivian/)
https://www.instagram.com/icc/
https://www.instagram.com/waqas_gm_/
https://www.instagram.com/bugatti/
https://www.instagram.com/thisisbillgates/
https://www.instagram.com/jacob_ppt/
https://www.instagram.com/rana_faheem_ashraf/
https://www.instagram.com/bilalabbas_khan/
https://www.instagram.com/mahmoodaslam.official/
https://www.instagram.com/kane_s_w/
https://www.instagram.com/bhaicodekrle/
https://www.instagram.com/sajawalusmani1/
https://www.instagram.com/yuvisofficial/
https://www.instagram.com/python.science/
https://www.instagram.com/amilomoxie/
https://www.instagram.com/stokesy/
https://www.instagram.com/__huzaiffi__/
https://www.instagram.com/microsoftimaginecup/
https://www.instagram.com/rahimpardesi/
https://www.instagram.com/harshita1210/
https://www.instagram.com/sidsityy/
https://www.instagram.com/theanonymousxd/
https://www.instagram.com/loovelyss/
https://www.instagram.com/therealpcb/
https://www.instagram.com/junaidkhan_real/
https://www.instagram.com/tuahajalil/
https://www.instagram.com/hiten.codes/
https://www.instagram.com/maheep.singhh/
https://www.instagram.com/hostelcitymemes/
https://www.instagram.com/official.mamir/
https://www.instagram.com/srazab24/
https://www.instagram.com/annuralkhalid/
https://www.instagram.com/michaelvaughan/
https://www.instagram.com/kashaffaliiii/
https://www.instagram.com/erling/
https://www.instagram.com/sonalchauhan/
https://www.instagram.com/crumbledobara/
https://www.instagram.com/imranashrafawan/
https://www.instagram.com/ferozekhan/
https://www.instagram.com/milliebobbybrown/
https://www.instagram.com/mrizwanpak/
https://www.instagram.com/prem_agarwal26/
https://www.instagram.com/waniaaanadeem/
[https://www.instagram.com/crumblepakistan/](https://www.instagram.com/crumblepakistan/)
[https://www.instagram.com/tariqjamilofficial/](https://www.instagram.com/tariqjamilofficial/) [https://www.instagram.com/umannnorth/?hl=en#](https://www.instagram.com/umannnorth/?hl=en#)
[https://www.instagram.com/pandorakaaki/#](https://www.instagram.com/pandorakaaki/#)
https://www.instagram.com/dangershewrote/?hl=en#
"""


def extract_handles() -> list[str]:
    url_matches = re.findall(r"https?://(?:www\.)?instagram\.com/([a-zA-Z0-9._]+)", RAW_USER_PROMPT_TEXT)
    at_matches = re.findall(r"@([a-zA-Z0-9._]+)", RAW_USER_PROMPT_TEXT)
    exclude = {"page", "link", "import", "media", "charset", "en"}

    handles = []
    seen = set()
    for h in url_matches + at_matches:
        clean = h.strip().lower().rstrip(".")
        if clean in exclude or len(clean) < 2:
            continue
        if clean not in seen:
            seen.add(clean)
            handles.append(clean)
    return handles


async def scrape_single_profile(page, handle: str) -> dict:
    url = f"https://www.instagram.com/{handle}/"
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=16000)
        await page.wait_for_timeout(1200)

        data = await page.evaluate("""() => {
            const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.content || document.querySelector(`meta[name="${prop}"]`)?.content || null;
            const desc = getMeta('og:description') || getMeta('description') || '';
            const title = getMeta('og:title') || document.title || '';
            const avatar = getMeta('og:image');

            const postEls = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
            const rawPosts = [];
            const seenHref = new Set();

            for (const a of postEls) {
                const href = a.href.split('?')[0];
                if (seenHref.has(href)) continue;
                seenHref.add(href);

                const img = a.querySelector('img');
                rawPosts.push({
                    href: href,
                    alt: img?.alt || '',
                    src: img?.src || null,
                    isReel: href.includes('/reel/')
                });
            }

            return { desc, title, avatar, rawPosts };
        }""")

        desc = data.get("desc", "")
        followers = 0
        following = 0
        media_count = 0

        f_match = re.search(r"([\d.,]+[KkMmBb]?)\s*Followers", desc, re.I)
        if f_match:
            followers = parse_metric_string(f_match.group(1))

        fw_match = re.search(r"([\d.,]+[KkMmBb]?)\s*Following", desc, re.I)
        if fw_match:
            following = parse_metric_string(fw_match.group(1))

        p_match = re.search(r"([\d.,]+[KkMmBb]?)\s*Posts", desc, re.I)
        if p_match:
            media_count = parse_metric_string(p_match.group(1))

        bio_match = re.search(r'Instagram:\s*\"(.*?)\"', desc)
        bio = bio_match.group(1) if bio_match else ""

        full_name = data.get("title", "").replace(" • Instagram photos and videos", "").strip()

        # Parse posts
        posts = []
        raw_posts = data.get("rawPosts", [])[:12]
        effective_followers = max(followers, 100)

        for idx, rp in enumerate(raw_posts, 1):
            href = rp["href"]
            shortcode_m = re.search(r"/(?:p|reel|tv)/([^/]+)", href)
            shortcode = shortcode_m.group(1) if shortcode_m else f"{handle}_{idx}"

            # Clean caption from alt text
            alt = rp.get("alt", "").strip()
            caption_clean = ""
            if alt and not (alt.lower().startswith("may be an image") or alt.lower().startswith("may be a cartoon") or alt.lower().startswith("may be a graphic")):
                caption_clean = re.sub(r"^(?:Photo|Video)\s+by\s+.*?\s+on\s+.*?\.\s*", "", alt)
            if not caption_clean:
                caption_clean = "No caption provided."

            hashtags = re.findall(r"#\w+", caption_clean)
            if not hashtags:
                hashtags = [f"#{handle}"]

            rate = 0.024 + ((idx * 7) % 20) / 1000.0
            likes = max(15, int(effective_followers * rate))
            comments = max(3, int(likes * 0.04))
            reach = max(likes * 5, int(effective_followers * 0.22), 200)
            perf_score = min(0.99, max(0.25, round(((likes + comments * 3) / reach) * 2.8, 3)))

            posts.append({
                "id": f"post_{shortcode}",
                "post_url": href,
                "media_url": rp.get("src"),
                "media_type": "reel" if rp.get("isReel") else "image",
                "caption": caption_clean,
                "hashtags": hashtags[:5],
                "posted_at": datetime.now(timezone.utc).isoformat(),
                "perf_score": perf_score,
                "likes": likes,
                "comments": comments,
                "reach": reach,
                "is_real_metrics": False,
                "sentiment": 0.5,
                "topics": [hashtags[0]]
            })

        account_info = {
            "handle": handle,
            "platform": "instagram",
            "followers": followers,
            "following": following,
            "media_count": max(media_count, len(posts)),
            "avatar_url": data.get("avatar"),
            "bio": bio,
            "niche": "Creator",
            "niche_info": {
                "primary_niche": "Creator",
                "full_name": full_name
            }
        }

        return {
            "status": "success",
            "account": account_info,
            "posts": posts
        }
    except Exception as e:
        logger.warning(f"Error scraping {handle}: {e}")
        return {"status": "error", "error": str(e)}


async def worker(queue: asyncio.Queue, worker_id: int):
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            locale="en-US"
        )
        page = await context.new_page()

        while not queue.empty():
            handle = await queue.get()
            try:
                logger.info(f"[Worker {worker_id}] Scraping @{handle}...")
                res = await scrape_single_profile(page, handle)
                if res.get("status") == "success" and res.get("account"):
                    acc = res["account"]
                    posts = res.get("posts", [])
                    save_profile_and_posts(handle, acc, posts, acc.get("niche_info"))
                    logger.info(f"✓ [Worker {worker_id}] SAVED @{handle}: {acc['followers']:,} followers, {len(posts)} posts")
                else:
                    logger.warning(f"⚠ [Worker {worker_id}] Skipped @{handle}: {res.get('error')}")
            except Exception as e:
                logger.error(f"✗ [Worker {worker_id}] Error @{handle}: {e}")
            finally:
                queue.task_done()
                await asyncio.sleep(1.0)

        await browser.close()


async def main():
    handles = extract_handles()
    logger.info(f"Extracted {len(handles)} unique handles from prompt.")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT LOWER(handle) FROM scraped_profiles")
        existing = {row[0] for row in cursor.fetchall()}

    to_scrape = [h for h in handles if h.lower() not in existing]
    logger.info(f"Already in database: {len(existing)} profiles.")
    logger.info(f"Profiles to scrape: {len(to_scrape)}")

    queue = asyncio.Queue()
    for h in to_scrape:
        queue.put_nowait(h)

    num_workers = 3
    tasks = [asyncio.create_task(worker(queue, i + 1)) for i in range(num_workers)]
    await queue.join()
    for t in tasks:
        t.cancel()

    logger.info("Batch ingestion finished successfully!")


if __name__ == "__main__":
    asyncio.run(main())
