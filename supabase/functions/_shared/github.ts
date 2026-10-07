/**
 * GitHub adapter for code connections, plus the pure path-policy helpers
 * (shared with the frontend and the tests).
 *
 * Policy, enforced here regardless of what a model proposes:
 *   - writes only under the connection's allowed paths
 *   - never to protected paths (secrets, CI, lockfiles, dependencies)
 *   - never to the default branch: every change is a branch + pull request
 *   - bounded: max files per PR, max file size
 */

export const PROTECTED_PATHS = [
  ".env", ".env.*", "**/.env", "**/.env.*",
  ".github/**", ".gitlab-ci.yml", ".circleci/**",
  "**/node_modules/**", "**/*.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  "**/*.pem", "**/*.key", "**/*.p12", "**/secrets/**",
  "supabase/migrations/**",
];

export const DEFAULT_ALLOWED_PATHS = ["src/**", "app/**", "components/**", "pages/**", "public/**", "content/**", "styles/**", "*.md", "*.css", "*.html"];

export const MAX_FILES_PER_PR = 12;
export const MAX_FILE_BYTES = 120_000;
export const MAX_SNAPSHOT_FILES = 400;

/** Minimal glob → RegExp: `**` any depth, `*` within a segment, `?` one char. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  const g = glob.trim().replace(/^\.\//, "");
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        // "**/" matches zero or more directories; "**" alone matches anything
        if (g[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") re += "[^/]";
    else if (".+^${}()|[]\\".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(path: string, globs: string[]): boolean {
  const p = path.replace(/^\.?\//, "");
  return globs.some((g) => globToRegExp(g).test(p));
}

export function isProtectedPath(path: string): boolean {
  return matchesAny(path, PROTECTED_PATHS);
}

/** The single policy check for a write. Returns a reason when refused. */
export function pathWriteVerdict(path: string, allowed: string[]): { ok: true } | { ok: false; reason: string } {
  const p = path.replace(/^\.?\//, "");
  if (!p || p.includes("..") || p.startsWith("/")) return { ok: false, reason: "invalid path" };
  if (isProtectedPath(p)) return { ok: false, reason: "protected path (secrets, CI, lockfiles, migrations)" };
  if (!matchesAny(p, allowed.length ? allowed : DEFAULT_ALLOWED_PATHS)) return { ok: false, reason: "outside the paths this connection allows" };
  return { ok: true };
}

export interface RepoFile {
  path: string;
  size: number;
}

export interface FileContent {
  path: string;
  content: string;
  sha: string;
}

export interface ProposedFileChange {
  path: string;
  action: "update" | "create" | "delete";
  content?: string;
}

export interface ValidatedEdit {
  accepted: ProposedFileChange[];
  rejected: { path: string; reason: string }[];
}

/** Apply the write policy and size/count caps to a model's proposed edit. */
export function validateEdit(changes: ProposedFileChange[], allowed: string[]): ValidatedEdit {
  const out: ValidatedEdit = { accepted: [], rejected: [] };
  const seen = new Set<string>();
  for (const ch of changes ?? []) {
    const path = String(ch?.path ?? "").trim();
    if (seen.has(path)) {
      out.rejected.push({ path, reason: "duplicate" });
      continue;
    }
    seen.add(path);
    const v = pathWriteVerdict(path, allowed);
    // `v.ok === false` (not `!v.ok`): the frontend compiles without
    // strictNullChecks, where truthiness does not narrow the union.
    if (v.ok === false) {
      out.rejected.push({ path, reason: v.reason });
      continue;
    }
    const action = ch.action === "create" || ch.action === "delete" ? ch.action : "update";
    if (action !== "delete") {
      if (typeof ch.content !== "string") {
        out.rejected.push({ path, reason: "no content" });
        continue;
      }
      if (new TextEncoder().encode(ch.content).length > MAX_FILE_BYTES) {
        out.rejected.push({ path, reason: `larger than ${MAX_FILE_BYTES} bytes` });
        continue;
      }
    }
    if (out.accepted.length >= MAX_FILES_PER_PR) {
      out.rejected.push({ path, reason: `more than ${MAX_FILES_PER_PR} files in one pull request` });
      continue;
    }
    out.accepted.push({ path, action, content: ch.content });
  }
  return out;
}

/**
 * Enterprise auto-merge: every file the PR touches must sit under one of the
 * connection's auto-merge globs; an empty list means never.
 */
export function autoMergeEligible(paths: string[], autoMergeGlobs: string[] | null | undefined): boolean {
  const globs = (autoMergeGlobs ?? []).map((g) => String(g).trim()).filter(Boolean);
  if (!globs.length || !paths.length) return false;
  return paths.every((p) => !isProtectedPath(p) && matchesAny(p, globs));
}

export function slugifyBranch(s: string): string {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "change";
  return `kinika/${base}-${Date.now().toString(36).slice(-5)}`;
}

// ── API client (edge functions only) ─────────────────────────────────────────

export interface GitHubConn {
  owner: string;
  repo: string;
  defaultBranch?: string;
}

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const API = "https://api.github.com";

async function gh(token: string, method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kinika-developer-agent",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    const msg = data?.message ?? data?.raw ?? `${res.status} ${res.statusText}`;
    throw new GitHubError(`GitHub: ${msg}${data?.errors ? ` (${JSON.stringify(data.errors).slice(0, 200)})` : ""}`, res.status === 401 || res.status === 403 ? 401 : res.status === 404 ? 404 : 502);
  }
  return data;
}

export function parseRepo(input: string): GitHubConn | null {
  const m = String(input ?? "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").match(/^([\w.-]+)\/([\w.-]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export const github = {
  async repoInfo(token: string, c: GitHubConn) {
    const r = await gh(token, "GET", `/repos/${c.owner}/${c.repo}`);
    return { full_name: r.full_name as string, default_branch: r.default_branch as string, private: !!r.private, permissions: r.permissions ?? {}, html_url: r.html_url as string };
  },
  async branchSha(token: string, c: GitHubConn, branch: string): Promise<string> {
    const r = await gh(token, "GET", `/repos/${c.owner}/${c.repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    return r.object.sha;
  },
  async tree(token: string, c: GitHubConn, branch: string): Promise<RepoFile[]> {
    const r = await gh(token, "GET", `/repos/${c.owner}/${c.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    return (r.tree ?? []).filter((t: any) => t.type === "blob").map((t: any) => ({ path: t.path as string, size: Number(t.size) || 0 }));
  },
  async getFile(token: string, c: GitHubConn, path: string, ref: string): Promise<FileContent> {
    const r = await gh(token, "GET", `/repos/${c.owner}/${c.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`);
    if (Array.isArray(r) || r.type !== "file") throw new GitHubError(`${path} is not a file`, 400);
    const content = r.encoding === "base64" ? new TextDecoder().decode(Uint8Array.from(atob(String(r.content).replace(/\n/g, "")), (ch) => ch.charCodeAt(0))) : String(r.content ?? "");
    return { path, content, sha: r.sha };
  },
  async createBranch(token: string, c: GitHubConn, name: string, fromSha: string): Promise<void> {
    await gh(token, "POST", `/repos/${c.owner}/${c.repo}/git/refs`, { ref: `refs/heads/${name}`, sha: fromSha });
  },
  async putFile(token: string, c: GitHubConn, branch: string, path: string, content: string, message: string, sha?: string): Promise<void> {
    const b64 = btoa(Array.from(new TextEncoder().encode(content), (b) => String.fromCharCode(b)).join(""));
    await gh(token, "PUT", `/repos/${c.owner}/${c.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, { message, content: b64, branch, ...(sha ? { sha } : {}) });
  },
  async deleteFile(token: string, c: GitHubConn, branch: string, path: string, message: string, sha: string): Promise<void> {
    await gh(token, "DELETE", `/repos/${c.owner}/${c.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, { message, sha, branch });
  },
  async createPR(token: string, c: GitHubConn, head: string, base: string, title: string, body: string): Promise<{ number: number; html_url: string }> {
    const r = await gh(token, "POST", `/repos/${c.owner}/${c.repo}/pulls`, { title, body, head, base });
    return { number: r.number, html_url: r.html_url };
  },
  async mergePR(token: string, c: GitHubConn, number: number, title?: string): Promise<{ sha: string; merged: boolean }> {
    const r = await gh(token, "PUT", `/repos/${c.owner}/${c.repo}/pulls/${number}/merge`, { merge_method: "squash", ...(title ? { commit_title: title.slice(0, 72) } : {}) });
    return { sha: String(r.sha ?? ""), merged: !!r.merged };
  },
  async closePR(token: string, c: GitHubConn, number: number): Promise<void> {
    await gh(token, "PATCH", `/repos/${c.owner}/${c.repo}/pulls/${number}`, { state: "closed" });
  },
  async deleteBranch(token: string, c: GitHubConn, name: string): Promise<void> {
    await gh(token, "DELETE", `/repos/${c.owner}/${c.repo}/git/refs/heads/${encodeURIComponent(name)}`);
  },
  async prStatus(token: string, c: GitHubConn, number: number) {
    const pr = await gh(token, "GET", `/repos/${c.owner}/${c.repo}/pulls/${number}`);
    let checks: { total: number; success: number; failure: number; pending: number; names: string[] } = { total: 0, success: 0, failure: 0, pending: 0, names: [] };
    try {
      const cr = await gh(token, "GET", `/repos/${c.owner}/${c.repo}/commits/${pr.head.sha}/check-runs`);
      const runs = cr.check_runs ?? [];
      checks = {
        total: runs.length,
        success: runs.filter((r: any) => r.conclusion === "success").length,
        failure: runs.filter((r: any) => ["failure", "timed_out", "cancelled"].includes(r.conclusion)).length,
        pending: runs.filter((r: any) => r.status !== "completed").length,
        names: runs.filter((r: any) => ["failure", "timed_out"].includes(r.conclusion)).map((r: any) => r.name),
      };
    } catch {
      // check-runs may be unavailable on the token's scopes; status stays unknown
    }
    // Preview deploys (Vercel, Netlify, …) report through the Deployments API.
    let preview: { url: string; state: string; environment: string } | null = null;
    try {
      const deps = await gh(token, "GET", `/repos/${c.owner}/${c.repo}/deployments?ref=${encodeURIComponent(pr.head.ref)}&per_page=5`);
      for (const d of deps ?? []) {
        const st = await gh(token, "GET", `/repos/${c.owner}/${c.repo}/deployments/${d.id}/statuses?per_page=1`);
        const latest = st?.[0];
        if (latest?.environment_url) {
          preview = { url: latest.environment_url, state: latest.state, environment: String(d.environment ?? "preview") };
          break;
        }
      }
    } catch {
      // no deployments integration or no permission; preview stays null
    }
    return { state: pr.state as string, merged: !!pr.merged, mergeable: pr.mergeable as boolean | null, html_url: pr.html_url as string, head: pr.head.ref as string, checks, preview };
  },
};
