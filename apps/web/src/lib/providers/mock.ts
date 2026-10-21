import { Post, SocialAccount, EngagementMetric, Platform } from "@/types";
import { SocialProvider } from "./social";

export function extractHandleFromInput(input: string): { handle: string; detectedPlatform: Platform } {
  let cleaned = input.trim();
  let detectedPlatform: Platform = "instagram";

  if (/facebook\.com|fb\.com/i.test(cleaned)) {
    detectedPlatform = "facebook";
    cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com)\//i, "");
  } else {
    cleaned = cleaned.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, "");
  }

  // Strip trailing slashes, queries, hashes
  cleaned = cleaned.replace(/[/?#].*$/, "");
  // Strip leading @
  cleaned = cleaned.replace(/^@/, "");

  return {
    handle: cleaned || (detectedPlatform === "facebook" ? "brand_page" : "creator"),
    detectedPlatform,
  };
}

export function generateRealisticPostsForHandle(
  handle: string,
  platform: Platform = "instagram",
  count: number = 24
): { account: SocialAccount; posts: Post[] } {
  // Deterministic pseudo-random seed based on handle string + platform
  let seed = platform === "facebook" ? 1337 : 42;
  for (let i = 0; i < handle.length; i++) {
    seed = (seed * 31 + handle.charCodeAt(i)) & 0xffffffff;
  }
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  };

  const followerCount = Math.floor(1800 + rand() * 52000);
  const mediaCount = Math.floor(count + rand() * 85);

  const account: SocialAccount = {
    id: `acc_${platform}_${handle}`,
    user_id: "demo-user-1",
    platform,
    external_id: `${platform === "facebook" ? "fb" : "ig"}_${handle}_${Math.floor(rand() * 100000)}`,
    handle: handle,
    avatar_url:
      platform === "facebook"
        ? "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80"
        : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    follower_count: followerCount,
    following_count: platform === "facebook" ? Math.floor(50 + rand() * 120) : Math.floor(250 + rand() * 600),
    media_count: mediaCount,
    last_sync: new Date().toISOString(),
    status: "active",
    is_synthetic: true,
  };

  const sampleTopics = [
    { topic: "Productivity", tags: ["#productivity", "#timemanagement", "#workflow", "#growth"] },
    { topic: "AI & Automation", tags: ["#ai", "#machinelearning", "#techtips", "#automation"] },
    { topic: "Audience Growth", tags: ["#creatoreconomy", "#socialmediatips", "#contentstrategy", "#digitalmarketing"] },
    { topic: "Behind The Scenes", tags: ["#buildinpublic", "#founderlife", "#behindthescenes", "#startup"] },
    { topic: "Design & UX", tags: ["#designthinking", "#uidesign", "#minimalism", "#visuals"] },
  ];

  const captions =
    platform === "facebook"
      ? [
          "Join our live community discussion: How are you implementing AI scheduling in your weekly workflow?",
          "Update for our page followers: 3 high-impact strategies that doubled organic engagement this quarter.",
          "We just published our in-depth case study on content optimization. Read the breakdown below!",
          "Question for creators and small business owners: Which metric matters more to you — Reach or Shares?",
          "New video walkthrough: Behind the scenes of our latest campaign launch and key analytics takeaways.",
          "5 lessons we learned building digital products in public. Let us know your thoughts in the comments!",
        ]
      : [
          "5 quantum leaps that revolutionized our content strategy this month. Which one are you testing next?",
          "Stop posting at random hours. Here is what happened when we aligned with audience activity peaks.",
          "Behind the scenes of our AI-driven workflow. Saves 12 hours every single week.",
          "The single biggest mistake creators make with carousels vs short-form video in 2026.",
          "Deep dive into engagement optimization: why high saves matter 5x more than casual likes.",
          "Simple template we use to decompose a 30-day campaign into daily atomic posts.",
        ];

  const mediaTypes: ("reel" | "carousel" | "image" | "video")[] =
    platform === "facebook" ? ["video", "image", "carousel"] : ["reel", "carousel", "image"];

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
    const typeMultiplier = mType === "reel" || mType === "video" ? 1.35 : mType === "carousel" ? 1.2 : 0.85;

    const postAgeDays = i * 2.5 + rand() * 1.5;
    const postDate = new Date(now - postAgeDays * 86400000);

    const hour = postDate.getHours();
    const isPeakHour = (hour >= 17 && hour <= 21) || (hour >= 11 && hour <= 13);
    const timeMultiplier = isPeakHour ? 1.3 : 0.8;

    const baseReach = Math.floor(followerCount * (0.15 + rand() * 0.4) * typeMultiplier * timeMultiplier);
    const reach = Math.max(120, baseReach);

    // Platform-specific engagement weighting
    const likes = Math.max(12, Math.floor(reach * (0.04 + rand() * 0.05)));
    const comments = Math.max(2, Math.floor(likes * (platform === "facebook" ? 0.12 : 0.08)));
    const shares = Math.max(1, Math.floor(likes * (platform === "facebook" ? 0.22 : 0.1)));
    const saves = Math.max(2, Math.floor(likes * (platform === "facebook" ? 0.08 : 0.25)));

    // FR-16 weighted scoring: likes*1 + comments*3 + shares*5 + saves*4
    const weightedEng = likes * 1.0 + comments * 3.0 + shares * 5.0 + saves * 4.0;
    const perfScoreRaw = weightedEng / Math.max(reach, 1);
    const perfScore = Math.min(1.0, Math.max(0.1, Number((perfScoreRaw * 2.8).toFixed(3))));

    const postId = `post_${platform}_${handle}_${i + 1}`;
    const metric: EngagementMetric = {
      id: `metric_${postId}`,
      post_id: postId,
      likes,
      comments,
      shares,
      saves,
      reach,
      views: Math.floor(reach * (1.15 + rand() * 0.4)),
      impressions: Math.floor(reach * 1.35),
      collected_at: new Date(postDate.getTime() + 48 * 3600000).toISOString(),
    };

    posts.push({
      id: postId,
      account_id: account.id,
      external_id: `${platform}_post_${i + 100}`,
      caption: captions[i % captions.length] + ` (Shared on ${platform === "facebook" ? "Facebook Page" : "Instagram"})`,
      hashtags: topicObj.tags,
      media_type: mType,
      media_url: stockImages[i % stockImages.length],
      permalink:
        platform === "facebook"
          ? `https://facebook.com/${handle}/posts/${i + 1000}`
          : `https://instagram.com/p/${handle}_${i + 1}`,
      posted_at: postDate.toISOString(),
      perf_score: perfScore,
      topics: [topicObj.topic],
      sentiment: Number((0.3 + rand() * 0.5).toFixed(2)),
      latest_metrics: metric,
    });
  }

  return { account, posts };
}

export class MockInstagramProvider implements SocialProvider {
  platform: "instagram" = "instagram";

  getAuthUrl(state: string): string {
    return `http://localhost:3000/api/auth/mock-callback?platform=instagram&state=${state}`;
  }

  async exchangeCode(_code: string) {
    return {
      accessToken: "mock-ig-access-token-123",
      expiresIn: 5184000,
      externalId: "mock-ig-external-id",
    };
  }

  async refreshToken(_token: string) {
    return { accessToken: "mock-ig-refreshed-token", expiresIn: 5184000 };
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
    const { posts } = generateRealisticPostsForHandle("entangled_echo_official", "instagram", limit);
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
    return { platformPostId: `mock_ig_published_${Date.now()}` };
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

export class MockFacebookProvider implements SocialProvider {
  platform: "facebook" = "facebook";

  getAuthUrl(state: string): string {
    return `http://localhost:3000/api/auth/mock-callback?platform=facebook&state=${state}`;
  }

  async exchangeCode(_code: string) {
    return {
      accessToken: "mock-fb-access-token-456",
      expiresIn: 5184000,
      externalId: "mock-fb-page-id",
    };
  }

  async refreshToken(_token: string) {
    return { accessToken: "mock-fb-refreshed-token", expiresIn: 5184000 };
  }

  async fetchProfile(_accessToken: string): Promise<Partial<SocialAccount>> {
    return {
      platform: "facebook",
      handle: "entangled_echo_page",
      follower_count: 22400,
      following_count: 85,
      media_count: 112,
      status: "active",
      is_synthetic: true,
    };
  }

  async fetchPosts(_accessToken: string, limit = 20): Promise<Post[]> {
    const { posts } = generateRealisticPostsForHandle("entangled_echo_page", "facebook", limit);
    return posts;
  }

  async fetchPostInsights(_accessToken: string, postId: string): Promise<EngagementMetric> {
    return {
      id: `metric_${postId}`,
      post_id: postId,
      likes: 890,
      comments: 135,
      shares: 310,
      saves: 85,
      reach: 12400,
      views: 14800,
      collected_at: new Date().toISOString(),
    };
  }

  async fetchAudience(_accessToken: string) {
    return {
      age: { "18-24": 15, "25-34": 42, "35-44": 26, "45-54": 12, "55+": 5 },
      gender: { female: 49, male: 48, custom: 3 },
      location: { "United States": 40, "Pakistan": 20, "United Kingdom": 15, "Canada": 15, "Germany": 10 },
    };
  }

  async publish(_accessToken: string, _post: { caption: string; mediaUrl: string }) {
    return { platformPostId: `mock_fb_published_${Date.now()}` };
  }

  async businessDiscovery(targetHandle: string) {
    return {
      followers: 35000,
      mediaCount: 210,
      recentLikes: 1250,
      recentComments: 180,
    };
  }
}

// Backward-compatible default export
export { MockInstagramProvider as MockProvider };
