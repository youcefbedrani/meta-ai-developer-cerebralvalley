import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/*
 * Startum logo: a text wordmark, "Startum." in Bricolage Grotesque ExtraBold (--font-logo, loaded in
 * the root layout), with the full stop in the brand gradient (coral → magenta → violet).
 * - <Wordmark />: the logo. Sized by font-size, so it inherits from its parent or takes a text-* class.
 * - <LogoMark />: the compact "S." for small square spots (icons, cards); sized by width/height.
 * - <LogoLoader />: the wordmark with a bouncing full stop (a gentle fade under prefers-reduced-motion).
 * The favicon (src/app/icon.png) and public/brand/startum-logo.* are rendered from the same font.
 */

const word = BRAND.name;

export function Wordmark({ className, dotClassName, animated = false }: { className?: string; dotClassName?: string; animated?: boolean }) {
  return (
    <span className={cn("logo-wordmark inline-flex items-baseline whitespace-nowrap font-logo font-extrabold leading-none tracking-[-0.045em]", animated && "logo-anim", className)} aria-label={word}>
      <span aria-hidden="true">{word}</span>
      <span aria-hidden="true" className={cn("logo-dot", dotClassName)}>.</span>
    </span>
  );
}

export function LogoMark({ className, style, animated = false, title }: { className?: string; style?: React.CSSProperties; animated?: boolean; title?: string }) {
  return (
    <span
      className={cn("logo-mark inline-grid size-7 shrink-0 place-items-center rounded-[28%] bg-[var(--plum,#41175e)] text-white", animated && "logo-anim", className)}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="0 0 64 64" className="size-full" aria-hidden="true">
        <defs>
          <linearGradient id="startum-dot" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F77373" />
            <stop offset="50%" stopColor="#C762F6" />
            <stop offset="100%" stopColor="#B892FF" />
          </linearGradient>
        </defs>
        <text x="29" y="33" dy=".36em" textAnchor="middle" fill="currentColor" style={{ fontFamily: "var(--font-logo), system-ui, sans-serif", fontWeight: 800, fontSize: 40, letterSpacing: "-2px" }}>
          S
        </text>
        <circle className="logo-mark-dot" cx="47" cy="43" r="5" fill="url(#startum-dot)" />
      </svg>
    </span>
  );
}

/** The wordmark as a link. `tone="light"` for dark backgrounds. */
export function Logo({ href = "/", className, tone = "dark" }: { href?: string; className?: string; tone?: "dark" | "light" }) {
  return (
    <Link href={href} className={cn("inline-flex items-center", tone === "light" ? "text-white" : "text-foreground", className)}>
      <Wordmark className="text-[24px]" />
    </Link>
  );
}

/** Branded loading state. Announces itself to screen readers. */
export function LogoLoader({ label = "Loading…", className, size = "md" }: { label?: string; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground", className)}>
      {size === "sm" ? <LogoMark animated className="size-9" /> : <Wordmark animated className={cn("text-foreground", size === "lg" ? "text-5xl" : "text-3xl")} />}
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </div>
  );
}
