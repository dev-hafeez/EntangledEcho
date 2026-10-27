import math
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()

FEATURE_COLUMNS = [
    "media_type_image",
    "media_type_reel",
    "media_type_carousel",
    "hour_sin",
    "hour_cos",
    "day_sin",
    "day_cos",
    "caption_length_chars",
    "caption_word_count",
    "hashtag_count",
    "sentiment_compound",
    "sentiment_pos",
    "sentiment_neg",
    "log_followers"
]


def extract_sentiment(text: str) -> Dict[str, float]:
    """Calculates VADER sentiment scores for a given text."""
    if not text:
        return {"compound": 0.0, "pos": 0.0, "neg": 0.0, "neu": 1.0}
    scores = analyzer.polarity_scores(text)
    return scores


def parse_timestamp(timestamp_val: Any) -> datetime:
    """Parses various timestamp representations into a valid datetime object."""
    if isinstance(timestamp_val, datetime):
        return timestamp_val
    if isinstance(timestamp_val, (int, float)):
        try:
            return datetime.fromtimestamp(timestamp_val)
        except Exception:
            return datetime.now()
    if isinstance(timestamp_val, str):
        # Attempt ISO parse
        try:
            return datetime.fromisoformat(timestamp_val.replace("Z", "+00:00"))
        except Exception:
            pass
        # Common Instagram formats
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(timestamp_val, fmt)
            except Exception:
                continue
    return datetime.now()


def extract_features(
    media_type: str,
    posted_at: Any,
    caption: str,
    hashtags: Optional[List[str]] = None,
    followers: int = 1000,
    posted_at_is_real: bool = True
) -> Dict[str, float]:
    """
    Extracts a normalized numerical feature vector from post attributes.
    If posted_at_is_real is False, cyclical hour/day features are zeroed out (center of unit circle)
    to prevent the model from learning from crawler execution timestamps.
    """
    media_type_norm = (media_type or "image").lower()

    if posted_at_is_real and posted_at:
        dt = parse_timestamp(posted_at)
        hour = dt.hour
        day = dt.weekday()  # 0 = Monday, 6 = Sunday

        # Cyclic hour encoding
        hour_rad = 2 * math.pi * hour / 24.0
        hour_sin = math.sin(hour_rad)
        hour_cos = math.cos(hour_rad)

        # Cyclic day encoding
        day_rad = 2 * math.pi * day / 7.0
        day_sin = math.sin(day_rad)
        day_cos = math.cos(day_rad)
    else:
        hour_sin = 0.0
        hour_cos = 0.0
        day_sin = 0.0
        day_cos = 0.0

    clean_caption = caption or ""
    caption_length_chars = float(len(clean_caption))
    caption_word_count = float(len(clean_caption.split()))

    if hashtags is None:
        found_tags = re.findall(r'#\w+', clean_caption)
        hashtag_count = float(len(found_tags))
    else:
        hashtag_count = float(len(hashtags))

    sent = extract_sentiment(clean_caption)

    safe_followers = max(1, followers)
    log_followers = math.log10(safe_followers + 1.0)

    return {
        "media_type_image": 1.0 if media_type_norm in ("image", "photo") else 0.0,
        "media_type_reel": 1.0 if media_type_norm in ("reel", "video") else 0.0,
        "media_type_carousel": 1.0 if media_type_norm in ("carousel", "album") else 0.0,
        "hour_sin": round(hour_sin, 4),
        "hour_cos": round(hour_cos, 4),
        "day_sin": round(day_sin, 4),
        "day_cos": round(day_cos, 4),
        "caption_length_chars": caption_length_chars,
        "caption_word_count": caption_word_count,
        "hashtag_count": hashtag_count,
        "sentiment_compound": round(sent.get("compound", 0.0), 4),
        "sentiment_pos": round(sent.get("pos", 0.0), 4),
        "sentiment_neg": round(sent.get("neg", 0.0), 4),
        "log_followers": round(log_followers, 4)
    }


def compute_engagement_rate(likes: int, comments: int, followers: int) -> float:
    """
    Computes industry-standard weighted engagement rate in percentage.
    Formula: ((likes * 1.0 + comments * 3.0) / max(followers, 10)) * 100
    """
    safe_followers = max(10, followers)
    weighted_score = (likes * 1.0) + (comments * 3.0)
    rate = (weighted_score / safe_followers) * 100.0
    return round(rate, 3)
