# Entangled Echo — Architectural Deviations Log

This document records every place the implementation deliberately differs from or refines the original SRDS (`srdsfyp.pdf`), along with the justification.

| ID | SRDS Section / Spec | Actual Implementation | Justification |
|---|---|---|---|
| D1 | Custom `/auth/register`, `/auth/login` routes, bcrypt cost 12, own JWT handling | Supabase Auth (`@supabase/ssr`) with BFF wrappers where route names matter | Supabase Auth handles secure password hashing, email verification, password reset, and JWT session handling securely. Cost factor is managed by Supabase Auth engine. |
| D2 | "Serverless functions for the backend" + Python FastAPI | Containerized FastAPI backend on long-running host/container with `/health` ping | Optimization jobs (QUBO / Simulated Annealing) and NLP models exceed typical serverless execution and memory limits. |
| D3 | "Simulated annealing" pseudocode swapping random slots (Alg. 1) | QUBO formulation solved via Simulated Annealing (`dwave-samplers` / `dimod`) | QUBO provides mathematically sound formulation natively compatible with quantum annealers, making "quantum-inspired" technically defensible. |
| D4 | Alternative schedules via "perturbing primary schedule" | Top-k distinct low-energy feasible samples from sampler | More principled, unbiased alternatives directly produced by the combinatorial solver. |
| D5 | Custom WebSocket push server | Supabase Realtime subscriptions on Postgres tables (`optimization_jobs`, `notifications`, `scheduled_posts`) | Standard, scalable real-time events without managing a stateful custom WebSocket server. |
| D6 | Cron "every 24 h" and publish within 60 s | `pg_cron` / internal worker tick (`/internal/tick`) every minute for publishing and daily sync | High-precision scheduling requires minute-level resolution. |
| D7 | Competitor `reach` / likes via `/user/{handle}/media` | Business Discovery API (public data only: followers, media count, public likes/comments) | Meta Graph API strictly restricts reach and impressions to accounts the authenticated user owns. |
| D8 | Missing tables in SRDS ERD | Added `audience_snapshots`, `competitors`, `notification_preferences`; added `topics`, `sentiment` to `posts`; added `feedback` to `recommendations` | Referenced in Sequence Diagrams SD-03, SD-07, SD-08 but omitted from the original ERD diagram. |
| D9 | Malware scan of uploads | Magic byte validation, file size enforcement, image re-encoding with `sharp` to strip malicious payloads | Pragmatic production-ready image sanitization. |
| D10 | Engagement/impressions fields | Stored `views` and `impressions` columns nullable; populated per API response | Meta Graph API has migrated between impressions and views metrics across versions. |
| D11 | Instagram link ingestion without login wall in dev/demo mode | Direct Instagram URL / handle input with instant seeded/mock profile loader; login/signup deferred to later phase as requested | Enables immediate testing and validation of content analysis, visualization, and optimization features without blocking on auth gates. |
