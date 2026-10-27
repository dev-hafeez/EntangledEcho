# Entangled Echo 🌌

**Entangled Echo** is an AI-powered social media intelligence and scheduling platform designed for creators and small businesses. It ingests public profile and engagement data, analyzes caption sentiment and hashtag clusters, recommends optimal posting schedules via a **quantum-inspired Quadratic Unconstrained Binary Optimization (QUBO)** solver, and drafts content using large language models.

---

## 1. System Architecture & Tech Stack

```
/apps/web                 Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui
  /src/app/(dashboard)    Dashboard, Analytics, Calendar, Recommendations, Settings, Admin
  /src/app/api/...        BFF (Backend-For-Frontend) route handlers
  /src/context/...        AuthContext (Supabase Auth) & AccountContext
/services/ai              FastAPI (Python 3.10+), pydantic v2, pandas, scikit-learn
  /app/ml                 Model 1 (Global Engagement Regressor) & Model 2 (Personal Model)
  /app/optimizer          QUBO Scheduler (dwave-samplers + dimod) & Classical Simulated Annealing
  /app/recommender        Algorithm 2 (Caption drafts, hashtags, and Google Trends angles)
  /app/analysis           NLP (TF-IDF, VADER sentiment, performance scoring)
  /data                   SQLite database (entangled_echo.db) and training datasets
/supabase                 Supabase config and PostgreSQL migrations
  /migrations             Full SRDS schema with RLS policies and trigger functions
/docs                     EVALUATION.md, DEVIATIONS.md
```

### Data Store Architecture
- **Runtime Application Data (SQLite)**: The live AI service stores scraped profiles, posts, metrics, optimization jobs, recommendations, and calendar schedules in `services/ai/data/entangled_echo.db` (zero-config, high-speed relational storage with WAL mode).
- **Authentication & User Management (Supabase)**: User login, registration, and profile roles/metadata (`user_metadata`) are managed via Supabase Auth.
- **Production Schema (PostgreSQL)**: Complete Supabase migrations are provided in `supabase/migrations/20261028000000_init_schema.sql` matching the SRDS Section 5.3 ERD and architectural decisions (D1, D8, D10).

---

## 2. Setup from Scratch (Fresh Clone)

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **pnpm**: v8.0.0 or higher (`npm install -g pnpm`)
- **Python**: 3.10, 3.11, or 3.12
- **Playwright Chromium**: installed via Python virtual environment

### Step 1: Clone Repository
```bash
git clone <repo-url>
cd fyp2
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
cp .env apps/web/.env.local
```

### Step 3: Python AI Backend Setup
```bash
cd services/ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cd ../..
```

### Step 4: Web Frontend Setup
```bash
pnpm install
```

### Step 5: Launch the Application
Run the unified startup script:
```bash
bash run.sh
```
This script checks dependencies, cleans existing port bindings, starts the FastAPI service on `http://127.0.0.1:8001`, and launches Next.js on `http://localhost:3000`.

---

## 3. Running Benchmarks & Reproducing Measurements

All evaluation measurements from `docs/EVALUATION.md` can be reproduced using the benchmark scripts in `services/ai/scripts/`:

### 1. Phase 7 QUBO vs Baseline Optimizer Comparison
Compares QUBO + Simulated Annealing against Greedy, Random Feasible, and Classical Simulated Annealing across multiple seeds:
```bash
PYTHONPATH=services/ai ./services/ai/.venv/bin/python3 services/ai/scripts/compare_phase7_schedulers.py
```

### 2. NFR 4.1.3: QUBO 30-Day Horizon Benchmark (5 Accounts)
```bash
PYTHONPATH=services/ai ./services/ai/.venv/bin/python3 services/ai/scripts/benchmark_nfr_413.py
```

### 3. NFR 4.1.2: REST API CRUD Concurrent Load Benchmark (100 Users)
```bash
PYTHONPATH=services/ai ./services/ai/.venv/bin/python3 services/ai/scripts/benchmark_crud_load.py
```

### 4. NFR 4.1.4: AI Caption & Hashtag Generation Latency
```bash
PYTHONPATH=services/ai ./services/ai/.venv/bin/python3 services/ai/scripts/benchmark_nfr_414.py
```

### 5. NFR 4.1.6: Analytics Sync of 500 Posts
```bash
PYTHONPATH=services/ai ./services/ai/.venv/bin/python3 services/ai/scripts/benchmark_sync_500.py
```

### 6. NFR 4.1.1: Dashboard Page Load via Browser Performance API
```bash
PYTHONPATH=services/ai ./services/ai/.venv/bin/python3 services/ai/scripts/benchmark_dashboard_load.py
```

### 7. Train & Evaluate Global Engagement Model
```bash
PYTHONPATH=services/ai ./services/ai/.venv/bin/python3 services/ai/app/ml/train_global_model.py
```

---

## 4. Documentation References

- **[`docs/EVALUATION.md`](file:///home/hafeez/Desktop/Projects/fyp2/docs/EVALUATION.md)**: Real quantitative benchmark measurements, NFR validation table, Phase 7 optimizer comparison, and ML dataset/model audit.
- **[`docs/DEVIATIONS.md`](file:///home/hafeez/Desktop/Projects/fyp2/docs/DEVIATIONS.md)**: Deliberate refinements and architectural deviations from the initial `srdsfyp.pdf` specification.
- **[`supabase/migrations/20261028000000_init_schema.sql`](file:///home/hafeez/Desktop/Projects/fyp2/supabase/migrations/20261028000000_init_schema.sql)**: Canonical PostgreSQL schema with RLS policies, triggers, and indexes.
