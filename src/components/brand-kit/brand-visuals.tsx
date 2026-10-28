"use client";

import { Download, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { generateBrandVisualsAction } from "@/app/(app)/app/(founder)/projects/[id]/brand/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VisualAsset = {
  id: string;
  kind: "logo" | "hero" | "ad";
  channel: string | null;
  headline: string | null;
  rationale: string | null;
  width: number;
  height: number;
  hasCutout: boolean;
  createdAt: string;
};

const CHECKER = "bg-[length:16px_16px] bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[position:0_0,0_8px,8px_-8px,-8px_0]";

/** Brand visuals: research-grounded briefs (Muse Spark) → images (Muse Image) → transparent logo (SAM 3.1). */
export function BrandVisuals({ projectId, assets, cost, balance, configured, hasKit }: { projectId: string; assets: VisualAsset[]; cost: number; balance: number; configured: boolean; hasKit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Show the most recent run: assets created within a minute of the newest one.
  const newest = assets[0] ? new Date(assets[0].createdAt).getTime() : 0;
  const latest = assets.filter((a) => newest - new Date(a.createdAt).getTime() < 60_000);
  const logo = latest.find((a) => a.kind === "logo");
  const hero = latest.find((a) => a.kind === "hero");
  const ads = latest.filter((a) => a.kind === "ad");

  const generate = () =>
    start(async () => {
      const r = await generateBrandVisualsAction(projectId);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${r.data.count} visuals ready`);
      router.refresh();
    });

  return (
    <section className="surface p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-medium">
            <ImageIcon className="size-4 text-primary" /> Brand visuals
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Muse Spark reads your research and writes an art-direction brief; Meta Muse Image renders a logo mark, a landing hero and an ad for each channel; SAM 3.1 cuts the
            logo out on a transparent background. Headlines are drawn on in your brand colours · {cost} credits · {balance} left
          </p>
        </div>
        <Button variant="gradient" className="h-10 shrink-0 px-5" onClick={generate} disabled={pending || !configured || !hasKit || balance < cost}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {pending ? "Designing (about 30 s)…" : latest.length ? "Make a new set" : "Generate visuals"}
        </Button>
      </div>
      {!hasKit ? <p className="mt-3 text-sm text-muted-foreground">Generate the Brand Kit above first: the visuals use its name, palette and voice.</p> : null}
      {!configured ? <p className="mt-3 text-sm text-warning">Brand visuals need the Meta Model API (AI_BASE_URL=https://api.meta.ai/v1).</p> : null}

      {latest.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {logo ? (
            <figure className="rounded-xl border border-border p-3">
              <div className={cn("grid aspect-square place-items-center overflow-hidden rounded-lg", logo.hasCutout ? CHECKER : "bg-white")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked images */}
                <img src={`/api/images/${logo.id}${logo.hasCutout ? "?v=cutout" : ""}`} alt="Logo mark" className="max-h-[80%] max-w-[80%] object-contain" />
              </div>
              <figcaption className="mt-2 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">Logo mark{logo.hasCutout ? " · transparent" : ""}</span>
                <DownloadLink href={`/api/images/${logo.id}?download=1${logo.hasCutout ? "&v=cutout" : ""}`} />
              </figcaption>
              {logo.rationale ? <p className="mt-1 text-xs text-muted-foreground">{logo.rationale}</p> : null}
            </figure>
          ) : null}
          {hero ? (
            <figure className="rounded-xl border border-border p-3 lg:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked images */}
              <img src={`/api/images/${hero.id}`} alt="Landing page hero" className="aspect-video w-full rounded-lg object-cover" />
              <figcaption className="mt-2 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">Landing hero</span>
                <DownloadLink href={`/api/images/${hero.id}?download=1`} />
              </figcaption>
              {hero.rationale ? <p className="mt-1 text-xs text-muted-foreground">{hero.rationale}</p> : null}
            </figure>
          ) : null}
          {ads.map((ad) => (
            <figure key={ad.id} className="rounded-xl border border-border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked images */}
              <img src={`/api/images/${ad.id}`} alt={`${ad.channel} ad: ${ad.headline}`} className="w-full rounded-lg" style={{ aspectRatio: `${ad.width} / ${ad.height}` }} />
              <figcaption className="mt-2 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{ad.channel} ad</span>
                <DownloadLink href={`/api/images/${ad.id}?download=1`} />
              </figcaption>
              {ad.rationale ? <p className="mt-1 text-xs text-muted-foreground">{ad.rationale}</p> : null}
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DownloadLink({ href }: { href: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <Download className="size-3.5" /> PNG
    </a>
  );
}
