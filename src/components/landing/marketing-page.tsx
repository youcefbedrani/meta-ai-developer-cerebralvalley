import { IconSprite } from "./icons";
import { LandingEffects } from "./landing-effects";
import { MarketingFooter, MarketingHeader } from "./marketing-chrome";

/** Shell for secondary public pages (pricing, legal) in the landing design. */
export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing" id="landing">
      <IconSprite />
      <MarketingHeader />
      <main className="frame">
        {children}
        <MarketingFooter />
      </main>
      <LandingEffects />
    </div>
  );
}

/** Readable long-form text block for legal pages. */
export function LegalArticle({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <section className="pad">
      <article className="legal-doc">
        <h1 className="h2">{title}</h1>
        <p className="lead">Last updated {updated}</p>
        <div className="legal-notice">
          Template notice: this text is a starting point, not legal advice. Replace the bracketed details and have it reviewed by a qualified lawyer before launch.
        </div>
        {children}
      </article>
    </section>
  );
}
