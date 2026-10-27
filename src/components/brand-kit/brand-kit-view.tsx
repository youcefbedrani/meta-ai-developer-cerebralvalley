"use client";

import { Check, Copy, Download, Palette, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { chooseBrandLogoAction, chooseBrandNameAction, generateBrandKitAction } from "@/app/(app)/app/(founder)/projects/[id]/brand/actions";
import { Button } from "@/components/ui/button";
import { contrast, cssVariables, inkOn, logoFullSvg, logoMarkSvg, logoVariants, svgDataUrl, type StoredBrand } from "@/lib/brand-kit";
import { cn } from "@/lib/utils";

function download(filename: string, svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`), () => toast.error("Couldn't copy"));

export function BrandKitView({ projectId, kit, cost, balance }: { projectId: string; kit: StoredBrand | null; cost: number; balance: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const generate = () =>
    start(async () => {
      const r = await generateBrandKitAction(projectId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Brand Kit ready");
      router.refresh();
    });

  if (!kit) {
    return (
      <section className="surface ambient-glow flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow"><Palette className="size-4" /></span>
          <div>
            <p className="font-medium">Create your Brand Kit</p>
            <p className="text-sm text-muted-foreground">Name ideas, a tagline in your customers&apos; words, a colour palette, fonts and a logo you can download as SVG. {cost} credits · {balance} left</p>
          </div>
        </div>
        <Button variant="gradient" className="h-10 px-5" disabled={pending || balance < cost} onClick={generate}>
          <Palette /> {pending ? "Designing…" : "Create Brand Kit"}
        </Button>
      </section>
    );
  }

  const name = kit.names[kit.chosen]?.name ?? kit.names[0].name;
  const mark = logoMarkSvg(kit, 128);
  const full = logoFullSvg(kit, name);
  const fontsHref = `https://fonts.googleapis.com/css2?${[...new Set([kit.fonts.heading, kit.fonts.body])].map((f) => `family=${f.replace(/ /g, "+")}:wght@400;700`).join("&")}&display=swap`;
  const textRatio = contrast(kit.palette.text, kit.palette.background);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="space-y-6">
      {/* Preview only: loads the two chosen Google Fonts. */}
      <link rel="stylesheet" href={fontsHref} />

      <section className="surface overflow-hidden">
        <div className="p-8 sm:p-10" style={{ background: kit.palette.background, color: kit.palette.text }}>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG data URL */}
            <img src={svgDataUrl(logoMarkSvg(kit))} alt="" className="animate-pop size-12" />
            <span className="text-2xl font-bold" style={{ fontFamily: `"${kit.fonts.heading}", system-ui` }}>{name}</span>
          </div>
          <p className="mt-6 max-w-xl text-3xl font-bold leading-tight sm:text-4xl" style={{ fontFamily: `"${kit.fonts.heading}", system-ui` }}>{kit.tagline}</p>
          <p className="mt-3 max-w-xl text-base opacity-80" style={{ fontFamily: `"${kit.fonts.body}", system-ui` }}>{kit.rationale}</p>
          <span className="mt-6 inline-block rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: kit.palette.primary, color: inkOn(kit.palette.primary) }}>Join the waitlist</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-sm">
          <span className="text-muted-foreground">Voice: {kit.voice.join(" · ")}</span>
          <Button variant="outline" size="sm" className="rounded-[10px]" disabled={pending || balance < cost} onClick={generate}>
            <RefreshCw /> {pending ? "Designing…" : `Regenerate · ${cost} credits`}
          </Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="font-medium">Name ideas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Pick one. Check the domain and trademark yourself before you commit; we can&apos;t verify availability.</p>
          <ul className="mt-3 space-y-2">
            {kit.names.map((n, i) => (
              <li key={n.name}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(async () => { const r = await chooseBrandNameAction(projectId, i); if (!r.ok) toast.error(r.error); else router.refresh(); })}
                  className={cn("flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left text-sm transition-colors hover:bg-muted/50", i === kit.chosen && "border-primary/60 bg-primary/5")}
                  aria-pressed={i === kit.chosen}
                >
                  <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", i === kit.chosen ? "border-primary bg-primary text-white" : "border-border")}>{i === kit.chosen ? <Check className="size-3" /> : null}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{n.name}</span> <span className="text-xs text-muted-foreground">· try {n.domainIdea}</span>
                    <span className="block text-muted-foreground">{n.why}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface p-5">
          <h2 className="font-medium">Logo</h2>
          <div className="mt-3 flex flex-wrap items-center gap-6 rounded-xl border border-border bg-white p-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG data URL */}
            <img src={svgDataUrl(mark)} alt={`${name} logo mark`} className="animate-float size-20" />
            {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG data URL */}
            <img src={svgDataUrl(full)} alt={`${name} logo`} className="h-12 w-auto max-w-full" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-[10px]" onClick={() => download(`${slug}-mark.svg`, mark)}><Download /> Mark (SVG)</Button>
            <Button variant="outline" size="sm" className="rounded-[10px]" onClick={() => download(`${slug}-logo.svg`, full)}><Download /> Full logo (SVG)</Button>
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-sm font-medium">Logo studio</p>
            <p className="text-xs text-muted-foreground">More options in your colours. Pick one; it&apos;s free and updates your landing page and designs.</p>
            <ul className="mt-3 grid grid-cols-6 gap-2" role="radiogroup" aria-label="Logo options">
              {logoVariants(kit).map((v) => {
                const active = v.shape === kit.logo.shape && v.symbol === kit.logo.symbol && (!!v.symbol || v.initials === kit.logo.initials);
                const label = v.symbol ? `${v.symbol} symbol` : `${v.shape} with initials`;
                return (
                  <li key={`${v.shape}-${v.symbol ?? "letters"}`}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={label}
                      title={label}
                      disabled={pending}
                      onClick={() => start(async () => { const r = await chooseBrandLogoAction(projectId, v); if (!r.ok) toast.error(r.error); else router.refresh(); })}
                      className={cn("grid aspect-square w-full place-items-center rounded-xl border bg-white p-1.5 transition-all hover:-translate-y-0.5 hover:shadow-md", active ? "border-primary ring-2 ring-primary/30" : "border-border")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG data URL */}
                      <img src={svgDataUrl(logoMarkSvg({ ...kit, logo: v }, 64))} alt="" className="size-full" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="surface p-5">
          <h2 className="font-medium">Colours</h2>
          <ul className="stagger mt-3 grid grid-cols-5 gap-2">
            {(Object.entries(kit.palette) as [string, string][]).map(([role, value]) => (
              <li key={role}>
                <button type="button" onClick={() => copy(value, value)} className="w-full text-left" aria-label={`Copy ${role} colour ${value}`}>
                  <span className="block h-14 rounded-lg border border-border transition-transform hover:-translate-y-0.5" style={{ background: value }} />
                  <span className="mt-1 block text-xs capitalize">{role}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">{value}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Text on background contrast: <b className="text-foreground">{textRatio.toFixed(1)}:1</b> {textRatio >= 7 ? "(AAA)" : textRatio >= 4.5 ? "(AA)" : "(too low)"}
          </p>
        </section>

        <section className="surface p-5">
          <h2 className="font-medium">Fonts</h2>
          <p className="mt-3 text-2xl font-bold" style={{ fontFamily: `"${kit.fonts.heading}", system-ui` }}>{kit.fonts.heading}</p>
          <p className="text-xs text-muted-foreground">Headings · free on Google Fonts</p>
          <p className="mt-3 text-base" style={{ fontFamily: `"${kit.fonts.body}", system-ui` }}>{kit.fonts.body}: the quick brown fox jumps over the lazy dog.</p>
          <p className="text-xs text-muted-foreground">Body text · free on Google Fonts</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-[10px]" onClick={() => copy(cssVariables(kit), "CSS variables")}><Copy /> Copy as CSS variables</Button>
        </section>
      </div>
    </div>
  );
}
