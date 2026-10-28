import type { CSSProperties, ReactNode } from "react";
import { inkOn, logoFullSvg, logoMarkSvg, svgDataUrl, type StoredBrand } from "@/lib/brand-kit";
import { googleFontsHref, landingLogo, landingStyleSchema, resolveTheme, type LandingStyle } from "@/lib/landing-themes";
import type { LandingContent } from "@/lib/validation/experiments";
import { cn } from "@/lib/utils";

/*
 * Renders a waitlist landing page in its chosen theme. Used by the public page (/p/[slug]) and the
 * editor preview, so what founders see is what visitors get. Layouts respond to their container
 * (not the viewport), so the preview shows the real desktop or mobile layout at any size.
 * `cta` is the waitlist form on the public page and a static mock-up in the preview.
 */

export function landingDisplayName(style: LandingStyle, brand: StoredBrand | null, projectName: string) {
  const usesBrand = !!brand && (style.theme === "brand" || style.logo.source === "brand");
  return usesBrand ? (brand.names[brand.chosen]?.name ?? brand.names[0].name) : projectName;
}

export function LandingView({ content, brand, projectName, cta, footer, heroUrl }: { content: LandingContent; brand: StoredBrand | null; projectName: string; cta: ReactNode; footer?: ReactNode; heroUrl?: string | null }) {
  const style = landingStyleSchema.parse(content.style ?? {});
  const theme = resolveTheme(style.theme, brand);
  const p = theme.palette;
  const name = landingDisplayName(style, brand, projectName);
  const logoKit = landingLogo(style, theme, brand, name);
  const onPrimary = inkOn(p.primary);
  const vars = {
    "--lp-primary": p.primary,
    "--lp-on-primary": onPrimary,
    "--lp-secondary": p.secondary,
    "--lp-accent": p.accent,
    "--lp-bg": p.background,
    "--lp-text": p.text,
    "--lp-surface": theme.dark ? "rgb(255 255 255 / 0.06)" : "#ffffff",
    "--lp-line": theme.dark ? "rgb(255 255 255 / 0.12)" : "rgb(0 0 0 / 0.08)",
    "--lp-heading": `"${theme.fonts.heading}", system-ui, sans-serif`,
    "--lp-body": `"${theme.fonts.body}", system-ui, sans-serif`,
    background: theme.hero ? `${theme.hero}, ${p.background}` : p.background,
    color: p.text,
    fontFamily: "var(--lp-body)",
    colorScheme: theme.dark ? "dark" : "light",
  } as CSSProperties;

  const heading = { fontFamily: "var(--lp-heading)" } satisfies CSSProperties;
  const badge = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--lp-line)] bg-[var(--lp-surface)] px-3 py-1 text-xs font-medium">
      <span className="size-1.5 rounded-full bg-[var(--lp-accent)]" /> Early access
    </span>
  );
  const check = <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-[var(--lp-primary)] text-[11px] text-[var(--lp-on-primary)]">✓</span>;

  return (
    <div className="@container flex min-h-full flex-col" style={vars} data-theme-id={theme.id}>
      {/* Loads only the theme's two Google Fonts. */}
      <link rel="stylesheet" href={googleFontsHref(theme.fonts)} />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 @3xl:px-8">
        {style.logo.show ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated SVG data URL
          <img src={svgDataUrl(logoFullSvg({ ...logoKit, palette: { ...logoKit.palette, text: p.text }, fonts: theme.fonts }, name))} alt={name} className="h-9 w-auto max-w-[70%]" />
        ) : (
          <span className="text-lg font-bold" style={heading}>{name}</span>
        )}
        <span className="hidden text-sm opacity-70 @md:inline">Launching soon</span>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 @3xl:px-8">
        {theme.layout === "split" ? (
          <div className="grid items-center gap-10 pt-8 @3xl:grid-cols-[1.15fr_1fr] @3xl:pt-16">
            <div>
              {badge}
              <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight @3xl:text-6xl" style={heading}>{content.headline}</h1>
              <p className="mt-5 max-w-xl text-lg opacity-75">{content.subheadline}</p>
              <div className="mt-8 [&>div]:mx-0 [&_form]:mx-0">{cta}</div>
            </div>
            <div className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-6 shadow-[0_24px_60px_-30px_rgb(0_0_0/0.35)]">
              <p className="text-sm font-semibold uppercase tracking-wider opacity-60">What you get</p>
              <ul className="mt-4 space-y-3">
                {content.bullets.map((b, i) => <li key={i} className="flex items-start gap-3 text-[15px]">{check}{b}</li>)}
              </ul>
            </div>
          </div>
        ) : theme.layout === "bold" ? (
          <>
            <section className="mt-4 overflow-hidden rounded-3xl px-6 py-14 text-center @3xl:px-14 @3xl:py-20" style={{ background: `linear-gradient(135deg, ${p.primary} 0%, ${p.primary} 55%, ${p.secondary} 140%)`, color: onPrimary }}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium"><span className="size-1.5 rounded-full bg-[var(--lp-accent)]" /> Early access</span>
              <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-bold leading-[1.02] tracking-tight @3xl:text-7xl" style={heading}>{content.headline}</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg opacity-85">{content.subheadline}</p>
              <div className="mt-9 rounded-2xl bg-[var(--lp-bg)] p-4 text-[var(--lp-text)] @md:mx-auto @md:max-w-lg">{cta}</div>
            </section>
            <ul className={cn("mt-8 grid gap-4", content.bullets.length > 1 && "@3xl:grid-cols-3")}>
              {content.bullets.map((b, i) => (
                <li key={i} className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-5 text-[15px]">
                  <span className="text-2xl font-bold text-[var(--lp-primary)]" style={heading}>{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-2">{b}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col items-center pt-10 text-center @3xl:pt-20">
            {style.logo.show ? (
              // eslint-disable-next-line @next/next/no-img-element -- generated SVG data URL
              <img src={svgDataUrl(logoMarkSvg(logoKit, 128))} alt="" className="mb-6 size-16" />
            ) : null}
            {badge}
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight @3xl:text-6xl" style={heading}>{content.headline}</h1>
            <p className="mt-5 max-w-xl text-lg opacity-75">{content.subheadline}</p>
            <ul className="mt-8 grid w-full max-w-xl gap-2 text-left">
              {content.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl border border-[var(--lp-line)] bg-[var(--lp-surface)] px-4 py-3 text-[15px]">{check}{b}</li>
              ))}
            </ul>
            <div className="mt-10 w-full">{cta}</div>
          </div>
        )}
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated hero, served by our own route
          <img src={heroUrl} alt="" className="mt-12 aspect-video w-full rounded-3xl border border-[var(--lp-line)] object-cover shadow-[0_24px_60px_-30px_rgb(0_0_0/0.35)]" />
        ) : null}
      </main>
      {footer ? <footer className="pb-6 text-center text-xs opacity-50">{footer}</footer> : null}
    </div>
  );
}

/** Static stand-in for the waitlist form, for previews. */
export function CtaMock({ label }: { label: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2 @md:flex-row">
      <span className="flex h-12 w-full items-center rounded-xl @md:flex-1 border border-[var(--lp-line)] bg-[var(--lp-surface)] px-4 text-left text-[15px] opacity-60">you@company.com</span>
      <span className="flex h-12 items-center justify-center rounded-xl bg-[var(--lp-primary)] px-5 text-[15px] font-medium text-[var(--lp-on-primary)]">{label || "Join"}</span>
    </div>
  );
}
