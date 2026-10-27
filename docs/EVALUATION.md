# Entangled Echo — Evaluation & Benchmark Results

This document tracks quantitative performance benchmarks, algorithmic validation, Non-Functional Requirement (NFR) measurements, and an empirical audit of the machine learning dataset and models. All numbers reported here reflect actual measured runs on the codebase and environment.

---

## 1. NFR Targets & Status

All benchmarks below were executed on the project environment (Linux x86_64, Python 3.12, Node.js v20, SQLite 3 with WAL mode, Next.js 14 App Router).

| Requirement ID | Target Metric | Measured Value | Status | Method / Tool & Environment | Notes |
|---|---|---|---|---|---|
| **NFR 4.1.1** | Dashboard page load < 3s | **1.19s** avg (warm: 1.13s – 1.28s; cold route compile: 7.45s) | ✅ PASSED | Playwright Headless Chromium (`services/ai/scripts/benchmark_dashboard_load.py`), Performance Navigation API (`TTFB=38.6ms`, `DCL=91.5ms`) | Measured on local stack (`http://localhost:3000`). Warm client load easily satisfies < 3.0s threshold. |
| **NFR 4.1.2** | REST API CRUD p95 < 500ms (100 users) | **p95 = 16,789 ms** (Mean: 5,585 ms, p50: 4,658 ms, p90: 13,212 ms, Throughput: 14.7 req/s across 800 requests) | ❌ FAILED | Async client pool simulating 100 simultaneous concurrent users executing CRUD lifecycle (`services/ai/scripts/benchmark_crud_load.py`) | Missed target < 500ms due to SQLite file-level single-writer lock contention and single-process Uvicorn concurrency bottleneck under 100 simultaneous concurrent connections. |
| **NFR 4.1.3** | QUBO Schedule Optimization < 10s (30d horizon, 5 accounts) | **16.41s** total across 5 accounts (Avg **3.28s** / account) | ❌ FAILED | D-Wave `SimulatedAnnealingSampler` with tuned penalties ($A=1.2\times, B=2.0\times$, 100 reads, 500 sweeps, 5 bootstrap rounds) (`services/ai/scripts/benchmark_nfr_413.py`) | Missed target < 10.0s by 6.41s. Improved 36.7% from initial untuned run (25.92s). Sequential single-worker execution averages 3.28s per account; meeting < 10s requires multi-worker parallel dispatch across accounts. |
| **NFR 4.1.4** | AI Caption & Hashtag generation < 5s | **3.58s** avg (Min: 3.20s, Max: 4.15s) | ✅ PASSED | Recommendation engine (`services/ai/scripts/benchmark_nfr_414.py`), live few-shot prompt synthesis + Google Trends extraction | Meets requirement < 5.0s. |
| **NFR 4.1.5** | Scheduled post publishing within 60s window | **Not Implemented / N/A** | ❌ FAILED | Code inspection of database layer and API endpoints | Scheduled posts are persisted in the `scheduled_posts` SQLite table with status `SCHEDULED`, but no minute-level background tick cron daemon (`/internal/tick` or worker) exists to poll and dispatch them to the Meta Graph API. |
| **NFR 4.1.6** | Analytics sync of 500 posts < 5 min | **7.94s** initial batch upsert (15.88 ms/post); **8.59s** re-sync deduplication | ✅ PASSED | Batch upsert pipeline (`services/ai/scripts/benchmark_sync_500.py`) into SQLite database with `ON CONFLICT` deduplication | Well within the 300-second target. Verified 0 duplicate records created on re-sync. |

---

## 2. Phase 7 Scheduler Optimization Benchmark

Benchmark script: [`services/ai/scripts/compare_phase7_schedulers.py`](file:///home/hafeez/Desktop/Projects/fyp2/services/ai/scripts/compare_phase7_schedulers.py).  
Evaluated on identical inputs across 5 random seeds (`[42, 123, 456, 789, 1024]`), using a representative creator account (15,000 followers, 45 historical posts) with empirical Bayesian shrinkage scores $v_s \in [0.05, 1.0]$.  
Constraints: Target $K = 5$ posts/week, minimum gap between posts on the same day $\text{min\_gap} = 4$ hours, blackout window overnight (00:00–06:00, 49 forbidden slots).

### 2.1 Diagnostic Analysis: Coefficient Dominance
An initial diagnostic of the QUBO formulation revealed the exact mathematical cause of poor initial QUBO performance:
- **Slot values $v_s$**: Normalized range $v_s \in [0.05, 1.00]$ (mean $0.5034$). Maximum difference between the best and worst slot is $\Delta v = 0.95$.
- **Untuned Penalties**: $A = 25.0$, $B = 30.0$.
  - Linear penalty offset: $A(1 - 2K) = 25(1 - 10) = -225.0$. The linear term range was $[-113.50, -112.55]$, meaning slot value variations represented less than **0.84%** of the linear bias.
  - Quadratic penalty weights: $2A = 50.0$, $2A + B = 80.0$.
  - **Dominance Ratio**: $80.0 / 0.95 = \mathbf{84.2\times}$.
- **Diagnostic Conclusion**: The hypothesis is confirmed. Constraint penalty barriers were $84\times$ larger than slot value differences. The simulated annealing sampler cooled rapidly into an arbitrary feasible state (any 5 non-conflicting slots) and froze, unable to traverse intermediate states to reach higher-value slots. This caused untuned QUBO to score **2.2104**, comparable to random guessing (2.3168).

### 2.2 Penalty Rescaling & Grid Sweep
We rescaled penalty multipliers relative to $\max(v_s)$ and conducted a grid sweep across all 5 seeds:
- Grid tested: $A \in \{1.2, 1.8, 2.5\} \times \max(v)$, $B \in \{1.5, 2.0, 3.0\} \times \max(v)$, $\text{reads} \in \{100, 200\}$, $\text{sweeps} \in \{500, 1000\}$.
- **Findings**:
  - $A = 1.2 \times \max(v) \approx 1.10$, $B = 2.0 \times \max(v) \approx 1.84$ achieved **100.0% constraint feasibility** across all seeds while raising the objective score from **2.2104** to **4.3878** (near the exact optimal 4.4296).
  - Runtime dropped from 4,182 ms down to **738 ms** with `num_reads=100, num_sweeps=500`.
  - As $A$ increased from $1.2\times$ to $2.5\times$, objective scores systematically degraded from $4.38 \to 4.08$, confirming that tighter penalty bounds preserve slot discrimination.

### 2.3 Problem Variant 1: Independent Linear Slot Values
In this standard formulation, slot values $v_s$ are separable, and the objective is $\max \sum_{s \in S} v_s$ subject to $K=5$, $\ge 4$h gap, and no blackout slots.
Exact global optimum was computed via Mixed Integer Linear Programming (MILP) using `scipy.optimize.milp` (HiGHS solver).

| Method | Formulation / Algorithm | Objective Score $\sum v_s$ (Mean ± Std) | Optimality Gap | Runtime ms (Mean ± Std) | Feasibility |
|---|---|---|---|---|---|
| **Exact Optimum (MILP)** | Exact Branch & Bound (`scipy.optimize.milp` / HiGHS) | **4.4296 ± 0.0000** | **0.00%** | **30.6 ± 0.0 ms** | **100.0%** |
| **Greedy Baseline** | Sorts valid slots by $v_s$ descending; picks highest feasible slot | **4.4296 ± 0.0000** | **0.00%** | **0.1 ± 0.0 ms** | **100.0%** |
| **Classical Simulated Annealing** | SRDS Algorithm 1: random slot swapping with exponential cooling | **4.4263 ± 0.0067** | **0.08%** | **78.2 ± 6.6 ms** | **100.0%** |
| **Tuned QUBO + SA** | Scaled penalties ($A=1.2\times, B=2.0\times$, 100 reads, 500 sweeps) | **4.3420 ± 0.0507** | **1.98%** | **738.8 ± 46.6 ms** | **100.0%** |
| **Untuned QUBO + SA** | High fixed penalties ($A=25, B=30$, 250 reads, 1000 sweeps) | **3.6359 ± 0.2374** | **17.92%** | **1,372.1 ± 89.9 ms** | **100.0%** |
| **Random Feasible Baseline** | Rejection sampling uniformly across non-conflicting slots | **2.1449 ± 0.1363** | **51.58%** | **0.1 ± 0.1 ms** | **100.0%** |

**Honest Finding on Variant 1**: On a simple linear formulation without cross-slot interactions, **Greedy achieves the exact 100% global optimum (0.00% gap) in 0.1 ms**. Because independent slot selection with minimum gaps is matroid-like, Greedy cannot be beaten here. Tuned QUBO closes the gap to 1.98% (compared to 17.92% for untuned QUBO), but running a quadratic unconstrained binary model on a purely linear problem incurs unnecessary sampling overhead.

---

### 2.4 Problem Variant 2: Pairwise Audience Fatigue & Diversity Dynamics
In realistic content scheduling, posts cannot be evaluated independently:
1. **Audience Fatigue / Cannibalization Penalty**: Posting on consecutive days causes algorithm reach cannibalization ($-0.25$ per adjacent-day pair; additional $-0.40$ if both posts share the same media format).
2. **Weekly Pacing Bonus**: Spacing posts 2 to 3 days apart captures fresh audience attention ($+0.25$ bonus).
3. **Format Diversity Bonus**: Mixing media formats (Reels on peak evening hours, Carousels on midday educational slots, Single Images on morning slots) receives a platform synergy bonus ($+0.30$ per distinct format pair).

Objective: $\max \sum_{s \in S} v_s + \sum_{i < j} J(s_i, s_j)$ subject to $K=5$, $\ge 4$h gap, and no blackouts.
Exact global optimum was computed via exhaustive Branch & Bound ($V^* = 8.7077$).

| Method | Formulation / Algorithm | Objective Score (Mean ± Std) | Optimality Gap | Runtime ms (Mean ± Std) | Feasibility |
|---|---|---|---|---|---|
| **Exact Optimum (B&B)** | Exhaustive Branch & Bound with upper-bound pruning | **8.7077 ± 0.0000** | **0.00%** | **123,562 ms** (~123s) | **100.0%** |
| **Classical Simulated Annealing** | Slot swapping evaluating full quadratic energy function | **8.6095 ± 0.1460** | **1.13%** | **217.9 ± 13.0 ms** | **100.0%** |
| **Tuned QUBO + SA** | Binary Quadratic Model encoding pairwise $J_{ij}$ terms in $Q$ matrix | **8.0078 ± 0.0767** | **8.04%** | **1,407.7 ± 91.3 ms** | **100.0%** |
| **Greedy Baseline** | Evaluates slots independently; blind to pairwise interactions | **6.8296 ± 0.0000** | **21.57%** | **0.1 ± 0.0 ms** | **100.0%** |
| **Random Feasible Baseline** | Rejection sampling uniformly across non-conflicting slots | **5.0349 ± 1.2754** | **42.18%** | **0.1 ± 0.1 ms** | **100.0%** |

**Honest Finding on Variant 2**:
- When non-linear pairwise interactions exist, **Greedy fails severely**, suffering an **optimality gap of 21.57%** (score of only 6.8296). Greedy selected clustered high-traffic evening slots on consecutive days (Monday and Tuesday 20:00), triggering severe audience fatigue penalties and forfeiting the format diversity bonus.
- **Tuned QUBO achieves 8.0078 (8.04% gap to optimal)**, outperforming Greedy by **+1.1782 points (+17.3% higher objective score)**. Because pairwise fatigue penalties and diversity rewards naturally map into the off-diagonal coefficients of the QUBO $Q$ matrix, the simulated annealing sampler successfully selected well-spaced, diverse schedules (e.g. Tuesday Carousel/Reel, Thursday Image, Saturday Carousel/Reel).
- **Summary**: QUBO has a genuine mathematical advantage over Greedy heuristics only when pairwise content, pacing, or diversity interactions are present. Classical Simulated Annealing (Algorithm 1) also performs well on this instance (1.13% gap, 218 ms).

---

## 3. Machine Learning Dataset & Model Claims Audit

### 3.1 Dataset Audit & Real-Only Subset (`global_instagram_dataset.csv`)
An audit of `harvest_and_generate_dataset.py`, `ingest_user_profiles.py`, and `playwright_scraper.py` revealed the exact data provenance:

- **Total Rows in Raw Scraped CSV**: `10,454`
- **Total Unique Handles**: `894`
- **Synthetic Fallback Rows**: **8,685 rows (83.08%)** were synthesized using fallback formulas:
  $$\text{rate} = 0.024 + \frac{((\text{idx} \times 7) \pmod{20})}{1000.0}$$
  $$\text{likes} = \max(15, \lfloor \text{followers} \times \text{rate} \rfloor), \quad \text{comments} = \max(3, \lfloor \text{likes} \times 0.04 \rfloor)$$
- **Synthetic Reach Column**: **10,305 rows (98.57%)** calculated reach synthetically as $\max(\text{likes} \times 5, \lfloor \text{followers} \times 0.22 \rfloor, 200)$. (Instagram strictly restricts reach to authenticated OAuth insights).
- **Real Parsed Subset**: Exactly **1,769 rows (16.92%) across 855 unique creator handles** contain authentic likes and comments extracted directly from Instagram page metadata (`og:description`).
- **Explicit Scrape-Time Flagging**: Added an explicit boolean column `is_real_metrics` set directly at scrape time in `playwright_scraper.py`, `ingest_user_profiles.py`, and `harvest_and_generate_dataset.py` (and stored in the `scraped_posts` table of `entangled_echo.db`), guaranteeing that real vs. formula-generated metrics are permanently tracked going forward rather than inferred.

### 3.2 Real Target Definition
To eliminate synthetic arithmetic from model training, the target was redefined strictly using authentic, publicly parsed columns:
$$\text{engagement\_rate} = \frac{\text{likes} + \text{comments}}{\text{followers}} \times 100$$
*(Expressed as a percentage of total followers engaged. Real subset distribution: min 0.001%, median 0.665%, 75th percentile 3.175%, mean 9.75% due to viral micro-creator outliers).*

### 3.3 Out-of-Distribution Evaluation on Held-Out Creator Handles
To eliminate train/test leakage, the model was retrained strictly on the **1,769 real parsed rows** using `GroupShuffleSplit` (80% train / 20% test grouped by `handle`).
- **Train Split**: 684 handles (1,419 post samples)
- **Test Split**: 171 handles (350 post samples)
- **Handle Overlap**: Exactly **0 handles** in both splits (verified by automated test `services/ai/tests/test_model_leakage.py`).

#### Held-Out Evaluation on Raw Engagement Rate (%) Target:
| Model / Baseline | $R^2$ Score (Raw) | Mean Absolute Error (MAE %) | Root Mean Squared Error (RMSE) |
|---|---|---|---|
| **Predict-Mean Baseline** | -0.0037 | 18.219% | 101.016 |
| **Predict-Median Baseline** | -0.0194 | **14.422%** | 101.803 |
| **Followers-Only Linear Model** (`LinearRegression` on `log_followers`) | 0.0623 | 18.358% | 97.641 |
| **Model 1 (`HistGradientBoostingRegressor`)** | **0.0337** | **13.904%** | **99.119** |

#### In Log-Transformed Space $\log(1 + y)$:
- Predict-Mean Baseline: $R^2 = -0.0092$, $\text{MAE} = 0.906$, $\text{RMSE} = 1.235$
- Followers-Only Linear Model: $R^2 = 0.2950$, $\text{MAE} = 0.774$, $\text{RMSE} = 1.032$
- Model 1 (HGBR): $R^2 = 0.3749$, $\text{MAE} = 0.707$, $\text{RMSE} = 0.972$

#### 5-Fold GroupKFold Cross-Validation (All 855 Handles):
Across all 5 folds:
- Predict-Mean Baseline: $R^2 = -0.0029$, $\text{MAE} = 14.764\%$
- Predict-Median Baseline: $R^2 = -0.0168$, $\text{MAE} = 9.556\%$
- Followers-Only Linear Model: $R^2 = 0.0394$, $\text{MAE} = 15.700\%$
- Model 1 (HGBR): $R^2 = 0.0305$, $\text{MAE} = 9.069\%$

---

### 3.4 Honest Relabeling of Model 1
- **Empirical Reality**: On held-out creator accounts, Model 1 achieves an $R^2$ of **0.0337** (explaining only **3.37% of the variance** in raw engagement rate). In raw engagement space, simply predicting the training median achieves an MAE of **14.422%**, while the complex Gradient Boosting model achieves **13.904%** (a marginal difference of 0.52%). Follower tier accounts for almost all predictable signal ($R^2 = 0.0623$ for followers alone).
- **Reframing Action**:
  - Model 1 is **re-labeled as a Heuristic Baseline Prior**, not an individual post predictor. All claims of predictive accuracy or viral algorithm prediction have been removed from `model_metadata.json`, the API, and the UI.
  - Its actual function is to serve as an **empirical prior** for Bayesian cold-start slot scoring when a new creator connects with little or no historical posting data.
- **Model 2 (Creator Personal Fingerprint)**:
  - Preserved as the creator-specific empirical model (`services/ai/app/ml/personal_model.py`).
  - Evaluated on creator-specific post histories using Bayesian shrinkage ($k=5.0$) against the global prior, empirical media format weights (Reels vs. Carousels vs. Images), hourly timing distributions, and TF-IDF caption/hashtag patterns.

---

## 4. Summary of All Measured Findings

1. **QUBO Constraint Dominance Fixed**: Initial penalties ($A=25, B=30$) created an $84\times$ penalty-to-value dominance ratio, causing simulated annealing to freeze on arbitrary feasible slots (score 2.21). Rescaling penalties to $A = 1.2 \times \max(v), B = 2.0 \times \max(v)$ restored value sensitivity, achieving **4.34–4.38** on Variant 1 (near the exact MILP optimum of 4.43) with 100% feasibility and 4x faster sampling.
2. **Where QUBO Wins vs. Greedy**:
   - On **Variant 1** (independent linear slots), Greedy achieves the exact global optimum (**0.00% gap** in 0.1 ms); QUBO offers no benefit over greedy for separable linear objectives.
   - On **Variant 2** (pairwise audience fatigue and format diversity), Greedy breaks down with a **21.57% optimality gap**, while Tuned QUBO achieves an **8.04% gap**, outscoring Greedy by **+17.3%** (+1.18 points).
3. **Model 1 Reframed Honestly**:
   - 83.1% of raw likes and 98.6% of reach in `global_instagram_dataset.csv` were formula-generated fallback values.
   - Retraining on the 1,769 real parsed rows across 855 handles with zero creator leakage yields $R^2 = 0.0337$ and MAE = 13.90% (vs. 14.42% for constant median).
   - Model 1 is honestly documented as a **Heuristic Baseline Prior** for cold-start initialization rather than a post performance predictor.
