"""
Performance Score Engine (FR-16 & SRDS Section 6.2)

Calculates engagement performance scores from raw post metrics with
configurable weightings, null safety, and intra-account percentile normalization.
"""

from typing import Dict, Any, List, Optional
import numpy as np
from app.config import settings


def compute_post_engagement(
    post: Dict[str, Any],
    w_likes: Optional[float] = None,
    w_comments: Optional[float] = None,
    w_shares: Optional[float] = None,
    w_saves: Optional[float] = None
) -> float:
    """
    Computes weighted engagement score:
    engagement = likes*w_l + comments*w_c + shares*w_sh + saves*w_sv
    """
    wl = w_likes if w_likes is not None else settings.weight_likes
    wc = w_comments if w_comments is not None else settings.weight_comments
    wsh = w_shares if w_shares is not None else settings.weight_shares
    wsv = w_saves if w_saves is not None else settings.weight_saves

    likes = float(post.get("likes") or 0)
    comments = float(post.get("comments") or 0)
    shares = float(post.get("shares") or 0)
    saves = float(post.get("saves") or 0)

    return likes * wl + comments * wc + shares * wsh + saves * wsv


def compute_raw_performance_score(
    post: Dict[str, Any],
    account_followers: int = 1000
) -> float:
    """
    Calculates raw performance ratio:
    perf_score_raw = engagement / max(reach, 1)
    Falls back to followers at post time if reach is 0 or absent.
    """
    engagement = compute_post_engagement(post)
    reach = float(post.get("reach") or 0)
    denominator = reach if reach > 0 else max(float(account_followers or 1000), 1.0)
    return engagement / denominator


def normalize_account_performance_scores(
    posts: List[Dict[str, Any]],
    account_followers: int = 1000
) -> List[Dict[str, Any]]:
    """
    Computes raw performance scores and percentile-normalizes them within the account (0.0 to 1.0)
    so scores are comparable across accounts and platforms regardless of absolute follower count.
    """
    if not posts:
        return []

    raw_scores = []
    for p in posts:
        raw = compute_raw_performance_score(p, account_followers)
        raw_scores.append(raw)

    n = len(raw_scores)
    if n == 1:
        posts[0]["perf_score"] = 0.5
        return posts

    # Percentile ranking (0.05 to 1.0)
    ranks = np.argsort(np.argsort(raw_scores))
    normalized = (ranks / (n - 1)).clip(0.05, 1.0)

    for i, p in enumerate(posts):
        p["perf_score"] = float(round(normalized[i], 4))
        p["perf_score_raw"] = float(round(raw_scores[i], 6))

    return posts
