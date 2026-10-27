"""
Model 1: Global Instagram Engagement Heuristic Prior Training Pipeline
Trains on real parsed creator metrics using GroupShuffleSplit by handle (zero creator leakage).
Reports performance alongside trivial baselines (predict-mean, predict-median, followers-only linear).
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
from sklearn.model_selection import GroupShuffleSplit
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import HistGradientBoostingRegressor, ExtraTreesRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

from app.ml.features import FEATURE_COLUMNS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CURRENT_DIR = Path(__file__).resolve().parent
DATA_DIR = CURRENT_DIR.parent.parent / "data"
DATASET_PATH = DATA_DIR / "global_instagram_dataset.csv"
REAL_DATASET_PATH = DATA_DIR / "real_instagram_dataset.csv"
MODEL_DIR = CURRENT_DIR / "saved_models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODEL_DIR / "global_engagement_model.joblib"
METADATA_PATH = MODEL_DIR / "model_metadata.json"


def train_global_model(dataset_path: Path = DATASET_PATH) -> dict:
    if not dataset_path.exists():
        raise FileNotFoundError(f"Training dataset not found at {dataset_path}")

    logger.info(f"Loading dataset from {dataset_path}...")
    full_df = pd.read_csv(dataset_path)
    total_rows = len(full_df)

    # Filter strictly for real parsed metrics
    if "is_real_metrics" in full_df.columns:
        df = full_df[full_df["is_real_metrics"] == True].copy()
    elif REAL_DATASET_PATH.exists():
        df = pd.read_csv(REAL_DATASET_PATH)
    else:
        raise ValueError("No is_real_metrics column or real_instagram_dataset.csv found.")

    real_rows = len(df)
    synthetic_rows = total_rows - real_rows
    logger.info(
        f"Dataset composition: {total_rows} total rows, {real_rows} real rows ({real_rows/total_rows*100:.1f}%), "
        f"{synthetic_rows} synthetic formula rows ({synthetic_rows/total_rows*100:.1f}%)."
    )
    logger.info(f"Training strictly on {real_rows} real parsed samples across {df['handle'].nunique()} unique creator handles.")

    # Validate feature columns exist
    missing_cols = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Dataset missing required feature columns: {missing_cols}")

    X = df[FEATURE_COLUMNS].copy()
    
    # TARGET DEFINITION: Purely real fields without synthetic reach:
    # engagement_rate = ((likes + comments) / followers) * 100 (% of followers engaged)
    y_raw = ((df["likes"] + df["comments"]) / df["followers"]).values * 100.0
    groups = df["handle"].values

    # GROUP SPLIT BY HANDLE (GroupShuffleSplit 80% train / 20% test)
    # Guarantees zero handle overlap between train and test
    gss = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
    train_idx, test_idx = next(gss.split(X, y_raw, groups=groups))

    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y_raw[train_idx], y_raw[test_idx]
    train_handles = set(groups[train_idx])
    test_handles = set(groups[test_idx])

    # Assert zero handle leakage
    overlap = train_handles.intersection(test_handles)
    if overlap:
        raise AssertionError(f"Critical Data Leakage: {len(overlap)} handles appear in both train and test splits!")
    logger.info(
        f"Group split verified: {len(train_handles)} train handles ({len(X_train)} samples), "
        f"{len(test_handles)} test handles ({len(X_test)} samples), 0 overlapping handles."
    )

    # -------------------------------------------------------------
    # BASELINE 1: Predict Train Mean
    # -------------------------------------------------------------
    pred_mean = np.full_like(y_test, fill_value=np.mean(y_train))
    r2_mean = float(r2_score(y_test, pred_mean))
    mae_mean = float(mean_absolute_error(y_test, pred_mean))
    rmse_mean = float(np.sqrt(mean_squared_error(y_test, pred_mean)))

    # -------------------------------------------------------------
    # BASELINE 2: Predict Train Median
    # -------------------------------------------------------------
    pred_med = np.full_like(y_test, fill_value=np.median(y_train))
    r2_med = float(r2_score(y_test, pred_med))
    mae_med = float(mean_absolute_error(y_test, pred_med))
    rmse_med = float(np.sqrt(mean_squared_error(y_test, pred_med)))

    # -------------------------------------------------------------
    # BASELINE 3: Followers-only Linear Model
    # -------------------------------------------------------------
    lr = LinearRegression()
    lr.fit(X_train[["log_followers"]], y_train)
    pred_lr = lr.predict(X_test[["log_followers"]])
    r2_lr = float(r2_score(y_test, pred_lr))
    mae_lr = float(mean_absolute_error(y_test, pred_lr))
    rmse_lr = float(np.sqrt(mean_squared_error(y_test, pred_lr)))

    # -------------------------------------------------------------
    # MODEL 1: HistGradientBoostingRegressor (with log1p target transform)
    # -------------------------------------------------------------
    y_train_log = np.log1p(np.maximum(0, y_train))
    y_test_log = np.log1p(np.maximum(0, y_test))

    regressor = HistGradientBoostingRegressor(
        max_iter=100,
        learning_rate=0.05,
        max_depth=5,
        min_samples_leaf=20,
        l2_regularization=0.1,
        random_state=42
    )

    logger.info("Fitting Gradient Boosting Regressor...")
    regressor.fit(X_train, y_train_log)

    y_pred_log = regressor.predict(X_test)
    y_pred_raw = np.expm1(y_pred_log)

    r2_raw = float(r2_score(y_test, y_pred_raw))
    mae_raw = float(mean_absolute_error(y_test, y_pred_raw))
    rmse_raw = float(np.sqrt(mean_squared_error(y_test, y_pred_raw)))

    r2_log = float(r2_score(y_test_log, y_pred_log))
    mae_log = float(mean_absolute_error(y_test_log, y_pred_log))
    rmse_log = float(np.sqrt(mean_squared_error(y_test_log, y_pred_log)))

    logger.info("=== HELD-OUT HANDLES EVALUATION (RAW TARGET: ENGAGEMENT %) ===")
    logger.info(f"  Predict-Mean Baseline:   R2 = {r2_mean:8.4f}, MAE = {mae_mean:7.3f}%, RMSE = {rmse_mean:7.3f}")
    logger.info(f"  Predict-Median Baseline: R2 = {r2_med:8.4f}, MAE = {mae_med:7.3f}%, RMSE = {rmse_med:7.3f}")
    logger.info(f"  Followers Linear Model:  R2 = {r2_lr:8.4f}, MAE = {mae_lr:7.3f}%, RMSE = {rmse_lr:7.3f}")
    logger.info(f"  Model 1 (HGBR):          R2 = {r2_raw:8.4f}, MAE = {mae_raw:7.3f}%, RMSE = {rmse_raw:7.3f}")
    logger.info(f"  Model 1 (in log space):  R2 = {r2_log:8.4f}, MAE = {mae_log:7.3f},  RMSE = {rmse_log:7.3f}")

    # Feature importances via ExtraTrees
    et = ExtraTreesRegressor(n_estimators=50, max_depth=6, random_state=42)
    et.fit(X_train, y_train_log)
    importances = dict(zip(FEATURE_COLUMNS, [round(float(v), 4) for v in et.feature_importances_]))
    sorted_importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))

    # Save model artifact
    model_payload = {
        "model": regressor,
        "feature_columns": FEATURE_COLUMNS,
        "target_transform": "log1p",
        "target_definition": "((likes + comments) / followers) * 100",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "is_heuristic_prior": True,
        "metrics_raw": {
            "r2_score": r2_raw,
            "mae": mae_raw,
            "rmse": rmse_raw
        },
        "metrics_log": {
            "r2_score": r2_log,
            "mae": mae_log,
            "rmse": rmse_log
        },
        "feature_importances": sorted_importances
    }
    joblib.dump(model_payload, MODEL_PATH)
    logger.info(f"Global model saved to {MODEL_PATH}")

    # Honest labeling: Does the model beat baselines?
    beats_median = mae_raw < mae_med
    model_classification = (
        "Heuristic Baseline Prior (relabeled from predictive model: "
        f"explains only {max(0.0, r2_raw)*100:.1f}% raw variance on held-out creators; "
        "retained as Bayesian prior for creator cold-start slots)"
    )

    metadata = {
        "model_name": "Global Instagram Engagement Prior",
        "role": "heuristic_prior",
        "description": model_classification,
        "algorithm": "HistGradientBoostingRegressor",
        "total_dataset_rows": total_rows,
        "real_metrics_rows": real_rows,
        "synthetic_formula_rows": synthetic_rows,
        "total_unique_handles": int(df["handle"].nunique()),
        "trained_handles": len(train_handles),
        "test_handles": len(test_handles),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "split_method": "GroupShuffleSplit (grouped by handle, 0% handle overlap)",
        "target_definition": "((likes + comments) / followers) * 100 (percentage of followers engaged, calculated purely from real fields)",
        "evaluation_held_out_handles": {
            "predict_mean_baseline": {
                "r2_score": round(r2_mean, 4),
                "mae_percentage": round(mae_mean, 3),
                "rmse": round(rmse_mean, 3)
            },
            "predict_median_baseline": {
                "r2_score": round(r2_med, 4),
                "mae_percentage": round(mae_med, 3),
                "rmse": round(rmse_med, 3)
            },
            "followers_only_linear_model": {
                "r2_score": round(r2_lr, 4),
                "mae_percentage": round(mae_lr, 3),
                "rmse": round(rmse_lr, 3)
            },
            "model_1_hgbr": {
                "r2_score_raw": round(r2_raw, 4),
                "mae_percentage_raw": round(mae_raw, 3),
                "rmse_raw": round(rmse_raw, 3),
                "r2_score_log": round(r2_log, 4),
                "mae_log": round(mae_log, 3),
                "rmse_log": round(rmse_log, 3)
            }
        },
        "feature_importances": sorted_importances,
        "trained_at": datetime.now(timezone.utc).isoformat()
    }

    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Metadata saved to {METADATA_PATH}")
    return metadata


if __name__ == "__main__":
    train_global_model()
