"use client";

import { FileText, History, Loader2, Pencil, Quote, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAssetAction, generateAssetAction, saveAssetVersionAction } from "@/app/(app)/app/(founder)/marketing/actions";
import { CopyButton } from "@/components/gold-mine/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSET_TYPES, suggestedAssetTypes, type AssetType } from "@/lib/validation/marketing-assets";
import { cn } from "@/lib/utils";

export type AssetCard = { id: string; groupId: string; type: AssetType; title: string; channelName: string; version: number; source: string; content: unknown; policyWarnings: string[]; quoteIds: string[]; createdAt: string };
type Channel = { id: string; name: string; type: "organic" | "paid" };

const humanize = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Plain-text version of an asset for copying. */
function toText(v: unknown, depth = 0): string {
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.every((x) => typeof x === "string") ? v.join(", ") : v.map((x, i) => `${depth === 0 ? `#${i + 1}\n` : ""}${toText(x, depth + 1)}`).join("\n\n");
  if (v && typeof v === "object") return Object.entries(v).map(([k, x]) => `${humanize(k)}: ${toText(x, depth + 1)}`).join("\n");
  return "";
}

export function AssetsPanel({ channels, assets, quotes, cost, aiReady }: { channels: Channel[]; assets: AssetCard[]; quotes: Record<string, string>; cost: number; aiReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const channel = channels.find((c) => c.id === channelId);
  const suggested = useMemo(() => (channel ? suggestedAssetTypes(channel) : []), [channel]);
  const [type, setType] = useState<AssetType>(suggested[0] ?? "social_posts");
  const [editing, setEditing] = useState<AssetCard | null>(null);
  const [filter, setFilter] = useState("all");
  const shown = assets.filter((a) => filter === "all" || a.channelName === filter);

  return (
    <>
      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><FileText className="size-4 text-primary" /> Asset generator</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ready-to-edit copy for each channel, written from your research and customers&apos; own words. Each asset records which quotes it used. Edits are saved as new versions.</p>
        {channels.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="as-channel">Channel</Label>
              <select id="as-channel" value={channelId} onChange={(e) => { setChannelId(e.target.value); const c = channels.find((x) => x.id === e.target.value); if (c) setType(suggestedAssetTypes(c)[0]); }} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm">
                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-type">Asset type</Label>
              <select id="as-type" value={type} onChange={(e) => setType(e.target.value as AssetType)} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm">
                {suggested.length ? <optgroup label="Suggested for this channel">{suggested.map((t) => <option key={t} value={t}>{ASSET_TYPES[t].label}</option>)}</optgroup> : null}
                <optgroup label="All types">{(Object.keys(ASSET_TYPES) as AssetType[]).filter((t) => !suggested.includes(t)).map((t) => <option key={t} value={t}>{ASSET_TYPES[t].label}</option>)}</optgroup>
              </select>
            </div>
            <Button
              variant="gradient"
              className="h-10 px-5"
              disabled={pending || !aiReady || !channelId}
              onClick={() =>
                start(async () => {
                  const r = await generateAssetAction(channelId, type);
                  if (!r.ok) toast.error(r.error);
                  else toast.success("Asset generated");
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate · {cost} credits
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Add a channel first (Channels & budget tab).</p>
        )}
      </section>

      {assets.length ? (
        <div className="flex flex-wrap gap-2">
          {["all", ...new Set(assets.map((a) => a.channelName))].map((c) => (
            <button key={c} type="button" onClick={() => setFilter(c)} className={cn("rounded-full border px-3 py-1 text-sm", filter === c ? "border-[var(--violet)] bg-[var(--violet)]/10" : "border-border bg-white")}>{c === "all" ? "All channels" : c}</button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((a) => (
          <article key={a.id} className="surface flex flex-col p-5 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.channelName} · {ASSET_TYPES[a.type].label} · v{a.version}{a.source === "user" ? " (edited)" : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <CopyButton text={`${a.title}\n\n${toText(a.content)}`} />
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${a.title}`} onClick={() => setEditing(a)}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${a.title}`} onClick={() => start(async () => { const r = await deleteAssetAction(a.groupId); if (!r.ok) toast.error(r.error); router.refresh(); })}><Trash2 /></Button>
              </div>
            </div>
            {a.policyWarnings.length ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="flex items-center gap-1.5 font-medium"><ShieldAlert className="size-3.5" /> Ad policy check: review before publishing</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">{a.policyWarnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            ) : null}
            <div className="mt-3 max-h-80 overflow-y-auto rounded-xl bg-muted/30 p-3"><ContentView value={a.content} /></div>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="flex cursor-pointer items-center gap-1"><Quote className="size-3.5" /> Based on {a.quoteIds.length} customer quote{a.quoteIds.length === 1 ? "" : "s"}</summary>
              {a.quoteIds.length ? <ul className="mt-2 space-y-1">{a.quoteIds.map((q) => <li key={q} className="italic">“{quotes[q] ?? "Quote removed"}”</li>)}</ul> : <p className="mt-2">No quotes were used. The copy comes from the project research only.</p>}
            </details>
          </article>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="size-4" /> Edit asset (saves version {editing ? editing.version + 1 : ""})</DialogTitle></DialogHeader>
          {editing ? <AssetEditor key={editing.id} asset={editing} onDone={() => { setEditing(null); router.refresh(); }} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContentView({ value }: { value: unknown }) {
  if (typeof value === "string" || typeof value === "number") return <p className="whitespace-pre-wrap">{String(value)}</p>;
  if (Array.isArray(value)) {
    if (value.every((x) => typeof x === "string")) return <p>{value.join(", ") || "—"}</p>;
    return <div className="space-y-3">{value.map((x, i) => <div key={i} className="rounded-lg border border-border bg-white p-2.5"><ContentView value={x} /></div>)}</div>;
  }
  if (value && typeof value === "object") {
    return (
      <dl className="space-y-1.5">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{humanize(k)}</dt>
            <dd><ContentView value={v} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}

/** Generic editor: walks the asset's structure, so every asset type is editable without a form per type. */
function AssetEditor({ asset, onDone }: { asset: AssetCard; onDone: () => void }) {
  const [title, setTitle] = useState(asset.title);
  const [content, setContent] = useState<unknown>(structuredClone(asset.content));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveAssetVersionAction(asset.id, { title, content });
          if (!r.ok) return setError(r.error);
          toast.success("Saved as a new version");
          onDone();
        });
      }}
    >
      <div className="space-y-1.5"><Label htmlFor="ae-title">Title</Label><Input id="ae-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <Fields value={content} path="c" onChange={setContent} />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end"><Button type="submit" variant="gradient" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Save new version</Button></div>
    </form>
  );
}

function Fields({ value, path, onChange, label }: { value: unknown; path: string; onChange: (v: unknown) => void; label?: string }) {
  const id = `f-${path}`;
  if (typeof value === "string") {
    return (
      <div className="space-y-1.5">
        {label ? <Label htmlFor={id}>{label}</Label> : null}
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={value.length > 140 ? 5 : 2} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm" />
      </div>
    );
  }
  if (typeof value === "number") {
    return <div className="space-y-1.5">{label ? <Label htmlFor={id}>{label}</Label> : null}<Input id={id} type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-32" /></div>;
  }
  if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
    return (
      <div className="space-y-1.5">
        {label ? <Label htmlFor={id}>{label} (one per line)</Label> : null}
        <textarea id={id} value={value.join("\n")} onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} rows={3} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm" />
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <fieldset className="space-y-3">
        {label ? <legend className="text-sm font-medium">{label}</legend> : null}
        {value.map((item, i) => (
          <div key={i} className="rounded-xl border border-border p-3">
            <p className="mb-2 text-xs text-muted-foreground">#{i + 1}</p>
            <Fields value={item} path={`${path}-${i}`} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
          </div>
        ))}
      </fieldset>
    );
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      <div className="space-y-3">
        {label ? <p className="text-sm font-medium">{label}</p> : null}
        {Object.entries(obj).map(([k, v]) => <Fields key={k} value={v} path={`${path}-${k}`} label={humanize(k)} onChange={(nv) => onChange({ ...obj, [k]: nv })} />)}
      </div>
    );
  }
  return null;
}
