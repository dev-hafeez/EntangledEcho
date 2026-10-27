-- ====================================================================
-- Entangled Echo: Comprehensive Initial Schema Migration
-- Matches SRDS Section 5.3 (ERD) & Architectural Decisions (D1, D8, D10)
-- ====================================================================

-- 1. Helper Security Definer Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (
      raw_user_meta_data->>'role' = 'admin'
      OR email LIKE '%admin%'
    )
  );
$$;

-- 2. Profiles Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    bio TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, role, status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        'active'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Social Accounts Table
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
    external_id TEXT NOT NULL,
    handle TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    access_token_enc TEXT,
    refresh_token_enc TEXT,
    token_expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'needs_reauth', 'disconnected')),
    is_synthetic BOOLEAN DEFAULT FALSE,
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(user_id, platform, external_id)
);

-- 4. Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'reel', 'carousel', 'video')),
    caption TEXT,
    permalink TEXT,
    media_url TEXT,
    posted_at TIMESTAMPTZ NOT NULL,
    perf_score REAL,
    topics JSONB DEFAULT '[]'::jsonb,
    sentiment REAL DEFAULT 0.5,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(account_id, external_id)
);

-- 5. Engagement Metrics (Time-series snapshots)
CREATE TABLE IF NOT EXISTS public.engagement_metrics (
    id BIGSERIAL PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    views INTEGER,
    impressions INTEGER
);

-- 6. Audience Snapshots (D8 Deliverable)
CREATE TABLE IF NOT EXISTS public.audience_snapshots (
    id BIGSERIAL PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    age_distribution JSONB DEFAULT '{}'::jsonb,
    gender_distribution JSONB DEFAULT '{}'::jsonb,
    country_distribution JSONB DEFAULT '{}'::jsonb,
    city_distribution JSONB DEFAULT '{}'::jsonb
);

-- 7. Competitors Table (D8 & D7 Deliverable)
CREATE TABLE IF NOT EXISTS public.competitors (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT NOT NULL,
    platform TEXT DEFAULT 'instagram',
    followers INTEGER DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    public_engagement_rate REAL,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(user_id, platform, handle)
);

-- 8. Optimization Jobs Table (FR-17..20, UC06)
CREATE TABLE IF NOT EXISTS public.optimization_jobs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    horizon_days INTEGER DEFAULT 7,
    target_posts INTEGER DEFAULT 5,
    min_gap_hours INTEGER DEFAULT 4,
    constraints JSONB DEFAULT '{}'::jsonb,
    primary_schedule JSONB,
    alternatives JSONB DEFAULT '[]'::jsonb,
    schedule_confidence REAL,
    qubo_stats JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 9. Content Strategies & Marketing Goals (FR-22, UC07)
CREATE TABLE IF NOT EXISTS public.content_strategies (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    goal TEXT NOT NULL,
    platform TEXT DEFAULT 'instagram',
    horizon_days INTEGER DEFAULT 14,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 10. Decomposed Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    strategy_id TEXT REFERENCES public.content_strategies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    media_type TEXT DEFAULT 'reel',
    due_date DATE,
    priority TEXT DEFAULT 'HIGH' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 11. Scheduled Posts Table (FR-25..28, State Machine)
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    title TEXT,
    caption TEXT,
    hashtags JSONB DEFAULT '[]'::jsonb,
    media_type TEXT DEFAULT 'image',
    media_url TEXT,
    scheduled_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED')),
    last_error TEXT,
    retry_count INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 12. Recommendations Table (FR-21..24, Algorithm 2)
CREATE TABLE IF NOT EXISTS public.recommendations (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('caption', 'schedule', 'content_type')),
    content JSONB NOT NULL,
    confidence_score REAL,
    accepted BOOLEAN,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 13. Notifications Table (FR-33..35, UC08)
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('REMINDER', 'PUBLISH_SUCCESS', 'PUBLISH_FAIL', 'MILESTONE', 'AI_INSIGHT')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 14. Notification Preferences (D8 Deliverable)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email_reminders BOOLEAN DEFAULT TRUE,
    in_app_reminders BOOLEAN DEFAULT TRUE,
    email_digest BOOLEAN DEFAULT TRUE,
    milestone_alerts BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 15. Auth Rate Limiting (SRDS 4.2.5)
CREATE TABLE IF NOT EXISTS public.auth_attempts (
    ip INET NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ====================================================================
-- Indexes for High-Speed Lookups and Joins
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_social_user ON public.social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_account ON public.posts(account_id);
CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON public.posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_post ON public.engagement_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_metrics_collected ON public.engagement_metrics(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_opt_jobs_user ON public.optimization_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_opt_jobs_account ON public.optimization_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_sched_user ON public.scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_sched_time_status ON public.scheduled_posts(scheduled_time, status);
CREATE INDEX IF NOT EXISTS idx_recs_user ON public.recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_at ON public.auth_attempts(ip, at);

-- ====================================================================
-- Row-Level Security (RLS) Policies
-- Enforces that users can only read/write their own records
-- Admins have full read access
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- Social Accounts Policies
CREATE POLICY social_select ON public.social_accounts FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY social_insert ON public.social_accounts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY social_update ON public.social_accounts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY social_delete ON public.social_accounts FOR DELETE USING (user_id = auth.uid());

-- Posts Policies (Scoped via social_accounts)
CREATE POLICY posts_select ON public.posts FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.social_accounts a WHERE a.id = posts.account_id AND (a.user_id = auth.uid() OR public.is_admin()))
);
CREATE POLICY posts_insert ON public.posts FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.social_accounts a WHERE a.id = posts.account_id AND a.user_id = auth.uid())
);
CREATE POLICY posts_update ON public.posts FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.social_accounts a WHERE a.id = posts.account_id AND a.user_id = auth.uid())
);
CREATE POLICY posts_delete ON public.posts FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.social_accounts a WHERE a.id = posts.account_id AND a.user_id = auth.uid())
);

-- Optimization Jobs Policies
CREATE POLICY opt_select ON public.optimization_jobs FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY opt_insert ON public.optimization_jobs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY opt_update ON public.optimization_jobs FOR UPDATE USING (user_id = auth.uid());

-- Scheduled Posts Policies
CREATE POLICY sched_select ON public.scheduled_posts FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY sched_insert ON public.scheduled_posts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY sched_update ON public.scheduled_posts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY sched_delete ON public.scheduled_posts FOR DELETE USING (user_id = auth.uid());

-- Recommendations Policies
CREATE POLICY recs_select ON public.recommendations FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY recs_insert ON public.recommendations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY recs_update ON public.recommendations FOR UPDATE USING (user_id = auth.uid());

-- Notifications Policies
CREATE POLICY notif_select ON public.notifications FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY notif_update ON public.notifications FOR UPDATE USING (user_id = auth.uid());
