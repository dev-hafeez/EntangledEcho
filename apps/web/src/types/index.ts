export type Platform = "instagram" | "facebook";

export type MediaType = "image" | "video" | "carousel" | "story" | "reel";

export type ScheduledPostStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export type OptimizationJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface Profile {
  id: string;
  display_name: string | null;
  bio: string | null;
  role: "user" | "admin";
  suspended: boolean;
  timezone: string;
  created_at: string;
}

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: Platform;
  external_id: string;
  handle: string;
  avatar_url?: string;
  follower_count?: number;
  following_count?: number;
  media_count?: number;
  access_token_enc?: string;
  token_expiry?: string;
  last_sync: string | null;
  status: "active" | "needs_reauth" | "disabled";
  is_synthetic: boolean;
}

export interface EngagementMetric {
  id: string;
  post_id: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  views?: number | null;
  impressions?: number | null;
  collected_at: string;
}

export interface Post {
  id: string;
  account_id: string;
  external_id: string;
  caption: string;
  hashtags: string[];
  media_type: MediaType;
  media_url?: string;
  permalink: string;
  posted_at: string;
  perf_score: number | null; // 0 to 1 normalized
  topics: string[];
  sentiment: number | null; // -1 to 1 VADER compound
  latest_metrics?: EngagementMetric;
}

export interface ScheduledPost {
  id: string;
  user_id: string;
  account_id: string;
  caption: string;
  hashtags: string[];
  media_path: string | null;
  media_type: MediaType;
  scheduled_at: string;
  status: ScheduledPostStatus;
  retry_count: number;
  next_retry_at: string | null;
  platform_post_id: string | null;
  last_error: string | null;
  task_id?: string | null;
}

export interface TimeSlot {
  day_of_week: number; // 0=Mon, 6=Sun
  hour: number; // 0-23
  confidence: number;
  score: number;
}

export interface OptimizationResult {
  primary_schedule: TimeSlot[];
  alternatives: TimeSlot[][];
  overall_confidence: number;
  horizon_days: number;
  solver: "QUBO_SimulatedAnnealing" | "seed_prior";
}

export interface OptimizationJob {
  id: string;
  user_id: string;
  account_id: string;
  horizon_days: number;
  constraints: {
    blackout_hours?: number[];
    max_posts_per_week?: number;
    min_gap_hours?: number;
    platforms?: Platform[];
  };
  status: OptimizationJobStatus;
  result: OptimizationResult | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface Recommendation {
  id: string;
  user_id: string;
  account_id: string;
  job_id?: string | null;
  type: "caption" | "schedule" | "content_type";
  content: {
    captions?: { text: string; hashtags: string[]; tone: string }[];
    recommended_slots?: TimeSlot[];
    media_rankings?: { type: MediaType; mean_score: number; sample_size: number; reason: string }[];
  };
  confidence: number;
  accepted?: boolean | null;
  feedback?: string | null;
  created_at: string;
}

export interface Competitor {
  id: string;
  user_id: string;
  platform: Platform;
  handle: string;
  metrics: {
    followers?: number;
    media_count?: number;
    avg_likes?: number;
    avg_comments?: number;
  };
  last_fetched: string;
}
