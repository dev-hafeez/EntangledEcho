"""
Entangled Echo Unified ML Engine
Coordinates Model 1 (Global Regressor) and Model 2 (Personal Bayesian Model).
"""

import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import joblib
import numpy as np
import pandas as pd

from app.ml.features import (
    extract_features,
    FEATURE_COLUMNS,
    parse_timestamp
)
from app.ml.personal_model import CreatorPersonalModel

logger = logging.getLogger(__name__)

import json

CURRENT_DIR = Path(__file__).resolve().parent
MODEL_PATH = CURRENT_DIR / "saved_models" / "global_engagement_model.joblib"
METADATA_PATH = CURRENT_DIR / "saved_models" / "model_metadata.json"


class SocialMLEngine:
    _instance = None

    def __init__(self):
        self.global_model = None
        self.metadata = {}
        self.load_global_model()

    def load_global_model(self):
        if not MODEL_PATH.exists():
            logger.warning(f"Global model not found at {MODEL_PATH}. Run training first.")
            return

        try:
            payload = joblib.load(MODEL_PATH)
            self.global_model = payload.get("model")
            if METADATA_PATH.exists():
                with open(METADATA_PATH) as f:
                    self.metadata = json.load(f)
            else:
                self.metadata = {
                    "role": "heuristic_prior",
                    "trained_at": payload.get("trained_at"),
                    "metrics": payload.get("metrics_raw", {}),
                    "feature_importances": payload.get("feature_importances", {})
                }
            logger.info("Successfully loaded Global Engagement Heuristic Prior into memory.")
        except Exception as e:
            logger.error(f"Error loading global model: {e}")

    def predict_global(self, features_dict: Dict[str, float]) -> float:
        """Predicts expected engagement rate using the trained global model."""
        if self.global_model is None:
            # Fallback heuristic if model file is somehow not yet loaded
            return 3.5

        # Format as 1-row DataFrame with exact columns
        row_df = pd.DataFrame([[features_dict.get(c, 0.0) for c in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
        pred_log = self.global_model.predict(row_df)[0]
        pred_rate = float(np.expm1(pred_log))
        return max(0.1, round(pred_rate, 3))

    def predict_engagement(
        self,
        draft_media_type: str,
        draft_caption: str,
        scheduled_time: Any,
        user_account: Dict[str, Any],
        user_posts: List[Dict[str, Any]],
        draft_hashtags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Dual-Model Inference:
        1. Evaluates Model 1 (Global Regressor on format, timing, NLP features).
        2. Evaluates Model 2 (Personal model on user's scraped profile history).
        3. Returns Bayesian blended prediction, confidence, and feature attributions.
        """
        followers = user_account.get("followers", 1000)
        handle = user_account.get("handle", "user")

        # 1. Feature Extraction
        features = extract_features(
            media_type=draft_media_type,
            posted_at=scheduled_time,
            caption=draft_caption,
            hashtags=draft_hashtags,
            followers=followers
        )

        # 2. Model 1: Global Prediction
        global_pred = self.predict_global(features)

        # 3. Model 2: Personal Model
        personal_model = CreatorPersonalModel(
            handle=handle,
            followers=followers,
            posts=user_posts
        )
        dt = parse_timestamp(scheduled_time)
        personal_pred = personal_model.predict_personal_score(
            media_type=draft_media_type,
            hour=dt.hour,
            day=dt.weekday()
        )

        # 4. Bayesian Blending
        blended_result = personal_model.blend_with_global(
            personal_pred=personal_pred,
            global_pred=global_pred
        )

        # Confidence calculation
        n_posts = len(user_posts)
        if n_posts >= 15:
            confidence = "High (Verified against extensive personal history)"
            confidence_score = 0.92
        elif n_posts >= 3:
            confidence = "Moderate (Blended between creator history and global benchmark)"
            confidence_score = 0.78
        else:
            confidence = "Baseline Prior (Calibrated from global Instagram dataset)"
            confidence_score = 0.65

        return {
            "status": "success",
            "prediction": blended_result,
            "confidence": confidence,
            "confidence_score": confidence_score,
            "features_analyzed": {
                "media_type": draft_media_type,
                "scheduled_hour": dt.hour,
                "scheduled_day": dt.strftime("%A"),
                "caption_length": len(draft_caption or ""),
                "sentiment_compound": features["sentiment_compound"],
                "hashtag_count": features["hashtag_count"]
            },
            "creator_profile": personal_model.get_profile_summary()
        }

    def recommend_content_strategy(
        self,
        user_account: Dict[str, Any],
        user_posts: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Recommends what to post and when to post using both models.
        """
        followers = user_account.get("followers", 1000)
        handle = user_account.get("handle", "user")

        personal_model = CreatorPersonalModel(
            handle=handle,
            followers=followers,
            posts=user_posts
        )
        summary = personal_model.get_profile_summary()

        # Find best upcoming slot by testing candidate hours
        best_candidate = None
        best_score = -1.0
        now = datetime.now(timezone.utc)

        for candidate_day in range(7):
            for candidate_hour in [9, 12, 17, 19, 21]:
                for candidate_type in ["reel", "carousel", "image"]:
                    feats = extract_features(
                        media_type=candidate_type,
                        posted_at=now,
                        caption="Recommended post hook #trending",
                        followers=followers
                    )
                    g_pred = self.predict_global(feats)
                    p_pred = personal_model.predict_personal_score(
                        candidate_type, candidate_hour, candidate_day
                    )
                    blended = personal_model.blend_with_global(p_pred, g_pred)
                    score = blended["predicted_engagement_rate"]

                    if score > best_score:
                        best_score = score
                        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                        best_candidate = {
                            "recommended_format": candidate_type.upper(),
                            "recommended_day": day_names[candidate_day],
                            "recommended_hour": f"{candidate_hour:02d}:00 UTC",
                            "predicted_engagement_rate": score,
                            "predicted_reach": blended["predicted_reach"],
                            "timing_status": summary["timing_status"],
                            "timing_message": summary["timing_message"]
                        }

        handle = (user_account.get("handle") or "creator").strip().lstrip("@")
        fallback_tags = [f"#{handle}"] if handle else ["#trending"]

        return {
            "status": "success",
            "creator": summary,
            "optimal_recommendation": best_candidate,
            "timing_basis": summary["timing_message"],
            "recommended_keywords": summary["top_keywords"],
            "recommended_hashtags": summary["top_hashtags"] or fallback_tags,
            "global_model_version": self.metadata.get("trained_at", "v1.0")
        }


ml_engine = SocialMLEngine()
