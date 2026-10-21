# Entangled Echo — Requirements Traceability Matrix

Maps SRDS Functional Requirements (FR-01 to FR-35) to code files, API routes, and automated tests.

| FR ID | Requirement Name | SRDS Ref | Implementation Path(s) | Test Path(s) | Status |
|---|---|---|---|---|---|
| FR-01 | User Registration | 3.1.1 | `apps/web/src/app/(auth)/register` | `apps/web/tests/auth.test.ts` | ⏳ Phase 3 |
| FR-02 | OAuth 2.0 Support | 3.1.1 | `apps/web/src/app/(auth)/login` | `apps/web/tests/auth.test.ts` | ⏳ Phase 3 |
| FR-03 | Email Verification | 3.1.1 | Supabase Auth Trigger | `apps/web/tests/auth.test.ts` | ⏳ Phase 3 |
| FR-04 | Password Reset | 3.1.1 | `apps/web/src/app/(auth)/reset` | `apps/web/tests/auth.test.ts` | ⏳ Phase 3 |
| FR-05 | User Profiles | 3.1.1 | `apps/web/src/app/(dashboard)/settings` | `apps/web/tests/profile.test.ts` | ⏳ Phase 3 |
| FR-06 | Role-Based Access | 3.1.1 | `apps/web/src/middleware.ts`, `apps/web/src/app/admin` | `apps/web/tests/admin.test.ts` | ⏳ Phase 3 |
| FR-07 | Social Integration | 3.1.1 | `apps/web/src/lib/providers/` | `apps/web/tests/social.test.ts` | ⏳ Phase 4 |
| FR-08 | Token Security | 3.1.1 | `apps/web/src/lib/crypto/aes.ts` | `apps/web/tests/crypto.test.ts` | ⏳ Phase 4 |
| FR-09 | Metric Retrieval | 3.1.2 | `apps/web/src/app/api/data/sync` | `apps/web/tests/sync.test.ts` | ⏳ Phase 5 |
| FR-10 | Normalization | 3.1.2 | `apps/web/src/lib/normalize.ts` | `apps/web/tests/normalize.test.ts` | ⏳ Phase 5 |
| FR-11 | Data Retention | 3.1.2 | `supabase/migrations/` | `supabase/tests/retention.test.sql` | ⏳ Phase 5 |
| FR-12 | Sync Status | 3.1.2 | `apps/web/src/app/(dashboard)/page.tsx` | `apps/web/tests/dashboard.test.ts` | ⏳ Phase 5 |
| FR-13 | NLP Analysis | 3.1.3 | `services/ai/app/analysis/nlp.py` | `services/ai/tests/test_analysis.py` | ⏳ Phase 6 |
| FR-14 | Media Classification | 3.1.3 | `services/ai/app/analysis/media.py` | `services/ai/tests/test_media.py` | ⏳ Phase 6 |
| FR-15 | Performance Insights | 3.1.3 | `services/ai/app/analysis/insights.py`| `services/ai/tests/test_insights.py` | ⏳ Phase 6 |
| FR-16 | Performance Scoring | 3.1.3 | `services/ai/app/analysis/scoring.py` | `services/ai/tests/test_scoring.py` | ⏳ Phase 6 |
| FR-17 | Schedule Generation | 3.1.4 | `services/ai/app/optimizer/qubo.py` | `services/ai/tests/test_optimizer.py`| ⏳ Phase 7 |
| FR-18 | User Constraints | 3.1.4 | `services/ai/app/optimizer/constraints.py` | `services/ai/tests/test_constraints.py` | ⏳ Phase 7 |
| FR-19 | Ranked Alternatives | 3.1.4 | `services/ai/app/optimizer/qubo.py` | `services/ai/tests/test_optimizer.py`| ⏳ Phase 7 |
| FR-20 | Confidence Metrics | 3.1.4 | `services/ai/app/optimizer/confidence.py` | `services/ai/tests/test_confidence.py` | ⏳ Phase 7 |
| FR-21 | Content Templates | 3.1.5 | `services/ai/app/recommender/templates.py`| `services/ai/tests/test_templates.py` | ⏳ Phase 8 |
| FR-22 | Task Decomposition | 3.1.5 | `services/ai/app/decomposer/planner.py`| `services/ai/tests/test_decomposer.py`| ⏳ Phase 8 |
| FR-23 | AI Drafts | 3.1.5 | `services/ai/app/llm/client.py` | `services/ai/tests/test_llm.py` | ⏳ Phase 8 |
| FR-24 | Machine Learning Feedback | 3.1.5 | `services/ai/app/recommender/feedback.py` | `services/ai/tests/test_feedback.py` | ⏳ Phase 8 |
| FR-25 | Calendar Interface | 3.1.6 | `apps/web/src/app/(dashboard)/calendar` | `apps/web/tests/calendar.test.ts` | ⏳ Phase 9 |
| FR-26 | Auto-Publishing | 3.1.6 | `apps/web/src/app/api/internal/tick` | `apps/web/tests/tick.test.ts` | ⏳ Phase 9 |
| FR-27 | Retry Mechanism | 3.1.6 | `apps/web/src/lib/publisher.ts` | `apps/web/tests/publisher.test.ts` | ⏳ Phase 9 |
| FR-28 | Failure Alerts | 3.1.6 | `apps/web/src/lib/notifications.ts` | `apps/web/tests/notifications.test.ts` | ⏳ Phase 9 |
| FR-29 | Trend Visualization | 3.1.7 | `apps/web/src/app/(dashboard)/analytics`| `apps/web/tests/analytics.test.ts` | ⏳ Phase 10 |
| FR-30 | Audience Breakdown | 3.1.7 | `apps/web/src/app/(dashboard)/analytics/audience` | `apps/web/tests/audience.test.ts` | ⏳ Phase 10 |
| FR-31 | Data Export | 3.1.7 | `apps/web/src/app/api/export/csv` | `apps/web/tests/export.test.ts` | ⏳ Phase 10 |
| FR-32 | Competitive Analysis | 3.1.7 | `apps/web/src/app/(dashboard)/competitors` | `apps/web/tests/competitors.test.ts` | ⏳ Phase 10 |
| FR-33 | In-App Alerts | 3.1.8 | `apps/web/src/app/(dashboard)/notifications` | `apps/web/tests/notifications.test.ts` | ⏳ Phase 11 |
| FR-34 | Email Digests | 3.1.8 | `apps/web/src/lib/email.ts` | `apps/web/tests/email.test.ts` | ⏳ Phase 11 |
| FR-35 | Customization | 3.1.8 | `apps/web/src/app/(dashboard)/settings/notifications` | `apps/web/tests/prefs.test.ts` | ⏳ Phase 11 |
