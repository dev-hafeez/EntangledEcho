"""
Model 1: Global Instagram Engagement Predictor Training Pipeline
Trains a Gradient Boosting Regressor on multi-niche platform dynamics.
Saves model to: services/ai/app/ml/saved_models/global_engagement_model.joblib
"""

import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

from app.ml.features import FEATURE_COLUMNS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CURRENT_DIR = Path(__file__).resolve().parent
DATASET_PATH = CURRENT_DIR.parent.parent / "data" / "global_instagram_dataset.csv"
MODEL_DIR = CURRENT_DIR / "saved_models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODEL_DIR / "global_engagement_model.joblib"
METADATA_PATH = MODEL_DIR / "model_metadata.json"


def train_global_model(dataset_path: Path = DATASET_PATH) -> dict:
    if not dataset_path.exists():
        raise FileNotFoundError(f"Training dataset not found at {dataset_path}")

    logger.info(f"Loading global training dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)
    logger.info(f"Loaded {len(df)} samples across {df['handle'].nunique()} creator categories.")

    # Validate feature columns exist
    missing_cols = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Dataset missing required feature columns: {missing_cols}")

    X = df[FEATURE_COLUMNS].copy()
    y_raw = df["engagement_rate"].values

    # Apply log1p transform to target for stable variance across wide engagement spreads
    y_log = np.log1p(np.maximum(0, y_raw))

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_log, test_size=0.20, random_state=42
    )
    logger.info(f"Training split: {len(X_train)} train, {len(X_test)} test.")

    # Train HistGradientBoostingRegressor (fast, high capacity, handles non-linearities)
    regressor = HistGradientBoostingRegressor(
        max_iter=150,
        learning_rate=0.08,
        max_depth=6,
        min_samples_leaf=20,
        l2_regularization=0.1,
        random_state=42
    )

    logger.info("Fitting Gradient Boosting Regressor...")
    regressor.fit(X_train, y_train)

    # Evaluate on test set
    y_pred_log = regressor.predict(X_test)
    y_pred = np.expm1(y_pred_log)
    y_test_raw = np.expm1(y_test)

    r2 = float(r2_score(y_test, y_pred_log))
    mae = float(mean_absolute_error(y_test_raw, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test_raw, y_pred)))

    logger.info(f"Test Set Evaluation:")
    logger.info(f"  R^2 Score: {r2:.4f}")
    logger.info(f"  MAE (Engagement %): {mae:.3f}%")
    logger.info(f"  RMSE: {rmse:.3f}")

    # Feature Importance analysis (using permutation importance approximation or leaf splits)
    # Train a fast random forest to extract exact normalized feature importance percentages
    from sklearn.ensemble import ExtraTreesRegressor
    et = ExtraTreesRegressor(n_estimators=50, max_depth=8, random_state=42)
    et.fit(X_train, y_train)
    importances = dict(zip(FEATURE_COLUMNS, [round(float(v), 4) for v in et.feature_importances_]))
    sorted_importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))

    logger.info("Top Feature Importances:")
    for feat, imp in list(sorted_importances.items())[:6]:
        logger.info(f"  - {feat}: {imp * 100:.1f}%")

    # Save model artifact
    model_payload = {
        "model": regressor,
        "feature_columns": FEATURE_COLUMNS,
        "target_transform": "log1p",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "r2_score": r2,
            "mae": mae,
            "rmse": rmse
        },
        "feature_importances": sorted_importances
    }

    joblib.dump(model_payload, MODEL_PATH)
    logger.info(f"Global model saved to {MODEL_PATH}")

    # Save metadata JSON for inspections and BFF endpoints
    metadata = {
        "model_name": "Global Instagram Engagement Predictor",
        "algorithm": "HistGradientBoostingRegressor",
        "trained_samples": len(X_train),
        "test_samples": len(X_test),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "r2_score": round(r2, 4),
            "mae_percentage": round(mae, 3),
            "rmse": round(rmse, 3)
        },
        "feature_importances": sorted_importances
    }
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    return metadata


if __name__ == "__main__":
    train_global_model()
