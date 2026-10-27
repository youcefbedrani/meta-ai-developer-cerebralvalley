"use client";

import { Check, CircleAlert, Copy, Download, ExternalLink, Laptop, Loader2, Package, Plus, Smartphone, Sparkles, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { editDesignAction, startDesignAction } from "@/app/(app)/app/(founder)/projects/[id]/design/actions";
import { LogoLoader } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { buildScreenPrompt, MAX_SCREENS, suggestScreens, type DesignContext, type Platform, type ScreenSpec } from "@/lib/design-prompt";
import { cn } from "@/lib/utils";

export type StudioScreen = { id: string; name: string; device: "MOBILE" | "DESKTOP"; status: "queued" | "running" | "succeeded" | "failed" | "cancelled"; error: string | null; imageUrl: string | null };
type Sources = { research: boolean; mvpPlan: boolean; brand: boolean; quotes: number; competitors: number };

export function DesignStudio({ projectId, ctx, sources, screens, cost, balance, provider, codingPrompt }: { projectId: string; ctx: DesignContext; sources: Sources; screens: StudioScreen[]; cost: number; balance: number; provider: "stitch" | "builtin" | "mock"; codingPrompt: string | null }) {
  const router = useRouter();
  const active = screens.some((s) => s.status === "queued" || s.status === "running");
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [active, router]);

  const base = `/app/projects/${projectId}`;
  const done = screens.filter((s) => s.status === "succeeded");

  return (
    <div className="space-y-6">
      <section className="surface ambient-glow p-5">
        <div className="flex items-start gap-3">
          <span className="animate-glow-pulse grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow"><Wand2 className="size-4" /></span>
          <div className="min-w-0">
            <h2 className="font-medium">{provider === "stitch" ? "Design your MVP with Google Stitch" : "Design your MVP"}</h2>
            <p className="text-sm text-muted-foreground">
              {provider === "stitch"
                ? "We write a detailed prompt for every screen from everything you've built here, and Stitch turns it into a real, high-fidelity design."
                : "Every screen is designed from everything you've built here: your product, MVP features, Brand Kit colours, fonts and logo, and your customers' own words."}{" "}
              Then download it as a kit and build it with Claude Code, Cursor or any AI coding tool.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Source ok label="Idea & description" />
          <Source ok={sources.research} label="Market research" href={`${base}/research`} />
          <Source ok={sources.mvpPlan} label="MVP plan" href={`${base}/plan`} hint="screens & features" />
          <Source ok={sources.brand} label="Brand Kit" href={`${base}/brand`} hint="colours & fonts" />
          <Source ok={sources.quotes > 0} label={sources.quotes ? `${sources.quotes} customer quotes` : "Customer quotes"} href={`${base}/language`} />
        </div>
        {!sources.mvpPlan || !sources.brand ? (
          <p className="mt-3 text-xs text-muted-foreground">Tip: designs are much better with an MVP plan (which screens and features) and a Brand Kit (your colours and fonts). You can still design now.</p>
        ) : null}
        {provider === "mock" ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Test mode: designs are placeholders (DESIGN_PROVIDER=mock).</p> : null}
        {provider === "builtin" ? <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Designed instantly by the built-in designer. Tip: create a Brand Kit first so screens use your logo, colours and fonts. Ask for changes like &quot;make it dark&quot;, &quot;use green&quot; or &quot;remove the sidebar&quot;.</p> : null}
      </section>

      {active ? <Progress provider={provider} screens={screens.filter((s) => s.status === "queued" || s.status === "running")} /> : <NewDesign provider={provider} projectId={projectId} ctx={ctx} cost={cost} balance={balance} />}

      {screens.length ? (
        <section className="space-y-3">
          <h2 className="font-medium">Your screens</h2>
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {screens.map((s) => (
              <ScreenCard key={s.id} provider={provider} s={s} projectId={projectId} cost={cost} balance={balance} busy={active} />
            ))}
          </div>
        </section>
      ) : null}

      {done.length && codingPrompt ? <ExportPanel projectId={projectId} prompt={codingPrompt} count={done.length} /> : null}
    </div>
  );
}

function Source({ ok, label, href, hint }: { ok: boolean; label: string; href?: string; hint?: string }) {
  const body = (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1", ok ? "border-success/30 bg-success/10 text-success" : "border-border text-muted-foreground")}>
      {ok ? <Check className="size-3.5" /> : <Plus className="size-3.5" />} {label}
      {!ok && hint ? <span className="opacity-70">· adds {hint}</span> : null}
    </span>
  );
  return !ok && href ? <Link href={href} className="hover:opacity-80">{body}</Link> : body;
}

function NewDesign({ provider, projectId, ctx, cost, balance }: { provider: "stitch" | "builtin" | "mock"; projectId: string; ctx: DesignContext; cost: number; balance: number }) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("web");
  const suggestions = useMemo(() => suggestScreens(ctx, platform), [ctx, platform]);
  const [custom, setCustom] = useState<ScreenSpec[]>([]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState({ name: "", purpose: "" });
  const [pending, start] = useTransition();
  const all = [...suggestions, ...custom];
  const chosen = all.filter((s) => !off.has(s.name)).slice(0, MAX_SCREENS);
  const total = chosen.length * cost;

  const toggle = (name: string) => setOff((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });

  return (
    <section className="surface p-5">
      <h2 className="font-medium">New design</h2>
      <div className="mt-3 inline-flex rounded-xl border border-border bg-muted/40 p-1" role="radiogroup" aria-label="Platform">
        {(["web", "mobile"] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={platform === p} onClick={() => { setPlatform(p); setOff(new Set()); }} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors", platform === p ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {p === "web" ? <Laptop className="size-4" /> : <Smartphone className="size-4" />} {p === "web" ? "Web app" : "Mobile app"}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">Screens to design (up to {MAX_SCREENS} at a time). Suggested from your MVP plan.</p>
      <ul className="mt-2 grid gap-2 md:grid-cols-2">
        {all.map((s) => {
          const on = !off.has(s.name);
          return (
            <li key={s.name}>
              <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors", on ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40")}>
                <input type="checkbox" checked={on} onChange={() => toggle(s.name)} className="mt-0.5 accent-[var(--plum)]" />
                <span className="min-w-0">
                  <span className="font-medium">{s.name}</span>
                  {s.purpose ? <span className="mt-0.5 block text-xs text-muted-foreground">{s.purpose}</span> : null}
                </span>
                {custom.includes(s) ? (
                  <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" aria-label={`Remove ${s.name}`} onClick={(e) => { e.preventDefault(); setCustom((c) => c.filter((x) => x !== s)); }}><X className="size-4" /></button>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const name = draft.name.trim();
          if (name.length < 2 || all.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
          setCustom((c) => [...c, { name: name.slice(0, 60), purpose: draft.purpose.trim().slice(0, 300) }]);
          setDraft({ name: "", purpose: "" });
        }}
      >
        <input aria-label="New screen name" placeholder="Add a screen, e.g. Pricing" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-9 rounded-lg border border-border bg-background px-3 text-sm sm:w-48" />
        <input aria-label="What the screen should do" placeholder="What should it show or do? (optional)" value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
        <Button type="submit" variant="outline" className="h-9 rounded-[10px]"><Plus /> Add</Button>
      </form>

      {chosen[0] ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{provider === "stitch" ? <>See the prompt we&apos;ll send to Stitch for “{chosen[0].name}”</> : <>See the design brief for “{chosen[0].name}”</>}</summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-3 text-xs">{buildScreenPrompt(ctx, chosen[0], platform)}</pre>
        </details>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">{chosen.length} screen{chosen.length === 1 ? "" : "s"} × {cost} credits = {total} credits · {balance} left</p>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <Button
            variant="gradient"
            className="h-10 px-5"
            disabled={pending || !chosen.length || balance < total}
            onClick={() =>
              start(async () => {
                const r = await startDesignAction(projectId, { platform, screens: chosen });
                if (!r.ok) return void toast.error(r.error);
                toast.success(provider === "stitch" ? "Stitch is designing your screens" : "Designing your screens");
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Design {chosen.length} screen{chosen.length === 1 ? "" : "s"}
          </Button>
          {balance < total ? <Link href="/app/settings#billing" className="text-center text-xs font-medium text-primary hover:underline">Not enough credits: upgrade or buy a pack</Link> : null}
        </div>
      </div>
    </section>
  );
}

function Progress({ provider, screens }: { provider: "stitch" | "builtin" | "mock"; screens: StudioScreen[] }) {
  return (
    <section className="surface p-5" aria-live="polite">
      <div className="flex items-center gap-4">
        <LogoLoader label="" size="sm" />
        <div>
          <p className="font-medium">{provider === "stitch" ? "Stitch is designing your screens…" : "Designing your screens…"}</p>
          <p className="text-sm text-muted-foreground">Each screen takes one to three minutes. You can leave this page; they appear below as they finish.</p>
        </div>
      </div>
      <ul className="stagger mt-4 grid gap-2 sm:grid-cols-2">
        {screens.map((s) => (
          <li key={s.id} className={cn("flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm", s.status === "running" && "shimmer border-primary/50 bg-primary/5")}>
            {s.status === "running" ? <Loader2 className="size-4 animate-spin text-primary" /> : <span className="size-4 rounded-full border border-border" />}
            {s.name}
            <span className="ml-auto text-xs text-muted-foreground">{s.status === "running" ? "Designing" : "Waiting"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScreenCard({ provider, s, projectId, cost, balance, busy }: { provider: "stitch" | "builtin" | "mock"; s: StudioScreen; projectId: string; cost: number; balance: number; busy: boolean }) {
  const router = useRouter();
  const [imgFailed, setImgFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [pending, start] = useTransition();
  const src = `/app/projects/${projectId}/design/${s.id}/html`;
  const mobile = s.device === "MOBILE";

  return (
    <article className="surface flex flex-col overflow-hidden">
      <div className={cn("relative overflow-hidden border-b border-border bg-muted/30", mobile ? "h-80" : "h-56")}>
        {s.status === "succeeded" ? (
          s.imageUrl && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- screenshot hosted by Stitch
            <img src={s.imageUrl} alt={`${s.name} design`} className="size-full object-cover object-top" onError={() => setImgFailed(true)} />
          ) : (
            <div className="absolute inset-0 overflow-hidden">
              <iframe
                title={`${s.name} preview`}
                src={src}
                sandbox="allow-scripts"
                loading="lazy"
                className="pointer-events-none origin-top-left border-0"
                style={mobile ? { width: 390, height: 844, transform: "scale(0.37)", marginLeft: "calc(50% - 72px)" } : { width: 1280, height: 800, transform: "scale(0.28)" }}
              />
            </div>
          )
        ) : s.status === "failed" ? (
          <div className="grid size-full place-items-center p-4 text-center text-sm text-destructive"><span><CircleAlert className="mx-auto mb-1 size-5" />{s.error ?? "Failed"}</span></div>
        ) : (
          <div className="shimmer grid size-full place-items-center text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm">{mobile ? <Smartphone className="size-3" /> : <Laptop className="size-3" />} {mobile ? "Mobile" : "Web"}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="font-medium">{s.name}</p>
        {s.status === "succeeded" ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={src} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted"><ExternalLink className="size-3.5" /> Open</a>
              <a href={`${src}?download=1`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted"><Download className="size-3.5" /> HTML</a>
              <button type="button" disabled={busy} onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"><Wand2 className="size-3.5" /> Edit</button>
            </div>
            {editing ? (
              <form
                className="mt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const r = await editDesignAction(projectId, s.id, instruction);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(provider === "stitch" ? "Stitch is updating the screen" : "Updating the screen");
                    setEditing(false);
                    setInstruction("");
                    router.refresh();
                  });
                }}
              >
                <textarea aria-label={`Change ${s.name}`} value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2} placeholder="e.g. Make it dark, move pricing above the fold" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
                <Button type="submit" size="sm" variant="gradient" disabled={pending || instruction.trim().length < 4 || balance < cost}>{pending ? <Loader2 className="animate-spin" /> : <Wand2 />} Apply · {cost} credits</Button>
              </form>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

function ExportPanel({ projectId, prompt, count }: { projectId: string; prompt: string; count: number }) {
  return (
    <section className="surface ambient-glow p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <h2 className="flex items-center gap-2 font-medium"><Package className="size-4 text-primary" /> Build it with Claude Code, Cursor or any AI coding tool</h2>
          <p className="mt-1 text-sm text-muted-foreground">The kit has your {count} design{count === 1 ? "" : "s"} as HTML, a ready-to-use brief (PROMPT.md) with your features, users, data model and brand, plus your MVP spec and customers&apos; own words.</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Download the kit and unzip it into an empty folder.</li>
            <li>
              <b className="text-foreground">Claude Code:</b> open the folder in a terminal, run <code className="rounded bg-muted px-1">claude</code>, then type <i>Read PROMPT.md and build it.</i>
            </li>
            <li><b className="text-foreground">Cursor, Windsurf:</b> open the folder and ask the agent to follow PROMPT.md. <b className="text-foreground">Lovable, Bolt, v0:</b> paste the prompt and attach the designs.</li>
          </ol>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <a href={`/app/projects/${projectId}/design/export`} className="btn-shine inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[var(--plum)] px-5 text-sm font-medium text-white shadow-glow"><Download className="size-4" /> Download project kit (.zip)</a>
          <Button variant="outline" className="h-10 rounded-[10px]" onClick={() => navigator.clipboard.writeText(prompt).then(() => toast.success("Prompt copied"), () => toast.error("Couldn't copy"))}><Copy /> Copy the prompt</Button>
        </div>
      </div>
    </section>
  );
}
