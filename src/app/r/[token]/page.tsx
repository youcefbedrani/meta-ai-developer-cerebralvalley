import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Scorecard } from "@/components/verdict/scorecard";
import { getSharedVerdict } from "@/server/data/verdict";

export const metadata: Metadata = { title: "Validation report", robots: { index: false, follow: false } };

/** Public, read-only verdict report that a founder chose to share (projects.share_token). */
export default async function SharedReportPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const data = await getSharedVerdict(token);
  if (!data || data.verdict.score === null) notFound();
  const { project, verdict, fit, counts, summary } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-8">
          <Logo />
          <span className="text-xs text-muted-foreground">Shared validation report · read only</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{project.name}</h1>
          {project.description ? <p className="mt-2 text-muted-foreground">{project.description}</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">
            Based on {counts.sources} web sources, {counts.facts} sourced facts, {counts.competitors} competitors and {counts.customerQuotes} verified customer quotes
            {counts.signups ? `, plus ${counts.signups} real waitlist signups` : ""}.
          </p>
        </div>
        {summary ? (
          <section className="surface p-5">
            <h2 className="font-medium">Research summary</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{summary}</p>
          </section>
        ) : null}
        <Scorecard verdict={verdict} fit={fit} />
        <p className="text-center text-sm text-muted-foreground">
          Made with Startum: validate your SaaS idea with real evidence.{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">Try it free</Link>
        </p>
      </main>
    </div>
  );
}
