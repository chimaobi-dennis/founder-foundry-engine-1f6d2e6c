/**
 * Social audit from connections. When a task needs facts about the founder's
 * own accounts (followers, posts, engagement), Kinika reads them through the
 * kept OAuth connection instead of asking the founder to type them. One
 * reader per provider, one shape out (SocialSnapshot), and a data block for
 * the conversation where every number carries its source and read date.
 * The pure parts (engagement, the block) are shared with the browser.
 */

/** The oauth_providers keys that are social accounts. */
export const SOCIAL_PROVIDER_KEYS = ["meta", "tiktok", "linkedin", "x"] as const;

export function isSocialProviderKey(key: unknown): boolean {
  return typeof key === "string" && (SOCIAL_PROVIDER_KEYS as readonly string[]).includes(key);
}

export interface SocialPost { at: string | null; likes: number; comments: number; shares: number; views: number | null }

export interface SocialSnapshot {
  /** instagram · facebook · tiktok · x · linkedin */
  platform: string;
  /** The handle or page name. */
  account: string;
  followers: number | null;
  posts: number | null;
  /** The newest posts read (up to ten). */
  recent: SocialPost[];
  /** Average (likes + comments + shares) per recent post, as a share of followers, in percent. */
  engagement_rate: number | null;
  /** When nothing could be read beyond the account itself. */
  note: string | null;
  read_at: string;
}

/** Engagement rate in percent, one decimal; null when there is nothing to divide. */
export function engagementRate(recent: SocialPost[], followers: number | null): number | null {
  if (!recent.length || !followers || followers <= 0) return null;
  const per = recent.reduce((s, p) => s + p.likes + p.comments + p.shares, 0) / recent.length;
  return Math.round((per / followers) * 1000) / 10;
}

function avg(recent: SocialPost[], pick: (p: SocialPost) => number | null): number | null {
  const xs = recent.map(pick).filter((x): x is number => typeof x === "number");
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

const PLATFORM_NAME: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", x: "X", linkedin: "LinkedIn" };

/** The data lines Kinika is given. Labels, not instructions. */
export function snapshotBlock(snapshots: SocialSnapshot[], errors: { account: string; error: string }[] = []): string {
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const lines = snapshots.map((s) => {
    const name = PLATFORM_NAME[s.platform] ?? s.platform;
    const parts = [
      s.followers != null ? `${s.followers} followers` : "followers not shared by the platform",
      s.posts != null ? `${s.posts} posts` : null,
      s.recent.length ? `last ${s.recent.length} posts: on average ${avg(s.recent, (p) => p.likes) ?? 0} likes, ${avg(s.recent, (p) => p.comments) ?? 0} comments${avg(s.recent, (p) => p.shares) ? `, ${avg(s.recent, (p) => p.shares)} shares` : ""}${avg(s.recent, (p) => p.views) != null ? `, ${avg(s.recent, (p) => p.views)} views` : ""}` : "no recent posts read",
      s.engagement_rate != null ? `engagement rate ${s.engagement_rate}%` : null,
      s.note,
    ].filter(Boolean);
    return `- ${name} ${s.account} (read from the connection on ${date(s.read_at)}): ${parts.join("; ")}`;
  });
  for (const e of errors) lines.push(`- ${e.account}: could not be read (${e.error})`);
  return lines.join("\n");
}

// ── readers (server only) ────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any; // the providers' JSON, read field by field

async function getJson(url: string, token: string, init: RequestInit = {}): Promise<Loose> {
  const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(body?.error?.message ?? body?.error?.detail ?? body?.detail ?? body?.title ?? `${res.status}`).slice(0, 160));
  return body;
}

const n = (x: unknown): number => (Number.isFinite(Number(x)) ? Number(x) : 0);

async function readMeta(token: string, now: string): Promise<SocialSnapshot[]> {
  const out: SocialSnapshot[] = [];
  const pages = await getJson("https://graph.facebook.com/v21.0/me/accounts?fields=id,name,fan_count,followers_count,access_token,instagram_business_account{id,username,followers_count,media_count}&limit=10", token);
  for (const page of (pages.data ?? []) as Loose[]) {
    const pageToken = String(page.access_token ?? token);
    const posts = await getJson(`https://graph.facebook.com/v21.0/${page.id}/posts?fields=created_time,likes.summary(true),comments.summary(true),shares&limit=10`, pageToken).catch(() => ({ data: [] }));
    const recent: SocialPost[] = ((posts.data ?? []) as Loose[]).map((p) => ({ at: p.created_time ?? null, likes: n(p.likes?.summary?.total_count), comments: n(p.comments?.summary?.total_count), shares: n(p.shares?.count), views: null }));
    const followers = page.followers_count ?? page.fan_count ?? null;
    out.push({ platform: "facebook", account: String(page.name ?? page.id), followers: followers == null ? null : n(followers), posts: null, recent, engagement_rate: engagementRate(recent, followers == null ? null : n(followers)), note: null, read_at: now });
    const ig = page.instagram_business_account;
    if (ig?.id) {
      const media = await getJson(`https://graph.facebook.com/v21.0/${ig.id}/media?fields=timestamp,like_count,comments_count&limit=10`, pageToken).catch(() => ({ data: [] }));
      const igRecent: SocialPost[] = ((media.data ?? []) as Loose[]).map((m) => ({ at: m.timestamp ?? null, likes: n(m.like_count), comments: n(m.comments_count), shares: 0, views: null }));
      const igFollowers = ig.followers_count == null ? null : n(ig.followers_count);
      out.push({ platform: "instagram", account: ig.username ? `@${ig.username}` : String(ig.id), followers: igFollowers, posts: ig.media_count == null ? null : n(ig.media_count), recent: igRecent, engagement_rate: engagementRate(igRecent, igFollowers), note: null, read_at: now });
    }
  }
  if (!out.length) throw new Error("No Facebook page or Instagram business account is linked to this login.");
  return out;
}

async function readTikTok(token: string, now: string): Promise<SocialSnapshot[]> {
  const info = await getJson("https://open.tiktokapis.com/v2/user/info/?fields=display_name,username,follower_count,likes_count,video_count", token);
  const u = info.data?.user ?? {};
  const list = await getJson("https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,like_count,comment_count,share_count,view_count", token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ max_count: 10 }) }).catch(() => ({ data: { videos: [] } }));
  const recent: SocialPost[] = ((list.data?.videos ?? []) as Loose[]).map((v) => ({ at: v.create_time ? new Date(n(v.create_time) * 1000).toISOString() : null, likes: n(v.like_count), comments: n(v.comment_count), shares: n(v.share_count), views: v.view_count == null ? null : n(v.view_count) }));
  const followers = u.follower_count == null ? null : n(u.follower_count);
  return [{ platform: "tiktok", account: u.username ? `@${u.username}` : String(u.display_name ?? "account"), followers, posts: u.video_count == null ? null : n(u.video_count), recent, engagement_rate: engagementRate(recent, followers), note: null, read_at: now }];
}

async function readX(token: string, now: string): Promise<SocialSnapshot[]> {
  const me = await getJson("https://api.twitter.com/2/users/me?user.fields=public_metrics,username", token);
  const u = me.data ?? {};
  const tweets = await getJson(`https://api.twitter.com/2/users/${u.id}/tweets?max_results=10&tweet.fields=public_metrics,created_at`, token).catch(() => ({ data: [] }));
  const recent: SocialPost[] = ((tweets.data ?? []) as Loose[]).map((t) => ({ at: t.created_at ?? null, likes: n(t.public_metrics?.like_count), comments: n(t.public_metrics?.reply_count), shares: n(t.public_metrics?.retweet_count) + n(t.public_metrics?.quote_count), views: t.public_metrics?.impression_count == null ? null : n(t.public_metrics.impression_count) }));
  const followers = u.public_metrics?.followers_count == null ? null : n(u.public_metrics.followers_count);
  return [{ platform: "x", account: u.username ? `@${u.username}` : String(u.id ?? "account"), followers, posts: u.public_metrics?.tweet_count == null ? null : n(u.public_metrics.tweet_count), recent, engagement_rate: engagementRate(recent, followers), note: null, read_at: now }];
}

async function readLinkedIn(token: string, now: string): Promise<SocialSnapshot[]> {
  const me = await getJson("https://api.linkedin.com/v2/userinfo", token);
  return [{ platform: "linkedin", account: String(me.name ?? me.email ?? "profile"), followers: null, posts: null, recent: [], engagement_rate: null, note: "LinkedIn does not share a personal profile's follower count or post statistics through its API; connect a company page for those", read_at: now }];
}

/** Read one social connection with a usable token. Throws with a plain reason. */
export async function readSocialConnection(providerKey: string, token: string, now = new Date().toISOString()): Promise<SocialSnapshot[]> {
  switch (providerKey) {
    case "meta": return readMeta(token, now);
    case "tiktok": return readTikTok(token, now);
    case "x": return readX(token, now);
    case "linkedin": return readLinkedIn(token, now);
    default: throw new Error(`${providerKey} is not a social account`);
  }
}
