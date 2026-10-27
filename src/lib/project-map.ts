/*
 * Project map: what a project has, what's partly there and what's missing, from real counts only.
 * Pure (no DB) so the rules are unit-tested; the counts come from src/server/data/project-map.ts.
 */

export type ProjectCounts = {
  descriptionLength: number;
  hasIdea: boolean;
  reports: number;
  sources: number;
  facts: number;
  analysis: number;
  assumptions: number;
  competitors: number;
  competitorsWithPricing: number;
  customerQuotes: number;
  experiments: number;
  experimentsCompleted: number;
  results: number;
  landingPages: number;
  landingPublished: number;
  visits: number;
  signups: number;
  decision: "build" | "pivot" | "drop" | null;
  mvpPlan: boolean;
  businessModel: boolean;
  marketingPlan: boolean;
  channels: number;
  channelResults: number;
  adTests: number;
  listing: string | null;
};

export type NodeStatus = "done" | "partial" | "missing";

export type MapNode = {
  id: string;
  label: string;
  status: NodeStatus;
  /** Short fact line, e.g. "14 sources · 22 facts". */
  metric: string;
  /** What's missing and why it matters (empty when done). */
  missing: string;
  href: string;
  cta: string;
};

export type MapPhase = { id: string; label: string; nodes: MapNode[] };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function buildProjectMap(c: ProjectCounts, projectId: string): MapPhase[] {
  const base = `/app/projects/${projectId}`;
  const node = (n: MapNode) => n;

  return [
    {
      id: "discover",
      label: "Discover",
      nodes: [
        node({
          id: "idea",
          label: "Idea",
          status: c.descriptionLength >= 80 || c.hasIdea ? "done" : c.descriptionLength > 0 ? "partial" : "missing",
          metric: c.hasIdea ? "Linked to a saved idea" : `${c.descriptionLength} characters of description`,
          missing: c.descriptionLength >= 80 || c.hasIdea ? "" : "Describe who has the problem and how they solve it today. Research uses this to search.",
          href: base,
          cta: "Edit description",
        }),
        node({
          id: "research",
          label: "Market research",
          status: c.reports > 0 && c.sources >= 5 ? "done" : c.reports > 0 ? "partial" : "missing",
          metric: c.reports ? `${plural(c.sources, "source")} · ${plural(c.facts, "fact")}` : "No report yet",
          missing: c.reports === 0 ? "No research report. Run research to get cited facts about demand and the market." : c.sources < 5 ? "Few sources. Make the description more specific and run research again." : "",
          href: `${base}/research`,
          cta: c.reports ? "Open report" : "Run research",
        }),
        node({
          id: "competitors",
          label: "Competitors",
          status: c.competitors >= 3 && c.competitorsWithPricing > 0 ? "done" : c.competitors > 0 ? "partial" : "missing",
          metric: c.competitors ? `${plural(c.competitors, "competitor")} · ${c.competitorsWithPricing} with sourced pricing` : "None found yet",
          missing:
            c.competitors === 0
              ? "No competitors mapped. Scan for competitors to see who already serves these customers."
              : c.competitors < 3
                ? "Only a few competitors found. Scan again to find alternatives people use."
                : c.competitorsWithPricing === 0
                  ? "No competitor pricing found in sources yet. Pricing anchors your own price."
                  : "",
          href: `${base}/competitors`,
          cta: "View competitors",
        }),
        node({
          id: "language",
          label: "Market voices",
          status: c.customerQuotes >= 5 ? "done" : c.customerQuotes > 0 ? "partial" : "missing",
          metric: plural(c.customerQuotes, "real quote"),
          missing: c.customerQuotes >= 5 ? "" : "Few real customer quotes. Scan Reddit, Quora, YouTube and more to hear how people describe the problem; their words power your copy and ads.",
          href: `${base}/language`,
          cta: "Scan platforms",
        }),
      ],
    },
    {
      id: "validate",
      label: "Validate",
      nodes: [
        node({
          id: "experiments",
          label: "Experiments",
          status: c.experimentsCompleted > 0 && c.results > 0 ? "done" : c.experiments > 0 ? "partial" : "missing",
          metric: c.experiments ? `${c.experimentsCompleted}/${c.experiments} completed · ${plural(c.results, "result")}` : "None yet",
          missing:
            c.experiments === 0
              ? `Nothing tested with real people yet.${c.assumptions ? ` Your research has ${plural(c.assumptions, "assumption")} to test.` : ""}`
              : c.results === 0
                ? "Experiments have no recorded results. Only real results count as validation."
                : c.experimentsCompleted === 0
                  ? "No experiment marked complete yet."
                  : "",
          href: `${base}/validation`,
          cta: c.experiments ? "Record results" : "Plan an experiment",
        }),
        node({
          id: "landing",
          label: "Landing page",
          status: c.landingPublished > 0 && c.signups > 0 ? "done" : c.landingPages > 0 ? "partial" : "missing",
          metric: c.landingPages ? `${c.visits} visits · ${plural(c.signups, "signup")}` : "No page yet",
          missing: c.landingPages === 0 ? "No landing page. A waitlist page measures real interest." : c.landingPublished === 0 ? "Page not published yet." : c.signups === 0 ? "Published, but no signups yet. Send traffic to it." : "",
          href: `${base}/validation`,
          cta: c.landingPages ? "Open page" : "Create page",
        }),
        node({
          id: "decision",
          label: "Decision",
          status: c.decision ? "done" : "missing",
          metric: c.decision ? `Decided: ${c.decision}` : "Not decided",
          missing: c.decision ? "" : c.results > 0 ? "You have results. Record build, pivot or drop." : "Decide after you have real results.",
          href: `${base}/validation`,
          cta: "Decide",
        }),
      ],
    },
    {
      id: "build",
      label: "Build",
      nodes: [
        node({
          id: "business",
          label: "Business model",
          status: c.businessModel ? "done" : "missing",
          metric: c.businessModel ? "Drafted" : "Not drafted",
          missing: c.businessModel ? "" : "No business model. Draft pricing and costs from your research.",
          href: `${base}/plan`,
          cta: "Open plan",
        }),
        node({
          id: "mvp",
          label: "MVP plan",
          status: c.mvpPlan ? "done" : "missing",
          metric: c.mvpPlan ? "Planned" : "Not planned",
          missing: c.mvpPlan ? "" : "No MVP plan. Scope the smallest version to build.",
          href: `${base}/plan`,
          cta: "Plan MVP",
        }),
      ],
    },
    {
      id: "grow",
      label: "Grow",
      nodes: [
        node({
          id: "marketing",
          label: "Marketing plan",
          status: c.marketingPlan && c.channels > 0 ? "done" : c.marketingPlan ? "partial" : "missing",
          metric: c.marketingPlan ? `${plural(c.channels, "channel")} · ${plural(c.adTests, "ad test")}` : "No plan yet",
          missing: c.marketingPlan ? (c.channels ? "" : "Plan exists but no channels are set up.") : "No marketing plan. Pick the 1–2 channels your audience uses.",
          href: `${base}/marketing`,
          cta: "Open Marketing Studio",
        }),
        node({
          id: "results",
          label: "Results",
          status: c.channelResults > 0 || c.signups >= 10 ? "done" : c.visits > 0 ? "partial" : "missing",
          metric: `${plural(c.channelResults, "logged result")} · ${plural(c.signups, "signup")}`,
          missing: c.channelResults > 0 || c.signups >= 10 ? "" : "No measured marketing results yet. Log spend, clicks and signups per channel.",
          href: `${base}/marketing`,
          cta: "Log results",
        }),
      ],
    },
    ...(c.listing
      ? [{ id: "sell", label: "Marketplace", nodes: [node({ id: "listing", label: "Listing", status: c.listing === "published" || c.listing === "sold" ? "done" : "partial", metric: `Listing ${c.listing.replace("_", " ")}`, missing: "Listing not live yet.", href: "/app/marketplace/sell", cta: "Open listing" })] }]
      : []),
  ];
}

export function mapProgress(phases: MapPhase[]): { done: number; partial: number; total: number; percent: number } {
  const nodes = phases.flatMap((p) => p.nodes);
  const done = nodes.filter((n) => n.status === "done").length;
  const partial = nodes.filter((n) => n.status === "partial").length;
  return { done, partial, total: nodes.length, percent: nodes.length ? Math.round(((done + partial * 0.5) / nodes.length) * 100) : 0 };
}

/** The gaps in path order: an early gap (no research) matters more than a late one (no ad test). */
export function topGaps(phases: MapPhase[], limit = 3): MapNode[] {
  return phases.flatMap((p) => p.nodes).filter((n) => n.status !== "done").slice(0, limit);
}
