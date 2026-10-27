"""
Content Analyzer (FR-13..15, SRDS Section 5.6.2 Algorithm 2)

Performs:
1. TF-IDF keyword and topic extraction from captions.
2. VADER sentiment polarity classification.
3. Hashtag co-occurrence analysis and cluster grouping.
4. Historical performance profiling across formats and time windows.
"""

import re
from typing import Dict, Any, List, Tuple
from collections import Counter, defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

vader = SentimentIntensityAnalyzer()


def clean_caption_for_nlp(text: str) -> str:
    """Strips URLs, user mentions, hashtags, and non-alphanumeric noise."""
    if not text:
        return ""
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'@[A-Za-z0-9_.]+', '', text)
    text = re.sub(r'#[A-Za-z0-9_]+', '', text)
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    return text.strip().lower()


def analyze_caption_sentiment(text: str) -> Dict[str, float]:
    """Analyzes text with VADER and returns compound and polarity scores."""
    if not text:
        return {"compound": 0.0, "pos": 0.0, "neu": 1.0, "neg": 0.0}
    scores = vader.polarity_scores(text)
    return scores


def extract_tfidf_topics(
    captions: List[str],
    top_n: int = 10
) -> List[Tuple[str, float]]:
    """
    Extracts top terms and bigrams across posts using TF-IDF.
    """
    cleaned = [clean_caption_for_nlp(c) for c in captions if c and len(c.strip()) > 3]
    if not cleaned or len(cleaned) < 2:
        # Fallback word count if insufficient documents for TF-IDF
        words = []
        for c in cleaned:
            words.extend([w for w in c.split() if len(w) > 3])
        counts = Counter(words).most_common(top_n)
        return [(w, float(c)) for w, c in counts]

    try:
        vec = TfidfVectorizer(
            stop_words="english",
            max_features=top_n * 2,
            ngram_range=(1, 2),
            token_pattern=r'(?u)\b[a-zA-Z]{3,}\b'
        )
        matrix = vec.fit_transform(cleaned)
        scores = matrix.mean(axis=0).A1
        vocab = vec.get_feature_names_out()
        ranked = sorted(zip(vocab, scores), key=lambda x: x[1], reverse=True)
        return [(word, round(float(score), 4)) for word, score in ranked[:top_n]]
    except Exception:
        return []


def extract_hashtag_clusters(
    posts: List[Dict[str, Any]],
    min_co_occurrence: int = 1
) -> List[Dict[str, Any]]:
    """
    Builds a co-occurrence graph of hashtags used together in the same posts,
    grouping them into coherent topical clusters.
    """
    co_occurrences = defaultdict(Counter)
    hashtag_freq = Counter()

    for p in posts:
        tags = p.get("hashtags") or []
        if isinstance(tags, str):
            try:
                import json
                tags = json.loads(tags)
            except Exception:
                tags = [t.strip() for t in tags.split(",") if t.strip()]

        clean_tags = [t.lower().strip() if t.startswith("#") else f"#{t.lower().strip()}" for t in tags if t]
        clean_tags = list(set(clean_tags))

        for t in clean_tags:
            hashtag_freq[t] += 1

        for i in range(len(clean_tags)):
            for j in range(i + 1, len(clean_tags)):
                t1, t2 = clean_tags[i], clean_tags[j]
                co_occurrences[t1][t2] += 1
                co_occurrences[t2][t1] += 1

    # Form clusters from top seeds
    clusters = []
    visited = set()
    top_tags = [t for t, _ in hashtag_freq.most_common(20)]

    for seed in top_tags:
        if seed in visited:
            continue
        cluster = [seed]
        visited.add(seed)

        # Find strongly linked partners
        for partner, count in co_occurrences[seed].most_common(5):
            if count >= min_co_occurrence and partner not in visited:
                cluster.append(partner)
                visited.add(partner)

        if len(cluster) >= 2:
            clusters.append({
                "theme_seed": seed,
                "hashtags": cluster,
                "total_usage": sum(hashtag_freq[t] for t in cluster)
            })

    # If no clusters found due to few posts, group top hashtags
    if not clusters and top_tags:
        clusters.append({
            "theme_seed": top_tags[0],
            "hashtags": top_tags[:6],
            "total_usage": sum(hashtag_freq[t] for t in top_tags[:6])
        })

    return clusters


def run_full_content_analysis(
    account: Dict[str, Any],
    posts: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Comprehensive content analysis pipeline returning topics, sentiments,
    hashtag clusters, and media type statistics.
    """
    captions = [p.get("caption", "") for p in posts]
    top_topics = extract_tfidf_topics(captions, top_n=10)
    hashtag_clusters = extract_hashtag_clusters(posts)

    # Calculate average sentiment
    sentiments = [analyze_caption_sentiment(c) for c in captions]
    mean_compound = float(np.mean([s["compound"] for s in sentiments])) if sentiments else 0.0

    # Format performance
    format_stats = defaultdict(lambda: {"count": 0, "total_score": 0.0})
    for p in posts:
        mtype = (p.get("media_type") or "IMAGE").upper()
        score = float(p.get("perf_score") or 0.5)
        format_stats[mtype]["count"] += 1
        format_stats[mtype]["total_score"] += score

    ranked_formats = []
    for mtype, data in format_stats.items():
        avg = data["total_score"] / data["count"] if data["count"] > 0 else 0.5
        ranked_formats.append({
            "media_type": mtype,
            "count": data["count"],
            "mean_performance": round(avg, 3)
        })
    ranked_formats.sort(key=lambda x: x["mean_performance"], reverse=True)

    return {
        "status": "success",
        "handle": account.get("handle"),
        "posts_analyzed": len(posts),
        "top_topics": top_topics,
        "hashtag_clusters": hashtag_clusters,
        "sentiment_profile": {
            "mean_compound": round(mean_compound, 3),
            "label": "Positive" if mean_compound > 0.1 else ("Negative" if mean_compound < -0.1 else "Neutral")
        },
        "ranked_formats": ranked_formats
    }
