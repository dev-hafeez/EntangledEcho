import { Platform, Post, SocialAccount, MediaType } from "@/types";

export function extractHandleFromInput(input: string): { handle: string; detectedPlatform: Platform } {
  if (!input) return { handle: "", detectedPlatform: "instagram" };
  let clean = input.trim();
  let detectedPlatform: Platform = "instagram";
  if (/facebook\.com/i.test(clean)) {
    detectedPlatform = "facebook";
  }
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, "");
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?facebook\.com\//i, "");
  clean = clean.split("?")[0].split("#")[0].replace(/\/+$/, "").replace(/^@+/, "");
  return { handle: clean.trim(), detectedPlatform };
}

export function generateRealisticPostsForHandle(
  handle: string,
  platform: Platform = "instagram",
  count: number = 24
): { account: SocialAccount; posts: Post[] } {
  const { handle: cleanHandle } = extractHandleFromInput(handle);
  const finalHandle = cleanHandle || "creator";
  const now = new Date();

  const account: SocialAccount = {
    id: `acc_mock_${finalHandle}`,
    user_id: "demo-user-1",
    platform,
    external_id: `mock_${finalHandle}`,
    handle: finalHandle,
    avatar_url: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
    follower_count: 14500,
    following_count: 420,
    media_count: count,
    last_sync: now.toISOString(),
    status: "active",
    is_synthetic: true,
  };

  const sampleCaptions = [
    "Exploring new creative directions today ✨ What do you think?",
    "Behind the scenes of our latest project 🚀 Big announcements soon!",
    "Sharing three simple tips that transformed our workflow this week 👇",
    "Consistency is key, but adaptability is the real superpower 💡",
    "Late night studio sessions hits different 🎧",
    "Weekend recap: Good vibes, good company, and great inspiration 🌟",
  ];

  const mediaTypes: MediaType[] = ["reel", "carousel", "image", "video"];

  const posts: Post[] = Array.from({ length: count }, (_, i) => {
    const postDate = new Date(now.getTime() - i * 86400000 * 1.5);
    const likes = Math.floor(400 + Math.random() * 2500);
    const comments = Math.floor(likes * (0.04 + Math.random() * 0.05));
    const shares = Math.floor(likes * 0.12);
    const saves = Math.floor(likes * 0.18);
    const reach = Math.floor(likes * 3.5);

    return {
      id: `mock_post_${cleanHandle}_${i + 1}`,
      account_id: account.id,
      external_id: `https://instagram.com/p/mock_${cleanHandle}_${i + 1}`,
      caption: sampleCaptions[i % sampleCaptions.length],
      hashtags: ["#creative", "#contentcreator", "#growth", "#inspiration"],
      media_type: mediaTypes[i % mediaTypes.length],
      media_url: `https://picsum.photos/seed/${cleanHandle}_${i}/800/800`,
      permalink: `https://instagram.com/p/mock_${cleanHandle}_${i + 1}`,
      posted_at: postDate.toISOString(),
      perf_score: Number((0.65 + Math.random() * 0.3).toFixed(2)),
      topics: ["Creative Growth", "Behind The Scenes"],
      sentiment: 0.6,
      latest_metrics: {
        id: `metric_${cleanHandle}_${i + 1}`,
        post_id: `mock_post_${cleanHandle}_${i + 1}`,
        likes,
        comments,
        shares,
        saves,
        reach,
        views: Math.floor(reach * 1.2),
        impressions: Math.floor(reach * 1.4),
        collected_at: now.toISOString(),
      },
    };
  });

  return { account, posts };
}
