import { useEffect } from "react";

/**
 * /oauth/done — where the OAuth callback sends the popup. It tells the window
 * that opened it what happened and closes. Opened as a full page (popup
 * blocked), it sends the founder on to Kinika's team with the same result.
 */
export default function OAuthDone() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const msg = { type: "kinika:oauth", key: p.get("connected") ?? p.get("verified") ?? p.get("provider") ?? null, verified: !!p.get("verified"), error: p.get("oauth_error") };
    if (window.opener && window.opener !== window) {
      try { window.opener.postMessage(msg, window.location.origin); } catch { /* opener gone */ }
      window.close();
      return;
    }
    const q = new URLSearchParams();
    if (msg.error) q.set("oauth_error", msg.error); else if (msg.key) q.set(msg.verified ? "verified" : "connected", msg.key);
    window.location.replace(`${msg.verified ? "/admin/connections" : "/team"}?${q.toString()}`);
  }, []);
  return <div className="min-h-screen flex items-center justify-center font-ui text-[13px] text-muted-foreground">Finishing the sign-in… you can close this window.</div>;
}
