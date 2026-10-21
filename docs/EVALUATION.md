# Entangled Echo — Evaluation & Benchmark Results

This document tracks quantitative performance benchmarks, algorithmic validation, and Non-Functional Requirement (NFR) measurements.

## 1. NFR Targets & Status

| Requirement ID | Target Metric | Measured Value | Status | Notes |
|---|---|---|---|---|
| NFR 4.1.1 | Dashboard page load < 3s | Pending Phase 10 | ⏳ | BroadBand 10 Mbps baseline |
| NFR 4.1.2 | REST API CRUD p95 < 500ms (100 users) | Pending Phase 12 | ⏳ | Measured via k6 |
| NFR 4.1.3 | QUBO Schedule Optimization < 10s (30d horizon, 5 accounts) | Pending Phase 7 | ⏳ | Simulated Annealing benchmark |
| NFR 4.1.4 | AI Caption & Hashtag generation < 5s | Pending Phase 8 | ⏳ | LLM streaming / mock |
| NFR 4.1.5 | Scheduled post publishing within 60s window | Pending Phase 9 | ⏳ | Cron tick resolution |
| NFR 4.1.6 | Analytics sync of 500 posts < 5 min | Pending Phase 5 | ⏳ | Batch upsert pipeline |

## 2. Solver vs Baseline Comparison (Phase 7 Deliverable)
- Metrics comparing QUBO + Simulated Annealing (`dwave-samplers`) vs Greedy baseline vs Random feasible schedules will be recorded here against `scripts/seed/truth.json`.

## 3. Dual-Model Machine Learning System (Trained v1.0)

### 3.1 Model 1: Global Platform Dynamics Predictor
- **Algorithm**: `HistGradientBoostingRegressor` (scikit-learn) with logarithmic target transformation (`log1p`).
- **Dataset**: `services/ai/data/global_instagram_dataset.csv` (15,000 samples across 12 diverse creator categories including tech, comedy, fitness, photography, fashion, business).
- **Split**: 80% train (12,000), 20% test (3,000).
- **Test Set Metrics**:
  - **$R^2$ Score**: `0.6401`
  - **Mean Absolute Error (MAE)**: `1.505%` engagement rate
  - **Root Mean Squared Error (RMSE)**: `2.219`
- **Top Driving Features**:
  1. `log_followers` (48.2%): Follower count scaling / baseline distribution
  2. `media_type_reel` (19.2%): Reel format organic distribution boost
  3. `hour_sin` / `hour_cos` (27.3%): Cyclic time-of-day peak windows (17:00–21:00 UTC)
  4. `media_type_carousel` (1.8%): Multi-slide carousel retention
  5. `sentiment_compound` (0.6%): Hook sentiment positivity

### 3.2 Model 2: Personal Creator Fingerprint & Empirical Bayes
- **Mechanism**: Dynamic fitting on live scraped profile posts (`@hafeezisnt`).
- **NLP Vectorizer**: `TfidfVectorizer` (unigrams + bigrams) extracting creator vocabulary and personal hashtag clusters.
- **Blending Formula**:
  $$\hat{y}_{blended} = \alpha \cdot \hat{y}_{personal} + (1 - \alpha) \cdot \hat{y}_{global}, \quad \text{where } \alpha = \frac{n}{n + 5.0}$$
- **Inference Latency**: `< 20ms` via FastAPI `POST /api/v1/predict/engagement`.
