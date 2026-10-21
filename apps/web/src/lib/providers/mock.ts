import { Post, SocialAccount, EngagementMetric } from "@/types";
import { SocialProvider } from "./social";

export function extractHandleFromInput(input: string): string {
  let cleaned = input.trim();
  // Strip URL prefix
  cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, "");
  // Strip trailing slashes, queries, hashes
  cleaned = cleaned.replace(/[/?#].*$/, "");
  // Strip leading @
  cleaned = cleaned.replace(/^@/, "");
  return cleaned || "creator";
}

export function generateRealisticPostsForHandle(handle: string, count: number = 24): { account: SocialAccount; posts: Post[] } {
  // Deterministic pseudo-random seed based on handle string
  let seed = 0;
  for (let i = 0; i < handle.length; i++) {
    seed = (seed * 31 + handle.charCodeAt(i)) & 0xffffffff;
  }
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  };

  const followerCount = Math.floor(1500 + rand() * 48000);
  const mediaCount = Math.floor(count + rand() * 80);

  const account: SocialAccount = {
    id: `acc_${handle}`,
    user_id: "demo-user-1",
    platform: "instagram",
    external_id: `ig_${handle}_${Math.floor(rand() * 100000)}`,
    handle: handle,
    avatar_url: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
    follower_count: followerCount,
    following_count: Math.floor(250 + rand() * 600),
    media_count: mediaCount,
    last_sync: new Date().toISOString(),
    status: "active",
    is_synthetic: true,
  };

  const sampleTopics = [
    { topic: "Productivity", tags: ["#productivity", "#timemanagement", "#workflow", "#growth"] },
    { topic: "AI Tools", tags: ["#ai", "#machinelearning", "#techtips", "#automation"] },
    { topic: "Content Creation", tags: ["#creatoreconomy", "#socialmediatips", "#contentstrategy", "#digitalmarketing"] },
    { topic: "Behind The Scenes", tags: ["#buildinpublic", "#founderlife", "#dayinmylife", "#startup"] },
    { topic: "Design & UX", tags: ["#designthinking", "#uidesign", "#minimalism", "#visuals"] },
  ];

  const captions = [
    "5 quantum leaps that revolutionized our content strategy this month. Which one are you testing next?",
    "Stop posting at random hours. Here is what happened when we aligned with audience activity peaks.",
    "Behind the scenes of our AI-driven workflow. Saves 12 hours every single week.",
    "The single biggest mistake creators make with carousels vs short-form video in 2026.",
    "Deep dive into engagement optimization: why high saves matter 5x more than casual likes.",
    "Simple template we use to decompose a 30-day campaign into daily atomic posts.",
    "Consistency without strategy is just noise. Test, measure, and optimize.",
    "How to maintain brand aesthetics while boosting algorithmic reach.",
  ];

  const mediaTypes: ("reel" | "carousel" | "image")[] = ["reel", "carousel", "image"];
  const stockImages = [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1618172193763-c511deb635ca?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80",
  ];

  const now = Date.now();
  const posts: Post[] = [];

  for (let i = 0; i < count; i++) {
    const topicObj = sampleTopics[Math.floor(rand() * sampleTopics.length)];
    const mType = mediaTypes[Math.floor(rand() * mediaTypes.length)];
    // Multipliers: reels perform best, then carousel, then image
    const typeMultiplier = mType === "reel" ? 1.4 : mType === "carousel" ? 1.15 : 0.85;

    // Post time spaced out across historical days
    const postAgeDays = i * 2.5 + rand() * 1.5;
    const postDate = new Date(now - postAgeDays * 86400000);

    // Peak time multiplier (e.g. 18:00 - 21:00 weekday boost)
    const hour = postDate.getHours();
    const day = postDate.getDay();
    const isPeakHour = (hour >= 17 && hour <= 21) || (hour >= 11 && hour <= 13);
    const timeMultiplier = isPeakHour ? 1.35 : 0.8;

    const baseReach = Math.floor(followerCount * (0.15 + rand() * 0.4) * typeMultiplier * timeMultiplier);
    const reach = Math.max(120, baseReach);
    const likes = Math.max(10, Math.floor(reach * (0.04 + rand() * 0.06)));
    const comments = Math.max(1, Math.floor(likes * (0.05 + rand() * 0.12)));
    const saves = Math.max(2, Math.floor(likes * (0.15 + rand() * 0.3)));
    const shares = Math.max(1, Math.floor(likes * (0.08 + rand() * 0.2)));

    // Weighted engagement score (FR-16): likes*1 + comments*3 + shares*5 + saves*4
    const weightedEng = likes * 1.0 + comments * 3.0 + shares * 5.0 + saves * 4.0;
    const perfScoreRaw = weightedEng / Math.max(reach, 1);
    // Normalize into 0 to 1 score
    const perfScore = Math.min(1.0, Math.max(0.1, Number((perfScoreRaw * 2.8).toFixed(3))));

    const postId = `post_${handle}_${i + 1}`;
    const metric: EngagementMetric = {
      id: `metric_${postId}`,
      post_id: postId,
      likes,
      comments,
      shares,
      saves,
      reach,
      views: Math.floor(reach * (1.1 + rand() * 0.5)),
      impressions: Math.floor(reach * 1.3),
      collected_at: new Date(postDate.getTime() + 48 * 3600000).toISOString(),
    };

    posts.push({
      id: postId,
      account_id: account.id,
      external_id: `ig_post_${i + 100}`,
      caption: captions[i % captions.length] + ` Let's discuss in the comments below!`,
      hashtags: topicObj.tags,
      media_type: mType,
      media_url: stockImages[i % stockImages.length],
      permalink: `https://instagram.com/p/${handle}_${i + 1}`,
      posted_at: postDate.toISOString(),
      perf_score: perfScore,
      topics: [topicObj.topic],
      sentiment: Number((0.25 + rand() * 0.6).toFixed(2)),
      latest_metrics: metric,
    });
  }

  return { account, posts };
}

export class MockProvider implements SocialProvider {
  platform: "instagram" = "instagram";

  getAuthUrl(state: string): string {
    return `http://localhost:3000/api/auth/mock-callback?state=${state}`;
  }

  async exchangeCode(_code: string) {
    return {
      accessToken: "mock-access-token-xyz-123",
      expiresIn: 5184000,
      externalId: "mock-external-id-12345",
    };
  }

  async refreshToken(_token: string) {
    return {
      accessToken: "mock-refreshed-token-456",
      expiresIn: 5184000,
    };
  }

  async fetchProfile(_accessToken: string): Promise<Partial<SocialAccount>> {
    return {
      platform: "instagram",
      handle: "entangled_echo_official",
      follower_count: 14200,
      following_count: 480,
      media_count: 86,
      status: "active",
      is_synthetic: true,
    };
  }

  async fetchPosts(_accessToken: string, limit = 20): Promise<Post[]> {
    const { posts } = generateRealisticPostsForHandle("entangled_echo_official", limit);
    return posts;
  }

  async fetchPostInsights(_accessToken: string, postId: string): Promise<EngagementMetric> {
    return {
      id: `metric_${postId}`,
      post_id: postId,
      likes: 642,
      comments: 78,
      shares: 114,
      saves: 205,
      reach: 5800,
      views: 7200,
      collected_at: new Date().toISOString(),
    };
  }

  async fetchAudience(_accessToken: string) {
    return {
      age: { "18-24": 28, "25-34": 46, "35-44": 18, "45-54": 6, "55+": 2 },
      gender: { female: 52, male: 45, custom: 3 },
      location: { "United States": 35, "United Kingdom": 18, "Pakistan": 15, "Germany": 12, "Canada": 10 },
    };
  }

  async publish(_accessToken: string, _post: { caption: string; mediaUrl: string }) {
    return { platformPostId: `mock_published_${Date.now()}` };
  }

  async businessDiscovery(targetHandle: string) {
    return {
      followers: 28400,
      mediaCount: 142,
      recentLikes: 940,
      recentComments: 64,
    };
  }
}
