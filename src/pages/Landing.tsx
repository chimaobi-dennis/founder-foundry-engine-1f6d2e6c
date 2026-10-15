import { ArrowRight, Check } from "lucide-react";
import { SEO } from "@/components/SEO";
import { EditorialShell, Section, Card, PrimaryLink, SecondaryLink, L } from "@/components/editorial/EditorialLayout";

/**
 * The public home page. Says what Kinika is in a sentence, shows the first
 * run as it really happens, names the team and the workspace, and tells the
 * truth about connections and prices.
 */

const STEPS = [
  { n: "1", title: "Tell Kinika about your business", body: "A few sentences in your own words, and anything Kinika can read: your website, notes, a conversation you already had elsewhere." },
  { n: "2", title: "Your business, as Kinika understands it", body: "Kinika reads it back: what you sell, who buys, how people find you, how you sound. Each line says where it came from and how sure Kinika is. You fix what is wrong and approve." },
  { n: "3", title: "A plan you own", body: "From your goal, Kinika writes the next targets and a checklist for each, and names the roles it would hire. Tick tasks off, add your own, or tell Kinika what changed." },
  { n: "4", title: "Agents work, you approve", body: "Kinika hires the roles your plan needs. Each works where you can see it and stops for your yes before anything is sent, published or changed." },
];

const TEAM = [
  { name: "Researcher", does: "Audience, market and competitor briefs with sources and a confidence note per finding." },
  { name: "Copywriter", does: "Posts, captions, emails and one-pagers in your voice, platform by platform." },
  { name: "Designer", does: "Campaign visuals as editable scenes: posts, stories, flyers." },
  { name: "SEO Specialist", does: "Better titles and descriptions on your shop or site, applied only after you approve the diff." },
  { name: "Developer", does: "Code changes on a branch with a preview and a pull request. Never your main branch." },
  { name: "Community agent", does: "Reads comments and messages, drafts replies in your voice, posts only what you approve." },
];

const SURFACES = [
  { name: "Document", body: "Briefs, reports, summaries and contracts. Every line editable; your version is what approval keeps." },
  { name: "Canvas", body: "Designs as scenes you can grab mid-run. The agent never overwrites your edits." },
  { name: "Board", body: "Standing tasks on a schedule: read, summarise, draft, you approve, publish, report. The review step cannot be removed." },
];

export default function Landing() {
  return (
    <EditorialShell>
      <SEO
        title="Kinika — The workspace that knows your business"
        description="Tell Kinika about your business once. Kinika reads it back, writes your plan, hires the agents each task needs, and asks before anything goes out."
        path="/"
      />

      {/* ── Hero ── */}
      <section style={{ background: L.paper }}>
        <div className="mx-auto" style={{ maxWidth: 1320, padding: "clamp(140px, 18vh, 200px) clamp(24px, 6vw, 96px) clamp(72px, 10vh, 120px)" }}>
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-8">
              <p className="ed-fade" style={{ fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: L.accentDeep, fontWeight: 600, marginBottom: 20 }}>
                For shops, services, creators and founders
              </p>
              <h1 className="pf ed-fade ed-d1" style={{ color: L.ink, fontSize: "clamp(42px, 6vw, 80px)", lineHeight: 1.02, letterSpacing: "-0.03em", maxWidth: "16ch" }}>
                The workspace that knows your business.
              </h1>
              <p className="ed-fade ed-d2" style={{ color: L.inkSoft, fontSize: "clamp(16px, 1.4vw, 19px)", lineHeight: 1.6, maxWidth: "52ch", marginTop: 28 }}>
                Tell Kinika about your business once. Kinika reads it back to you, writes your plan, hires the agents each task needs, and asks before anything is sent, published or changed.
              </p>
              <div className="ed-fade ed-d3 flex flex-wrap items-center gap-4" style={{ marginTop: 36 }}>
                <PrimaryLink to="/sign-up">Start free <ArrowRight size={16} /></PrimaryLink>
                <SecondaryLink to="/system">How it works</SecondaryLink>
                <span style={{ fontSize: 13, color: L.inkMuted }}>Free: Kinika plans with you. Agents from $20 a month.</span>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-4 lg:pt-6">
              <div style={{ background: L.surface, border: `1px solid ${L.rule}`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: L.inkMuted, fontWeight: 600 }}>Your business, as Kinika understands it</span>
                {[
                  ["What you sell", "Sourdough, cardamom buns and lunch sandwiches, baked each morning on Storgatan.", "sure · site + you"],
                  ["Who buys", "Families at weekends; office workers on weekday mornings. No business customers yet.", "fairly sure · Instagram"],
                  ["Where you are now", "Three years in, one shop. The next stage is a steadier weekday line.", "a guess, say if wrong"],
                ].map(([k, v, c]) => (
                  <div key={k} style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 10, borderTop: `1px solid ${L.ruleSoft}` }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: L.ink }}>{k}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: L.inkSoft }}>{v}</span>
                    <span style={{ fontSize: 11, color: c.startsWith("sure") ? L.good : L.inkMuted }}>{c}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, paddingTop: 6 }}>
                  <span style={{ background: L.amber, color: "#fff", fontSize: 12, fontWeight: 500, padding: "8px 12px", borderRadius: 8 }}>Yes, that is my business</span>
                  <span style={{ border: `1px solid ${L.rule}`, fontSize: 12, padding: "8px 12px", borderRadius: 8, color: L.ink }}>Something is wrong</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Three facts ── */}
      <Section tone="surface">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card label="Understanding first" title="Nothing is made before Kinika knows your business.">The read-back is the first thing you see and the thing everything else is built from. You approve it; you can fix any line.</Card>
          <Card label="A plan, not a chat" title="Targets you can check off, and who does each.">Kinika writes it, revises it when you reach a milestone, and checks in weekly. Tell Kinika what changed and the plan changes.</Card>
          <Card label="Approval, always" title="Agents stop for your yes.">Nothing is sent, published or changed in a connected tool without you. Every change can be reverted.</Card>
        </div>
      </Section>

      {/* ── The first run ── */}
      <Section eyebrow="The first ten minutes" title="From sign-up to the first result an agent made for you.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {STEPS.map((s) => (
            <div key={s.n} style={{ display: "flex", gap: 16, padding: "22px 22px 24px", background: L.surface, border: `1px solid ${L.rule}`, borderRadius: 14 }}>
              <span style={{ width: 32, height: 32, borderRadius: 999, background: L.amber, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{s.n}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="pf" style={{ fontSize: 18, color: L.ink, lineHeight: 1.3 }}>{s.title}</span>
                <span style={{ fontSize: 14, lineHeight: 1.6, color: L.inkSoft }}>{s.body}</span>
              </div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 24, fontSize: 13, color: L.inkMuted, maxWidth: "70ch", lineHeight: 1.6 }}>
          On the free trial Kinika plans with you and advises you; you do the tasks. With a paid plan Kinika hires the roles your plan needs. Seats are how many agents can be on the team; credits are how much work they do. The two are never mixed up.
        </p>
      </Section>

      {/* ── Kinika's team ── */}
      <Section tone="deep" eyebrow="Kinika's team" title="Kinika is the manager. Agents are the staff. You talk only to Kinika.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TEAM.map((a) => (
            <Card key={a.name} title={a.name}>{a.does}</Card>
          ))}
        </div>
        <p style={{ marginTop: 24, fontSize: 14, color: L.inkSoft, maxWidth: "70ch", lineHeight: 1.6 }}>
          Every agent reads the same brand record before it works, and what it learns goes back into it. Feedback goes to Kinika or onto the work itself; you never manage agents one by one.
        </p>
      </Section>

      {/* ── The workspace ── */}
      <Section eyebrow="The workspace" title="One place of work. The surface changes with the job.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SURFACES.map((s) => (
            <Card key={s.name} label={s.name} title={s.name === "Document" ? "Read it, fix it, approve it." : s.name === "Canvas" ? "Edit the design while it is being made." : "See every step before it runs."}>{s.body}</Card>
          ))}
        </div>
        <ul style={{ marginTop: 28, display: "grid", gap: 10, maxWidth: "72ch" }}>
          {[
            "A workspace opens only from a task on your plan. There is no blank page anywhere in Kinika.",
            "The top of every workspace says who is working, on what, and what it has cost so far. Take over at any time.",
            "A task with several outputs opens one workspace with a tab per output, each naming its agent.",
          ].map((t) => (
            <li key={t} style={{ display: "flex", gap: 10, fontSize: 14, lineHeight: 1.6, color: L.inkSoft }}><Check size={16} style={{ color: L.good, flexShrink: 0, marginTop: 4 }} /> {t}</li>
          ))}
        </ul>
      </Section>

      {/* ── Connections ── */}
      <Section tone="surface" eyebrow="Connections" title="Real connections, kept, with permissions in plain words.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14, lineHeight: 1.6, color: L.inkSoft }}>
            <p>Each connection shows what Kinika may do with it: <strong style={{ color: L.ink }}>read</strong>, <strong style={{ color: L.ink }}>draft</strong>, or <strong style={{ color: L.ink }}>act after your yes</strong>. Acting without asking is off by default and only ever per kind of action. The approve step is never removed for anything that sends or publishes.</p>
            <p>Connected today: Shopify, WordPress, Notion, GitHub, and your social accounts through Ayrshare. Coming next: Gmail, Slack, and Instagram and TikTok directly. We say which is which on the page, not after you sign up.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["Shopify", "read · change after your yes"], ["WordPress", "read · change after your yes"], ["Notion", "read · draft"], ["GitHub", "read · pull requests"], ["Social via Ayrshare", "draft · post after your yes"], ["Gmail, Slack", "coming"]].map(([n, p]) => (
              <div key={n} style={{ background: L.paper, border: `1px solid ${L.rule}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: L.ink }}>{n}</span>
                <span style={{ fontSize: 11, color: L.inkMuted }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Pricing teaser ── */}
      <Section eyebrow="Pricing" title="Free to plan. Pay for seats and work.">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            ["Free trial", "$0", "Kinika plans with you and advises you. No agent seats. 50 credits for the plan and conversation."],
            ["Solo", "$20 / month", "2 agent seats · 1,000 credits a month. Kinika hires one role at a time and swaps when a role is done."],
            ["Startup", "$45 / month", "5 agent seats · 2,000 credits a month · invite people to the workspace."],
            ["Enterprise", "$139 / month", "10 seats, several businesses, act-without-asking on kinds of action you choose."],
          ].map(([n, p, d]) => (
            <div key={n} style={{ background: L.surface, border: `1px solid ${n === "Startup" ? L.amber : L.rule}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="pf" style={{ fontSize: 18, color: L.ink }}>{n}</span>
              <span style={{ fontSize: 20, fontWeight: 600, color: L.ink }}>{p}</span>
              <span style={{ fontSize: 13, lineHeight: 1.6, color: L.inkSoft }}>{d}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4" style={{ marginTop: 28 }}>
          <PrimaryLink to="/sign-up">Start free <ArrowRight size={16} /></PrimaryLink>
          <SecondaryLink to="/pricing">See every plan</SecondaryLink>
          <span style={{ fontSize: 13, color: L.inkMuted }}>Extra agent seat $10 a month. A credit is two cents; every task is quoted before it runs.</span>
        </div>
      </Section>
    </EditorialShell>
  );
}
