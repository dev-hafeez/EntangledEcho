import { describe, it, expect } from "vitest";
import { extractHandleFromInput, generateRealisticPostsForHandle, MockProvider } from "../src/lib/providers/mock";

describe("Mock & Seed Social Provider", () => {
  it("correctly cleans and extracts Instagram handles from various URL formats", () => {
    expect(extractHandleFromInput("https://www.instagram.com/tech_creator/")).toBe("tech_creator");
    expect(extractHandleFromInput("instagram.com/hafeez.codes?utm_source=ig")).toBe("hafeez.codes");
    expect(extractHandleFromInput("@creative_studio")).toBe("creative_studio");
    expect(extractHandleFromInput("just_a_handle")).toBe("just_a_handle");
  });

  it("generates deterministic realistic posts and metrics for a given handle", () => {
    const { account, posts } = generateRealisticPostsForHandle("growth_guru", 15);
    expect(account.handle).toBe("growth_guru");
    expect(account.platform).toBe("instagram");
    expect(account.follower_count).toBeGreaterThan(1000);
    expect(posts.length).toBe(15);

    const firstPost = posts[0];
    expect(firstPost.caption).toBeDefined();
    expect(firstPost.perf_score).toBeGreaterThanOrEqual(0);
    expect(firstPost.perf_score).toBeLessThanOrEqual(1);
    expect(firstPost.latest_metrics).toBeDefined();
    expect(firstPost.latest_metrics?.reach).toBeGreaterThan(0);
  });

  it("MockProvider satisfies the SocialProvider interface contract", async () => {
    const provider = new MockProvider();
    expect(provider.platform).toBe("instagram");

    const posts = await provider.fetchPosts("mock_token", 5);
    expect(posts.length).toBeGreaterThan(0);

    const audience = await provider.fetchAudience("mock_token");
    expect(audience.age["25-34"]).toBeDefined();
  });
});
