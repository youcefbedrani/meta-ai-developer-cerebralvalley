import { LogoMark } from "@/components/brand/logo";
/** SVG sprite + helpers for the landing page (ported from the static HTML design). */

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="lp-g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f77373" />
          <stop offset=".5" stopColor="#c762f6" />
          <stop offset="1" stopColor="#814bee" />
        </linearGradient>
      </defs>
      <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
      <symbol id="i-play" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m10 8.5 5.5 3.5-5.5 3.5z" /></symbol>
      <symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></symbol>
      <symbol id="i-lock" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></symbol>
      <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></symbol>
      <symbol id="i-flask" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7.5 15h9" /></symbol>
      <symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></symbol>
      <symbol id="i-term" viewBox="0 0 24 24"><path d="m5 17 5-5-5-5M12 19h7" /></symbol>
      <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></symbol>
      <symbol id="i-folder" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></symbol>
      <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></symbol>
      <symbol id="i-trend" viewBox="0 0 24 24"><path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" /></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></symbol>
      <symbol id="i-warn" viewBox="0 0 24 24"><path d="M12 3 2 20h20zM12 10v4M12 17.5v.5" /></symbol>
      <symbol id="i-list" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></symbol>
      <symbol id="i-scissors" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" /></symbol>
      <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 3v18h18M8 16v-5M13 16V8M18 16v-3" /></symbol>
      <symbol id="i-bulb" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></symbol>
    </svg>
  );
}

export function Ic({ id, className, style }: { id: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={`ic${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      <use href={`#i-${id}`} />
    </svg>
  );
}

export function LogoGlyph({ size = 22 }: { size?: number }) {
  return <LogoMark className="shrink-0" style={{ width: size, height: size }} />;
}

/** The two-arrow chip that slides on hover. */
export function ArrowChip() {
  return (
    <span className="chip">
      <Ic id="arrow" />
      <Ic id="arrow" />
    </span>
  );
}

export function Example({ label = "Example" }: { label?: string }) {
  return <span className="example">{label}</span>;
}
