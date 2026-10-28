-- ====================================================================
-- Entangled Echo: Complete Supabase Production Schema Migration
-- Includes SRDS Section 5.3 (ERD), Architectural Decisions, and Crawler Data Pool
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
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
    external_id TEXT NOT NULL,
    handle TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    follower_count BIGINT DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    access_token_enc TEXT,
    refresh_token_enc TEXT,
    token_expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'needs_reauth', 'disconnected')),
    is_synthetic BOOLEAN DEFAULT FALSE,
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(platform, external_id)
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
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT NOT NULL,
    platform TEXT DEFAULT 'instagram',
    followers BIGINT DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    public_engagement_rate REAL,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(platform, handle)
);

-- 8. Persistent Scraped Profiles Pool (Fast Ingestion & Multi-Creator Storage)
CREATE TABLE IF NOT EXISTS public.scraped_profiles (
    handle TEXT PRIMARY KEY,
    platform TEXT DEFAULT 'instagram',
    followers BIGINT DEFAULT 0,
    following INTEGER DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    avatar_url TEXT,
    bio TEXT,
    niche TEXT,
    niche_info JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    last_scraped_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 9. Persistent Scraped Posts Pool
CREATE TABLE IF NOT EXISTS public.scraped_posts (
    id TEXT PRIMARY KEY,
    handle TEXT NOT NULL REFERENCES public.scraped_profiles(handle) ON DELETE CASCADE,
    post_url TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT DEFAULT 'image',
    caption TEXT,
    hashtags JSONB DEFAULT '[]'::jsonb,
    posted_at TIMESTAMPTZ,
    posted_at_is_real INTEGER DEFAULT 0,
    perf_score REAL,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    is_real_metrics INTEGER DEFAULT 0,
    sentiment REAL DEFAULT 0.5,
    topics JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    UNIQUE(handle, post_url)
);

-- 10. Optimization Jobs Table (FR-17..20, QUBO Engine)
CREATE TABLE IF NOT EXISTS public.optimization_jobs (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
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

-- 11. Content Strategies & Marketing Goals (FR-22, UC07)
CREATE TABLE IF NOT EXISTS public.content_strategies (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT,
    goal TEXT NOT NULL,
    platform TEXT DEFAULT 'instagram',
    horizon_days INTEGER DEFAULT 14,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 12. Decomposed Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    strategy_id TEXT REFERENCES public.content_strategies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT,
    title TEXT NOT NULL,
    description TEXT,
    media_type TEXT DEFAULT 'REEL',
    due_date DATE,
    priority TEXT DEFAULT 'HIGH' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 13. Scheduled Posts Table (FR-25..28, State Machine)
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT,
    title TEXT,
    caption TEXT,
    hashtags JSONB DEFAULT '[]'::jsonb,
    media_type TEXT DEFAULT 'image',
    media_url TEXT,
    day_of_week TEXT,
    time_slot TEXT,
    scheduled_time TIMESTAMPTZ,
    status TEXT DEFAULT 'SCHEDULED' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED')),
    last_error TEXT,
    retry_count INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 14. Recommendations Table (FR-21..24, Algorithm 2)
CREATE TABLE IF NOT EXISTS public.recommendations (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    handle TEXT,
    type TEXT NOT NULL CHECK (type IN ('caption', 'schedule', 'content_type')),
    content JSONB NOT NULL,
    confidence_score REAL,
    accepted BOOLEAN,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 15. Creator Preference Weights (FR-24 Feedback Loop)
CREATE TABLE IF NOT EXISTS public.creator_preferences (
    handle TEXT PRIMARY KEY,
    preferred_media_types JSONB,
    preferred_hashtag_clusters JSONB,
    preferred_tone TEXT DEFAULT 'ENGAGING',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 16. Notifications Table (FR-33..35, UC08)
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('REMINDER', 'PUBLISH_SUCCESS', 'PUBLISH_FAIL', 'MILESTONE', 'AI_INSIGHT')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 17. Notification Preferences (D8 Deliverable)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email_reminders BOOLEAN DEFAULT TRUE,
    in_app_reminders BOOLEAN DEFAULT TRUE,
    email_digest BOOLEAN DEFAULT TRUE,
    milestone_alerts BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 18. Auth Rate Limiting (SRDS 4.2.5)
CREATE TABLE IF NOT EXISTS public.auth_attempts (
    ip INET NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ====================================================================
-- Indexes for High-Speed Lookups and Joins
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_scraped_profiles_followers ON public.scraped_profiles(followers DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_posts_handle ON public.scraped_posts(handle);
CREATE INDEX IF NOT EXISTS idx_scraped_posts_posted_at ON public.scraped_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_user ON public.social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_account ON public.posts(account_id);
CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON public.posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_post ON public.engagement_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_opt_jobs_user ON public.optimization_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_sched_user ON public.scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_sched_time_status ON public.scheduled_posts(scheduled_time, status);
CREATE INDEX IF NOT EXISTS idx_recs_user ON public.recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user_read ON public.notifications(user_id, read);

-- ====================================================================
-- Enable Row-Level Security (RLS) & Grant Service Role Access
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Scraped Profiles & Posts: Readable by all, manageable by service role / admin
CREATE POLICY "Public read scraped_profiles" ON public.scraped_profiles FOR SELECT USING (true);
CREATE POLICY "Full access scraped_profiles" ON public.scraped_profiles FOR ALL USING (auth.role() = 'service_role' OR public.is_admin());

CREATE POLICY "Public read scraped_posts" ON public.scraped_posts FOR SELECT USING (true);
CREATE POLICY "Full access scraped_posts" ON public.scraped_posts FOR ALL USING (auth.role() = 'service_role' OR public.is_admin());

CREATE POLICY "Public read creator_preferences" ON public.creator_preferences FOR SELECT USING (true);
CREATE POLICY "Full access creator_preferences" ON public.creator_preferences FOR ALL USING (auth.role() = 'service_role' OR public.is_admin());

-- User Scoped Tables:
CREATE POLICY "Profiles access" ON public.profiles FOR ALL USING (id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Social accounts access" ON public.social_accounts FOR ALL USING (user_id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Posts access" ON public.posts FOR ALL USING (auth.role() = 'service_role' OR public.is_admin() OR EXISTS (SELECT 1 FROM public.social_accounts a WHERE a.id = posts.account_id AND a.user_id = auth.uid()));
CREATE POLICY "Engagement metrics access" ON public.engagement_metrics FOR ALL USING (auth.role() = 'service_role' OR public.is_admin() OR true);
CREATE POLICY "Optimization jobs access" ON public.optimization_jobs FOR ALL USING (user_id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role' OR user_id IS NULL);
CREATE POLICY "Content strategies access" ON public.content_strategies FOR ALL USING (user_id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role' OR user_id IS NULL);
CREATE POLICY "Tasks access" ON public.tasks FOR ALL USING (user_id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role' OR user_id IS NULL);
CREATE POLICY "Scheduled posts access" ON public.scheduled_posts FOR ALL USING (user_id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role' OR user_id IS NULL);
CREATE POLICY "Recommendations access" ON public.recommendations FOR ALL USING (user_id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role' OR user_id IS NULL);
CREATE POLICY "Notifications access" ON public.notifications FOR ALL USING (user_id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role');
CREATE POLICY "Notification preferences access" ON public.notification_preferences FOR ALL USING (user_id = auth.uid() OR public.is_admin() OR auth.role() = 'service_role');
