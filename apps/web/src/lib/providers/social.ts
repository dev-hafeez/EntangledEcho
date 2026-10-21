import { Post, SocialAccount, EngagementMetric } from "@/types";

export interface SocialProvider {
  platform: "instagram" | "facebook";
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string; expiresIn: number; externalId: string }>;
  refreshToken(token: string): Promise<{ accessToken: string; expiresIn: number }>;
  fetchProfile(accessToken: string): Promise<Partial<SocialAccount>>;
  fetchPosts(accessToken: string, limit?: number): Promise<Post[]>;
  fetchPostInsights(accessToken: string, postId: string): Promise<EngagementMetric>;
  fetchAudience(accessToken: string): Promise<{ age: Record<string, number>; gender: Record<string, number>; location: Record<string, number> }>;
  publish(accessToken: string, post: { caption: string; mediaUrl: string }): Promise<{ platformPostId: string }>;
  businessDiscovery(targetHandle: string): Promise<{ followers: number; mediaCount: number; recentLikes: number; recentComments: number }>;
}
