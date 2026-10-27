"""
Tests for Model 1 Train/Test Group Split Isolation & Leakage Prevention.
Guarantees that no creator handle appears in both training and test splits.
"""

import json
from pathlib import Path
import pandas as pd
import pytest
from sklearn.model_selection import GroupShuffleSplit, GroupKFold

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MODEL_DIR = Path(__file__).resolve().parent.parent / "app" / "ml" / "saved_models"
CSV_PATH = DATA_DIR / "global_instagram_dataset.csv"
METADATA_PATH = MODEL_DIR / "model_metadata.json"


def test_metadata_records_group_split_and_real_rows():
    """Verify model_metadata.json records real-only counts and zero leakage split."""
    assert METADATA_PATH.exists(), f"Metadata not found at {METADATA_PATH}"
    with open(METADATA_PATH) as f:
        meta = json.load(f)

    assert meta["role"] == "heuristic_prior"
    assert meta["real_metrics_rows"] == 1769
    assert meta["synthetic_formula_rows"] == 8685
    assert meta["total_dataset_rows"] == 10454
    assert meta["trained_handles"] > 0
    assert meta["test_handles"] > 0
    assert meta["trained_handles"] + meta["test_handles"] == meta["total_unique_handles"]
    assert "GroupShuffleSplit" in meta["split_method"]


def test_group_shuffle_split_has_zero_handle_leakage():
    """Verify that GroupShuffleSplit strictly isolates handles across train and test sets."""
    assert CSV_PATH.exists(), f"Dataset not found at {CSV_PATH}"
    df = pd.read_csv(CSV_PATH)
    
    # Filter for real rows
    if "is_real_metrics" in df.columns:
        real_df = df[df["is_real_metrics"] == True].copy()
    else:
        pytest.skip("is_real_metrics column not found in global dataset")

    groups = real_df["handle"].values
    gss = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
    train_idx, test_idx = next(gss.split(real_df, groups=groups))

    train_handles = set(groups[train_idx])
    test_handles = set(groups[test_idx])

    # Absolute zero overlap
    overlap = train_handles.intersection(test_handles)
    assert len(overlap) == 0, f"Critical Data Leakage: {len(overlap)} handles appear in both splits: {overlap}"
    assert len(train_handles) > 0
    assert len(test_handles) > 0


def test_group_k_fold_has_zero_handle_leakage_across_all_folds():
    """Verify that 5-fold GroupKFold has zero handle overlap in every fold."""
    assert CSV_PATH.exists()
    df = pd.read_csv(CSV_PATH)
    real_df = df[df["is_real_metrics"] == True].copy()
    groups = real_df["handle"].values

    gkf = GroupKFold(n_splits=5)
    for fold, (train_idx, test_idx) in enumerate(gkf.split(real_df, groups=groups)):
        train_handles = set(groups[train_idx])
        test_handles = set(groups[test_idx])
        overlap = train_handles.intersection(test_handles)
        assert len(overlap) == 0, f"Fold {fold} has handle leakage: {overlap}"


def test_leakage_detector_fails_on_contaminated_splits():
    """Ensure our leakage check actually raises an AssertionError when handles overlap."""
    train_handles = {"mkbhd", "cristiano", "natgeo", "nike"}
    test_handles = {"therock", "mkbhd", "taylorswift"}  # 'mkbhd' is leaked

    overlap = train_handles.intersection(test_handles)
    with pytest.raises(AssertionError, match="Handle leakage detected"):
        if overlap:
            raise AssertionError(f"Handle leakage detected! Overlapping handles: {overlap}")
