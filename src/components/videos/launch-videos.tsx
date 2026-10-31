"use client";

import { Check, CircleAlert, Clapperboard, Copy, Download, ExternalLink, Link2, Loader2, Send, Sparkles, Unplug } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { disconnectSocialAction, postVideoAction, startLaunchVideoAction } from "@/app/(app)/app/(founder)/projects/[id]/videos/actions";
import { MetaMark } from "@/components/brand/hackathon-lockup";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CAPTION_LIMIT, PROVIDER_LABEL, PROVIDER_UPLOAD_URL, SOCIAL_PROVIDERS, VIDEO_ANGLES, type SocialProvider, type VideoAngle } from "@/lib/validation/launch-video";

type Status = "queued" | "running" | "succeeded" | "failed" | "cancelled";
type Video = { id: string; status: Status; stage: string | null; angle: string; error: string | null; durationSec: number | null; createdAt: string; title: string | null; scenes: string[]; captions: Record<string, string> | null };
type Connection = { id: string; provider: SocialProvider; accountName: string };
type Post = { id: string; videoId: string; provider: SocialProvider; status: "queued" | "posting" | "published" | "sent_to_inbox" | "failed"; url: string | null; error: string | null; createdAt: string; accountName: string | null };
type Connectors = { linkedin: boolean; meta: boolean; tiktok: boolean };

const CONNECTOR_OF: Record<SocialProvider, keyof Connectors> = { linkedin: "linkedin", facebook: "meta", instagram: "meta", tiktok: "tiktok" };

export function LaunchVideos({ projectId, cost, balance, hasLink, connectors, connections, posts, videos }: { projectId: string; cost: number; balance: number; hasLink: boolean; connectors: Connectors; connections: Connection[]; posts: Post[]; videos: Video[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const busy = videos.some((v) => v.status === "queued" || v.status === "running") || posts.some((p) => p.status === "queued" || p.status === "posting");

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [busy, router]);

  // Coming back from a platform's sign-in page (?social=…).
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("social");
    if (!s) return;
    if (s === "connected") toast.success("Account connected");
    else if (s === "failed") toast.error("Couldn't connect the account. Please try again.");
    else if (s === "not_configured") toast.error("Posting to that platform isn't set up on this server yet.");
    router.replace(pathname);
  }, [router, pathname]);

  return (
    <div className="space-y-6">
      <Creator projectId={projectId} cost={cost} balance={balance} hasLink={hasLink} disabled={videos.some((v) => v.status === "queued" || v.status === "running")} />
      <Accounts projectId={projectId} connectors={connectors} connections={connections} />
      {videos.length ? (
        <section className="space-y-4">
          <h2 className="font-medium">Your launch videos</h2>
          {videos.map((v) => (
            <VideoCard key={v.id} projectId={projectId} video={v} connections={connections} connectors={connectors} posts={posts.filter((p) => p.videoId === v.id)} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Creator({ projectId, cost, balance, hasLink, disabled }: { projectId: string; cost: number; balance: number; hasLink: boolean; disabled: boolean }) {
  const router = useRouter();
  const [angle, setAngle] = useState<VideoAngle>("problem");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="surface ambient-glow p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow"><Clapperboard className="size-4" /></span>
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-medium">
            Launch videos for organic social
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted-foreground"><MetaMark /> Muse Spark + Muse Image</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            A 15–30 second vertical video for TikTok, Instagram Reels, Facebook and LinkedIn, made from your research, brand and customers&apos; own words. Muse Spark writes the storyboard and a native post for every platform, Muse Image draws each scene, and we render the MP4 with captions (made to watch on mute). Then post it from here or download it.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Video angle">
        {(Object.keys(VIDEO_ANGLES) as VideoAngle[]).map((a) => (
          <button key={a} type="button" role="radio" aria-checked={angle === a} onClick={() => setAngle(a)} className={cn("rounded-xl border p-3 text-left text-sm transition-colors", angle === a ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted/40")}>
            <span className="font-medium">{VIDEO_ANGLES[a].label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{VIDEO_ANGLES[a].hint}</span>
          </button>
        ))}
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={600} placeholder="Optional: anything to include (an offer, a launch date, a feature to show)" className="mt-3 w-full rounded-lg border border-border bg-background p-2 text-sm" />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{hasLink ? "The end card and posts link to your published landing page." : "Tip: publish a landing page (Validation tab) so the video and posts have a link."} About a minute.</p>
        <Button
          variant="gradient"
          className="h-10 px-5"
          disabled={pending || disabled || balance < cost}
          onClick={() =>
            start(async () => {
              const r = await startLaunchVideoAction(projectId, angle, notes);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Muse Spark is making your video");
              setNotes("");
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Make the video · {cost} credits
        </Button>
      </div>
    </section>
  );
}

function Accounts({ projectId, connectors, connections }: { projectId: string; connectors: Connectors; connections: Connection[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const back = encodeURIComponent(`/app/projects/${projectId}/videos`);
  const any = connectors.linkedin || connectors.meta || connectors.tiktok;
  const rows: { key: keyof Connectors; label: string; note: string }[] = [
    { key: "linkedin", label: "LinkedIn", note: "Posts to your profile" },
    { key: "meta", label: "Facebook & Instagram", note: "Your Pages, and Reels on the Instagram account linked to each Page" },
    { key: "tiktok", label: "TikTok", note: "Sent to your TikTok inbox to add a sound and post" },
  ];
  return (
    <section className="surface p-5">
      <h2 className="flex items-center gap-2 font-medium"><Link2 className="size-4 text-primary" /> Post directly from Startum</h2>
      {!any ? <p className="mt-1 text-sm text-muted-foreground">Direct posting isn&apos;t switched on for this server yet. You can still download each video and copy its posts below.</p> : null}
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {rows.map((r) => {
          const mine = connections.filter((c) => CONNECTOR_OF[c.provider] === r.key);
          return (
            <div key={r.key} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.label}</span>
                {connectors[r.key] ? (
                  <a href={`/api/social/${r.key}/connect?back=${back}`} className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted">{mine.length ? "Reconnect" : "Connect"}</a>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Not set up</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.note}</p>
              {mine.length ? (
                <ul className="mt-2 space-y-1">
                  {mine.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 text-xs">
                      <Check className="size-3.5 text-success" /> <span className="min-w-0 flex-1 truncate">{PROVIDER_LABEL[c.provider]}: {c.accountName}</span>
                      <button type="button" disabled={pending} onClick={() => start(async () => { const res = await disconnectSocialAction(projectId, c.id); if (!res.ok) return void toast.error(res.error); router.refresh(); })} className="text-muted-foreground hover:text-destructive" aria-label={`Disconnect ${c.accountName}`}><Unplug className="size-3.5" /></button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VideoCard({ projectId, video: v, connections, connectors, posts }: { projectId: string; video: Video; connections: Connection[]; connectors: Connectors; posts: Post[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<SocialProvider>("tiktok");
  const [captions, setCaptions] = useState<Record<string, string>>(v.captions ?? {});
  const [account, setAccount] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const file = `/app/projects/${projectId}/videos/${v.id}/file`;
  const accounts = connections.filter((c) => c.provider === tab && connectors[CONNECTOR_OF[c.provider]]);
  const chosen = account[tab] ?? accounts[0]?.id ?? "";
  const caption = captions[tab] ?? "";

  if (v.status === "queued" || v.status === "running") {
    return (
      <article className="surface flex items-center gap-4 p-5" aria-live="polite">
        <Loader2 className="size-6 animate-spin text-primary" />
        <div>
          <p className="font-medium">Making your video · {VIDEO_ANGLES[v.angle as VideoAngle]?.label ?? v.angle}</p>
          <p className="text-sm text-muted-foreground">{v.stage && v.stage !== "queued" ? v.stage : "Starting"}… about a minute. You can leave this page.</p>
        </div>
      </article>
    );
  }
  if (v.status !== "succeeded") {
    return <article className="surface flex items-center gap-2 p-5 text-sm text-destructive"><CircleAlert className="size-4" /> {v.error ?? "The video couldn't be made."}</article>;
  }

  return (
    <article className="surface grid gap-5 p-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div>
        <video src={file} poster={`${file}?kind=thumb`} controls playsInline preload="metadata" className="aspect-[9/16] w-full rounded-2xl bg-black shadow-xl" />
        <div className="mt-3 flex gap-2">
          <a href={`${file}?download=1`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-sm hover:bg-muted"><Download className="size-4" /> Download MP4</a>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">1080×1920 · {v.durationSec ?? "?"} s · {VIDEO_ANGLES[v.angle as VideoAngle]?.label ?? v.angle}</p>
      </div>
      <div className="min-w-0">
        <h3 className="font-medium">{v.title}</h3>
        {v.scenes.length ? <ol className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">{v.scenes.map((s, i) => <li key={i} className="rounded-full bg-muted px-2 py-0.5">{i + 1}. {s}</li>)}</ol> : null}

        <div className="mt-4 flex flex-wrap gap-1 border-b border-border" role="tablist">
          {SOCIAL_PROVIDERS.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={tab === p} onClick={() => setTab(p)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === p ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{PROVIDER_LABEL[p]}</button>
          ))}
        </div>
        <textarea aria-label={`${PROVIDER_LABEL[tab]} post`} value={caption} onChange={(e) => setCaptions((c) => ({ ...c, [tab]: e.target.value }))} rows={8} className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm" />
        <p className={cn("text-right text-[11px]", caption.length > CAPTION_LIMIT[tab] ? "text-destructive" : "text-muted-foreground")}>{caption.length} / {CAPTION_LIMIT[tab]}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {accounts.length ? (
            <>
              <select aria-label="Account" value={chosen} onChange={(e) => setAccount((a) => ({ ...a, [tab]: e.target.value }))} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                {accounts.map((c) => <option key={c.id} value={c.id}>{c.accountName}</option>)}
              </select>
              <Button
                variant="gradient"
                className="h-9 px-4"
                disabled={pending || !chosen || !caption.trim() || caption.length > CAPTION_LIMIT[tab]}
                onClick={() =>
                  start(async () => {
                    const r = await postVideoAction(projectId, v.id, chosen, caption);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(tab === "tiktok" ? "Sending to your TikTok inbox" : `Posting to ${PROVIDER_LABEL[tab]}`);
                    router.refresh();
                  })
                }
              >
                {pending ? <Loader2 className="animate-spin" /> : <Send />} {tab === "tiktok" ? "Send to TikTok" : `Post to ${PROVIDER_LABEL[tab]}`}
              </Button>
            </>
          ) : null}
          <button type="button" onClick={() => navigator.clipboard.writeText(caption).then(() => toast.success("Post copied"), () => toast.error("Couldn't copy"))} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border px-3 text-sm hover:bg-muted"><Copy className="size-4" /> Copy post</button>
          <a href={PROVIDER_UPLOAD_URL[tab]} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border px-3 text-sm hover:bg-muted"><ExternalLink className="size-4" /> Open {PROVIDER_LABEL[tab]}</a>
        </div>
        {!accounts.length ? <p className="mt-2 text-xs text-muted-foreground">To post by hand: download the MP4, copy the post, then upload both on {PROVIDER_LABEL[tab]}.{connectors[CONNECTOR_OF[tab]] ? ` Or connect your ${PROVIDER_LABEL[tab]} account above to post from here.` : ""}</p> : null}

        {posts.length ? (
          <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
            {posts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                {p.status === "published" || p.status === "sent_to_inbox" ? <Check className="size-3.5 text-success" /> : p.status === "failed" ? <CircleAlert className="size-3.5 text-destructive" /> : <Loader2 className="size-3.5 animate-spin text-primary" />}
                <span className="font-medium">{PROVIDER_LABEL[p.provider]}</span>
                <span className="text-muted-foreground">{p.accountName ?? ""}</span>
                <span className="text-muted-foreground">
                  {p.status === "published" ? "Published" : p.status === "sent_to_inbox" ? "In your TikTok inbox: open TikTok to add a sound and post" : p.status === "failed" ? p.error : "Posting…"}
                </span>
                {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View post</a> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
