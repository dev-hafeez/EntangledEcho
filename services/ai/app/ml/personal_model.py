"""
Model 2: Personal Creator Fingerprint & Adaptive Bayesian Recommender
Learns from the creator's scraped posts and blends personal performance with Model 1.
"""

import math
from datetime import datetime
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from app.ml.features import (
    extract_features,
    compute_engagement_rate,
    parse_timestamp,
    analyzer
)


class CreatorPersonalModel:
    def __init__(self, handle: str, followers: int, posts: List[Dict[str, Any]], shrinkage_k: float = 5.0):
        self.handle = handle
        self.followers = max(1, followers)
        self.posts = posts or []
        self.shrinkage_k = shrinkage_k
        self.sample_size = len(self.posts)

        # Personal distributions
        self.mean_engagement_rate = 0.0
        self.format_performance: Dict[str, float] = {}
        self.hourly_performance: Dict[int, float] = {}
        self.day_performance: Dict[int, float] = {}
        self.top_keywords: List[str] = []
        self.top_hashtags: List[str] = []
        self.avg_sentiment: float = 0.0
        self.real_timestamps_count: int = 0
        self.timing_status: str = "insufficient_data"
        self.timing_message: str = "Based on macro platform prior (insufficient verified creator timestamps)"

        # Fit personal model on historical posts
        self._fit()

    def _fit(self):
        if not self.posts:
            # Fallback to general default expectations
            self.mean_engagement_rate = 3.5
            self.format_performance = {"reel": 4.5, "carousel": 3.8, "image": 2.5}
            self.timing_status = "insufficient_data"
            self.timing_message = "No posts available (macro platform prior active)"
            return

        rates = []
        format_groups: Dict[str, List[float]] = {"image": [], "reel": [], "carousel": []}
        hour_groups: Dict[int, List[float]] = {}
        day_groups: Dict[int, List[float]] = {}
        captions = []
        all_tags = []
        sentiments = []

        # Count verified real timestamps
        real_posts = [p for p in self.posts if p.get("posted_at_is_real")]
        self.real_timestamps_count = len(real_posts)

        for p in self.posts:
            likes = p.get("likes", 0)
            comments = p.get("comments", 0)
            rate = compute_engagement_rate(likes, comments, self.followers)
            rates.append(rate)

            # Format breakdown
            m_type = (p.get("media_type") or "image").lower()
            if m_type in format_groups:
                format_groups[m_type].append(rate)
            else:
                format_groups["image"].append(rate)

            # Timing breakdown - ONLY include if posted_at_is_real is True
            # to strictly prevent crawler execution timestamps from masquerading as creator posting habits
            if p.get("posted_at_is_real"):
                dt = parse_timestamp(p.get("posted_at"))
                hour = dt.hour
                day = dt.weekday()
                hour_groups.setdefault(hour, []).append(rate)
                day_groups.setdefault(day, []).append(rate)

            # Caption NLP
            cap = p.get("caption") or ""
            if cap:
                captions.append(cap)
                sent = analyzer.polarity_scores(cap)
                sentiments.append(sent["compound"])

            # Hashtags
            tags = p.get("hashtags") or []
            all_tags.extend(tags)

        self.mean_engagement_rate = float(np.mean(rates)) if rates else 3.5

        # Format performance averages
        for fmt, values in format_groups.items():
            if values:
                self.format_performance[fmt] = round(float(np.mean(values)), 3)
            else:
                self.format_performance[fmt] = self.mean_engagement_rate

        # Hourly & Day performance with fallback to macro priors if insufficient data (< 3 real timestamps)
        if self.real_timestamps_count >= 3:
            self.timing_status = "verified"
            self.timing_message = f"Based on {self.real_timestamps_count} verified publish timestamps"
            for h, values in hour_groups.items():
                self.hourly_performance[h] = round(float(np.mean(values)), 3)
            for d, values in day_groups.items():
                self.day_performance[d] = round(float(np.mean(values)), 3)
        else:
            self.timing_status = "insufficient_data"
            self.timing_message = (
                f"Based on macro platform prior ({self.real_timestamps_count} verified timestamps; "
                "insufficient data for personal timing model)"
            )
            # Neutral macro platform distribution prior
            base = self.mean_engagement_rate
            for h in range(24):
                if 17 <= h <= 21:
                    self.hourly_performance[h] = round(base * 1.15, 3)
                elif 11 <= h <= 14:
                    self.hourly_performance[h] = round(base * 1.05, 3)
                elif 1 <= h <= 6:
                    self.hourly_performance[h] = round(base * 0.70, 3)
                else:
                    self.hourly_performance[h] = round(base, 3)

            for d in range(7):
                self.day_performance[d] = round(base, 3)

        # Average sentiment
        self.avg_sentiment = float(np.mean(sentiments)) if sentiments else 0.0

        # Top Hashtags
        if all_tags:
            from collections import Counter
            counts = Counter(all_tags)
            self.top_hashtags = [tag for tag, _ in counts.most_common(5)]

        # TF-IDF Vocabulary Extraction
        if captions:
            try:
                tfidf = TfidfVectorizer(max_features=10, stop_words="english", ngram_range=(1, 2))
                tfidf.fit(captions)
                self.top_keywords = list(tfidf.get_feature_names_out())
            except Exception:
                # If too short or single post
                words = " ".join(captions).split()
                clean = [w.strip("#.,!?\"'()").lower() for w in words if len(w) > 3]
                self.top_keywords = list(dict.fromkeys(clean))[:6]

    def predict_personal_score(self, media_type: str, hour: int, day: int) -> float:
        """
        Computes the expected personal engagement rate for a candidate format and time.
        """
        base = self.mean_engagement_rate
        fmt_score = self.format_performance.get(media_type.lower(), base)
        hour_score = self.hourly_performance.get(hour, base)
        day_score = self.day_performance.get(day, base)

        # Combine personal components
        personal_estimate = (fmt_score * 0.5) + (hour_score * 0.3) + (day_score * 0.2)
        return round(float(personal_estimate), 3)

    def blend_with_global(self, personal_pred: float, global_pred: float) -> Dict[str, Any]:
        """
        Applies Empirical Bayes Shrinkage:
        alpha = n / (n + k)
        blended = alpha * personal + (1 - alpha) * global
        """
        n = float(self.sample_size)
        alpha = n / (n + self.shrinkage_k)

        blended = (alpha * personal_pred) + ((1.0 - alpha) * global_pred)
        blended = max(0.1, round(float(blended), 3))

        # Expected reach calculated from followers and predicted engagement
        predicted_reach = int(self.followers * (blended / 100.0) * 12.0)
        predicted_reach = max(predicted_reach, int(self.followers * 0.25))

        return {
            "predicted_engagement_rate": blended,
            "predicted_reach": predicted_reach,
            "personal_weight_alpha": round(alpha, 3),
            "global_weight": round(1.0 - alpha, 3),
            "personal_baseline": personal_pred,
            "global_prediction": global_pred,
            "posts_trained_on": self.sample_size
        }

    def get_profile_summary(self) -> Dict[str, Any]:
        """Returns structured insights about the creator's personal profile."""
        best_format = "image"
        if self.format_performance:
            best_format = max(self.format_performance, key=self.format_performance.get)

        best_hour = 19
        if self.hourly_performance:
            best_hour = max(self.hourly_performance, key=self.hourly_performance.get)

        return {
            "handle": self.handle,
            "followers": self.followers,
            "analyzed_posts": self.sample_size,
            "mean_engagement_rate": round(self.mean_engagement_rate, 2),
            "best_performing_format": best_format,
            "best_historical_hour": best_hour,
            "format_breakdown": self.format_performance,
            "top_keywords": self.top_keywords,
            "top_hashtags": self.top_hashtags,
            "average_sentiment": round(self.avg_sentiment, 2),
            "real_timestamps_count": self.real_timestamps_count,
            "timing_status": self.timing_status,
            "timing_message": self.timing_message
        }
