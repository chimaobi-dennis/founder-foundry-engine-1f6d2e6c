import { describe, it, expect } from "vitest";
import { engagementRate, snapshotBlock, isSocialProviderKey, type SocialSnapshot } from "@shared/socialRead";

const ig: SocialSnapshot = { platform: "instagram", account: "@bakery", followers: 400, posts: 52, recent: [{ at: null, likes: 10, comments: 2, shares: 0, views: null }, { at: null, likes: 14, comments: 4, shares: 0, views: null }], engagement_rate: 3.8, note: null, read_at: "2026-10-30T10:00:00Z" };

describe("social audit from connections", () => {
  it("knows which providers are social accounts", () => {
    expect(isSocialProviderKey("meta")).toBe(true);
    expect(isSocialProviderKey("google")).toBe(false);
    expect(isSocialProviderKey(undefined)).toBe(false);
  });
  it("computes engagement as a share of followers, one decimal", () => {
    expect(engagementRate(ig.recent, 400)).toBe(3.8);
    expect(engagementRate(ig.recent, null)).toBeNull();
    expect(engagementRate([], 400)).toBeNull();
  });
  it("writes each account with its source and read date", () => {
    const block = snapshotBlock([ig, { platform: "linkedin", account: "Anna", followers: null, posts: null, recent: [], engagement_rate: null, note: "LinkedIn does not share it", read_at: "2026-10-30T10:00:00Z" }], [{ account: "TikTok", error: "token expired" }]);
    expect(block).toBe([
      "- Instagram @bakery (read from the connection on 30 October 2026): 400 followers; 52 posts; last 2 posts: on average 12 likes, 3 comments; engagement rate 3.8%",
      "- LinkedIn Anna (read from the connection on 30 October 2026): followers not shared by the platform; no recent posts read; LinkedIn does not share it",
      "- TikTok: could not be read (token expired)",
    ].join("\n"));
  });
});
