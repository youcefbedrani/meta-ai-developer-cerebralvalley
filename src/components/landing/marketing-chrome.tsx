import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { EventMark, HACKATHON, HackathonLockup, MetaMark } from "@/components/brand/hackathon-lockup";
import { Wordmark } from "@/components/brand/logo";
import { ArrowChip, Ic } from "./icons";

/** Announcement bar + nav shared by public marketing pages. */
export function MarketingHeader() {
  return (
    <>
      {/* ANNOUNCEMENT */}
      <div className="announce">
        <span className="announce-marks" aria-hidden="true">
          <MetaMark /> <EventMark />
        </span>
        <span>
          Built for the <b>{HACKATHON.name}</b> — every AI feature runs on Meta&apos;s {HACKATHON.models}
        </span>
        <a href={HACKATHON.writeUp} target="_blank" rel="noopener noreferrer">
          What we built <Ic id="arrow" style={{ width: 14, height: 14 }} />
        </a>
      </div>

      {/* NAV */}
      <header className="nav" id="nav">
        <div className="nav-in">
          <Link href="/" className="brand" aria-label={`${BRAND.name} home`}>
            <HackathonLockup compact className="text-[25px] text-[var(--plum)]" />
          </Link>
          <nav className="nav-links">
            <Link href="/#mistakes">Why {BRAND.name}</Link>
            <Link href="/#features">Features</Link>
            <Link href="/#gold-mine">Gold Mine</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/#capabilities">Capabilities</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
          <div className="nav-cta">
            <Link href="/login" className="login">
              Log in
            </Link>
            <Link href="/signup" className="btn btn-dark">
              <span>
                Start<span className="txt-long"> free</span>
              </span>
              <ArrowChip />
            </Link>
            <button className="burger" id="burger" aria-label="Open menu" type="button">
              <Ic id="menu" />
            </button>
          </div>
        </div>
      </header>
      <div className="mobile-menu" id="mobileMenu">
        <Link href="/#features">Features</Link>
        <Link href="/#how">How it works</Link>
        <Link href="/#capabilities">Capabilities</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/#faq">FAQ</Link>
        <Link href="/login">Log in</Link>
      </div>
    </>
  );
}

export function MarketingFooter() {
  return (
    <>
        {/* ================= FOOTER ================= */}
        <footer>
          <div className="foot">
            <div className="about">
              <Link href="/" className="brand" aria-label={`${BRAND.name} home`}><Wordmark className="text-[25px] text-[var(--plum)]" /></Link>
              <p>{BRAND.tagline}</p>
            </div>
            <div><h6>Product</h6><ul><li><Link href="/#features">Features</Link></li><li><Link href="/#how">How it works</Link></li><li><Link href="/#capabilities">Capabilities</Link></li><li><Link href="/pricing">Pricing</Link></li></ul></div>
            <div><h6>Account</h6><ul><li><Link href="/signup">Create account</Link></li><li><Link href="/login">Log in</Link></li></ul></div>
            <div><h6>Help</h6><ul><li><Link href="/#faq">FAQ</Link></li><li><a href={`mailto:${BRAND.supportEmail}`}>Contact</a></li></ul></div>
            <div><h6>Legal</h6><ul><li><Link href="/terms">Terms</Link></li><li><Link href="/privacy">Privacy</Link></li></ul></div>
          </div>
          <div className="legal">
            <span>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</span>
            <div><span>Made for founders who&apos;d rather know than guess.</span></div>
          </div>
          <p className="wordmark" aria-hidden="true">{BRAND.name}</p>
        </footer>
    </>
  );
}
