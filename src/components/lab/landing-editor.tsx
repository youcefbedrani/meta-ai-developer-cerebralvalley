"use client";

import { Check, ExternalLink, Eye, EyeOff, Loader2, Monitor, Palette, Plus, Smartphone, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createLandingPageAction,
  deleteLandingPageAction,
  generateLandingCopyAction,
  publishLandingPageAction,
  updateLandingPageAction,
} from "@/app/(app)/app/(founder)/lab/actions";
import { generateBrandKitAction } from "@/app/(app)/app/(founder)/projects/[id]/brand/actions";
import { CtaMock, LandingView, landingDisplayName } from "@/components/public/landing-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LOGO_SHAPES, logoMarkSvg, svgDataUrl, type StoredBrand } from "@/lib/brand-kit";
import { initialsOf, LANDING_THEMES, landingLogo, landingStyleSchema, resolveTheme, type LandingStyle, type LandingTheme } from "@/lib/landing-themes";
import { cn } from "@/lib/utils";
import type { LandingContent } from "@/lib/validation/experiments";

type Common = { projectId: string; projectName: string; brand: StoredBrand | null; brandCost: number; aiConfigured: boolean; copyCost: number; appUrl: string; heroImages: string[] };
type Props =
  | (Common & { mode: "create"; suggestedSlug: string; experiments: { id: string; title: string }[] })
  | (Common & { mode: "edit"; pageId: string; initial: LandingContent; slug: string; published: boolean });

const blank: LandingContent = { headline: "", subheadline: "", bullets: [""], ctaLabel: "Join the waitlist" };
const defaultStyle = (brand: StoredBrand | null): LandingStyle => landingStyleSchema.parse(brand ? { theme: "brand", logo: { source: "brand" } } : {});

export function LandingEditor(props: Props) {
  const router = useRouter();
  const [content, setContent] = useState<LandingContent>(() => {
    const c = props.mode === "edit" ? props.initial : blank;
    return { ...c, style: c.style ? landingStyleSchema.parse(c.style) : defaultStyle(props.brand) };
  });
  const style = landingStyleSchema.parse(content.style ?? {});
  const setStyle = (next: Partial<LandingStyle>) => setContent((c) => ({ ...c, style: { ...landingStyleSchema.parse(c.style ?? {}), ...next } }));
  const setLogo = (next: Partial<LandingStyle["logo"]>) => setStyle({ logo: { ...style.logo, ...next } });
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [slug, setSlug] = useState(props.mode === "edit" ? props.slug : props.suggestedSlug);
  const [experimentId, setExperimentId] = useState<string>("");
  const [successCriteria, setSuccessCriteria] = useState("At least 5% of unique visitors join the waitlist");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const set = <K extends keyof LandingContent>(k: K, v: LandingContent[K]) => setContent((c) => ({ ...c, [k]: v }));
  const refs = content.quoteRefs;
  const based = (n?: number) => (n ? <span className="ml-2 text-xs font-normal text-muted-foreground">Based on {n} quote{n === 1 ? "" : "s"}</span> : null);
  const removeBullet = (i: number) =>
    setContent((c) => ({ ...c, bullets: c.bullets.filter((_, j) => j !== i), quoteRefs: c.quoteRefs ? { ...c.quoteRefs, bullets: c.quoteRefs.bullets.filter((_, j) => j !== i) } : undefined }));
  const addBullet = () => setContent((c) => ({ ...c, bullets: [...c.bullets, ""], quoteRefs: c.quoteRefs ? { ...c.quoteRefs, bullets: [...c.quoteRefs.bullets, []] } : undefined }));
  const fe = (k: string) => errors[k]?.[0] ?? errors[`content.${k}`]?.[0];

  const run = (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    start(async () => {
      await fn();
      setBusy(null);
    });
  };

  function save() {
    run("save", async () => {
      const keep = content.bullets.map((b) => b.trim().length > 0);
      const payload: LandingContent = {
        ...content,
        bullets: content.bullets.map((b) => b.trim()).filter(Boolean),
        quoteRefs: content.quoteRefs ? { ...content.quoteRefs, bullets: content.quoteRefs.bullets.filter((_, i) => keep[i]) } : undefined,
      };
      const r =
        props.mode === "create"
          ? await createLandingPageAction(props.projectId, { content: payload, slug, experimentId: experimentId || null, successCriteria })
          : await updateLandingPageAction(props.pageId, { content: payload, slug });
      if (r && !r.ok) {
        setError(r.error);
        setErrors(r.fieldErrors ?? {});
        return;
      }
      if (props.mode === "edit") {
        toast.success("Page saved");
        router.refresh();
      }
    });
  }

  const publicUrl = `${props.appUrl.replace(/\/$/, "")}/p/${slug}`;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="space-y-6">
      {props.heroImages.length ? (
        <div className="surface p-6">
          <h2 className="font-medium">Hero image</h2>
          <p className="mt-1 text-xs text-muted-foreground">From your Brand visuals (Meta Muse Image). Shown under the headline.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setStyle({ heroImageId: undefined })} className={cn("h-16 w-28 rounded-lg border text-xs", !style.heroImageId ? "border-primary ring-2 ring-primary/30" : "border-border text-muted-foreground")}>
              None
            </button>
            {props.heroImages.map((id) => (
              <button key={id} type="button" onClick={() => setStyle({ heroImageId: id })} className={cn("overflow-hidden rounded-lg border", style.heroImageId === id ? "border-primary ring-2 ring-primary/30" : "border-border")} aria-label="Use this hero image">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image */}
                <img src={`/api/images/${id}`} alt="" className="h-16 w-28 object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <ThemeAndLogo
        projectId={props.projectId}
        projectName={props.projectName}
        brand={props.brand}
        brandCost={props.brandCost}
        aiConfigured={props.aiConfigured}
        style={style}
        setStyle={setStyle}
        setLogo={setLogo}
      />
      <div className="surface space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Page content</h2>
          <Button
            variant="outline"
            className="rounded-[10px]"
            disabled={pending || !props.aiConfigured}
            onClick={() =>
              run("ai", async () => {
                const r = await generateLandingCopyAction(props.projectId);
                if (!r.ok) return setError(r.error);
                setContent((c) => ({ ...r.data, style: c.style }));
                toast.success("Draft copy generated from your research");
              })
            }
          >
            {busy === "ai" ? <Loader2 className="animate-spin" /> : <Sparkles />} Draft from research · {props.copyCost} credits
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">This is a test page for an unbuilt product. Don&apos;t add testimonials, user counts or claims you can&apos;t back up.</p>
        <div className="space-y-1.5">
          <Label htmlFor="lp-headline">Headline{based(refs?.headline.length)}</Label>
          <Input id="lp-headline" value={content.headline} maxLength={90} onChange={(e) => set("headline", e.target.value)} className="h-10" />
          {fe("headline") ? <p className="text-xs text-destructive">{fe("headline")}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lp-sub">Subheadline{based(refs?.subheadline.length)}</Label>
          <Textarea id="lp-sub" rows={2} value={content.subheadline} maxLength={240} onChange={(e) => set("subheadline", e.target.value)} />
          {fe("subheadline") ? <p className="text-xs text-destructive">{fe("subheadline")}</p> : null}
        </div>
        <div className="space-y-2">
          <Label>Key points</Label>
          {content.bullets.map((b, i) => (
            <div key={i} className="flex gap-2">
              <div className="flex-1">
                <Input aria-label={`Key point ${i + 1}`} value={b} maxLength={140} onChange={(e) => set("bullets", content.bullets.map((x, j) => (j === i ? e.target.value : x)))} className="h-10" />
                {refs?.bullets[i]?.length ? <p className="mt-1 text-xs text-muted-foreground">Based on {refs.bullets[i].length} quote{refs.bullets[i].length === 1 ? "" : "s"}</p> : null}
              </div>
              <Button variant="ghost" size="icon" aria-label="Remove point" disabled={content.bullets.length <= 1} onClick={() => removeBullet(i)}>
                <X />
              </Button>
            </div>
          ))}
          {content.bullets.length < 5 ? (
            <Button variant="ghost" size="sm" onClick={addBullet}>
              <Plus /> Add point
            </Button>
          ) : null}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lp-cta">Button label</Label>
            <Input id="lp-cta" value={content.ctaLabel} maxLength={30} onChange={(e) => set("ctaLabel", e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lp-slug">Address</Label>
            <div className="flex items-center rounded-lg border border-input pl-3 text-sm focus-within:ring-3 focus-within:ring-ring/50">
              <span className="shrink-0 text-muted-foreground">/p/</span>
              <input id="lp-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} className="h-10 min-w-0 flex-1 bg-transparent px-1 outline-none" />
            </div>
            {fe("slug") || errors[""]?.[0] ? <p className="text-xs text-destructive">{fe("slug") ?? errors[""]?.[0]}</p> : null}
          </div>
        </div>
        {props.mode === "create" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lp-exp">Experiment</Label>
              <select id="lp-exp" value={experimentId} onChange={(e) => setExperimentId(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm">
                <option value="" className="bg-popover">Create a new waitlist experiment</option>
                {props.experiments.map((e) => <option key={e.id} value={e.id} className="bg-popover">{e.title}</option>)}
              </select>
            </div>
            {!experimentId ? (
              <div className="space-y-1.5">
                <Label htmlFor="lp-success">Success criteria</Label>
                <Input id="lp-success" value={successCriteria} onChange={(e) => setSuccessCriteria(e.target.value)} className="h-10" />
              </div>
            ) : null}
          </div>
        ) : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          {props.mode === "edit" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="rounded-[10px]"
                disabled={pending}
                onClick={() =>
                  run("publish", async () => {
                    const r = await publishLandingPageAction(props.pageId, !props.published);
                    if (!r.ok) return setError(r.error);
                    toast.success(props.published ? "Page unpublished" : "Page published");
                    router.refresh();
                  })
                }
              >
                {props.published ? <EyeOff /> : <Eye />} {props.published ? "Unpublish" : "Publish"}
              </Button>
              {props.published ? (
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  Open page <ExternalLink className="size-3.5" />
                </a>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete page"
                onClick={() => {
                  if (window.confirm("Delete this landing page and its waitlist?")) run("delete", async () => void (await deleteLandingPageAction(props.pageId, props.projectId)));
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ) : (
            <span />
          )}
          <Button variant="gradient" className="h-10 px-5" disabled={pending} onClick={save}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : null} {props.mode === "create" ? "Create page" : "Save changes"}
          </Button>
        </div>
      </div>

      </div>

      <div className="space-y-2 xl:sticky xl:top-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Live preview</p>
          <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Preview size">
            {(["desktop", "mobile"] as const).map((d) => (
              <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs capitalize transition-colors", device === d ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {d === "desktop" ? <Monitor className="size-3.5" /> : <Smartphone className="size-3.5" />} {d}
              </button>
            ))}
          </div>
        </div>
        <PreviewFrame width={device === "desktop" ? 1200 : 390} className={device === "mobile" ? "mx-auto max-w-[330px]" : undefined}>
          <LandingView
            content={{ ...content, headline: content.headline || "Your headline", subheadline: content.subheadline || "Your subheadline goes here.", bullets: content.bullets.some((b) => b.trim()) ? content.bullets.filter((b) => b.trim()) : ["Your first key point"] }}
            brand={props.brand}
            projectName={props.projectName}
            cta={<CtaMock label={content.ctaLabel} />}
            heroUrl={style.heroImageId ? `/api/images/${style.heroImageId}` : null}
          />
        </PreviewFrame>
      </div>
    </div>
  );
}

/** Shows a page at a fixed design width, zoomed to fit the column, like a browser window. */
function PreviewFrame({ width, className, children }: { width: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={cn("overflow-hidden rounded-2xl border border-border shadow-sm", className)} data-testid="landing-preview">
      <div style={{ width, zoom: scale }} className="pointer-events-none select-none">
        {children}
      </div>
    </div>
  );
}

function ThemeAndLogo({
  projectId,
  projectName,
  brand,
  brandCost,
  aiConfigured,
  style,
  setStyle,
  setLogo,
}: {
  projectId: string;
  projectName: string;
  brand: StoredBrand | null;
  brandCost: number;
  aiConfigured: boolean;
  style: LandingStyle;
  setStyle: (s: Partial<LandingStyle>) => void;
  setLogo: (l: Partial<LandingStyle["logo"]>) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const theme = resolveTheme(style.theme, brand);
  const name = landingDisplayName(style, brand, projectName);
  const themes: LandingTheme[] = [
    ...(brand ? [resolveTheme("brand", brand)] : []),
    ...LANDING_THEMES,
  ];
  const generate = () =>
    start(async () => {
      const r = await generateBrandKitAction(projectId);
      if (!r.ok) return void toast.error(r.error);
      setStyle({ theme: "brand", logo: { ...style.logo, show: true, source: "brand" } });
      toast.success("Your logo and Brand Kit are ready");
      router.refresh();
    });

  return (
    <section className="surface space-y-5 p-6">
      <div>
        <h2 className="font-medium">Theme</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Pick a ready-made look. You can switch any time; your text stays the same.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
        {themes.map((t) => {
          const active = theme.id === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setStyle(t.id === "brand" ? { theme: "brand", logo: { ...style.logo, source: "brand" } } : { theme: t.id })}
              className={cn("group overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-md", active ? "border-primary ring-2 ring-primary/30" : "border-border")}
            >
              <span className="relative block h-16 p-2.5" style={{ background: t.hero ? `${t.hero}, ${t.palette.background}` : t.palette.background, color: t.palette.text }}>
                <span className="block text-[15px] font-bold leading-none" style={{ fontFamily: `"${t.fonts.heading}", system-ui` }}>Aa</span>
                <span className="mt-2 flex gap-1">
                  {[t.palette.primary, t.palette.secondary, t.palette.accent].map((c) => <span key={c} className="size-3 rounded-full ring-1 ring-black/10" style={{ background: c }} />)}
                </span>
                {active ? <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-primary text-white"><Check className="size-3" /></span> : null}
              </span>
              <span className="block px-2.5 py-2">
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="block text-[11px] capitalize text-muted-foreground">{t.layout} layout</span>
              </span>
            </button>
          );
        })}
      </div>
      {!brand ? <p className="text-xs text-muted-foreground">Want a theme in your own colours? Create a Brand Kit below and a &quot;My brand&quot; theme appears here.</p> : null}

      <div className="border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Logo</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Free logo from your initials, or your AI Brand Kit logo.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={style.logo.show} onChange={(e) => setLogo({ show: e.target.checked })} className="size-4 accent-[var(--primary)]" /> Show logo
          </label>
        </div>
        {style.logo.show ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Logo">
              {brand ? (
                <LogoTile label="Brand Kit" active={style.logo.source === "brand"} svg={logoMarkSvg(brand, 64)} onClick={() => setLogo({ source: "brand" })} />
              ) : null}
              {LOGO_SHAPES.map((shape) => (
                <LogoTile
                  key={shape}
                  label={shape}
                  active={style.logo.source === "generated" && style.logo.shape === shape}
                  svg={logoMarkSvg(landingLogo({ ...style, logo: { ...style.logo, source: "generated", shape } }, theme, brand, name), 64)}
                  onClick={() => setLogo({ source: "generated", shape })}
                />
              ))}
            </div>
            {style.logo.source === "generated" ? (
              <div className="mt-3 flex items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lp-initials">Letters</Label>
                  <Input id="lp-initials" value={style.logo.initials ?? ""} placeholder={initialsOf(name)} maxLength={2} onChange={(e) => setLogo({ initials: e.target.value.trim() ? e.target.value.toUpperCase() : undefined })} className="h-10 w-24 uppercase" />
                </div>
                <p className="pb-2 text-xs text-muted-foreground">Uses the theme&apos;s colours and font.</p>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {brand ? "Want a fresh look? Regenerate your Brand Kit: new logo, colours, fonts and name ideas." : "Generate your own logo with AI: a Brand Kit with a logo, colours, fonts and name ideas, made from your research."}
          </p>
          <Button variant="outline" className="shrink-0 rounded-[10px]" disabled={pending || !aiConfigured} onClick={generate}>
            {pending ? <Loader2 className="animate-spin" /> : <Palette />} {brand ? "Regenerate" : "Generate my logo"} · {brandCost} credits
          </Button>
        </div>
      </div>
    </section>
  );
}

function LogoTile({ label, active, svg, onClick }: { label: string; active: boolean; svg: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={active} aria-label={`${label} logo`} onClick={onClick} className={cn("flex w-[72px] flex-col items-center gap-1 rounded-xl border p-2 text-[11px] capitalize transition-colors hover:bg-muted/50", active ? "border-primary bg-primary/5 ring-2 ring-primary/25" : "border-border")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG data URL */}
      <img src={svgDataUrl(svg)} alt="" className="size-10" />
      {label}
    </button>
  );
}
