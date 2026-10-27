import { Ban, Crosshair, ImageIcon, KeyRound, ListOrdered, Megaphone, Scale } from "lucide-react";
import { CopyButton } from "@/components/gold-mine/copy-button";
import { FitBlock } from "./fit-block";
import { SEARCH_PLATFORMS, type MarketingPlan } from "@/lib/validation/marketing";
import { cn } from "@/lib/utils";

type Platform = MarketingPlan["paid"]["platforms"][number];
type Ad = Platform["ads"][number];

const FIT: Record<Platform["fit"], { label: string; className: string }> = {
  recommended: { label: "Test first", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  test_later: { label: "Test later", className: "border-amber-200 bg-amber-50 text-amber-700" },
  skip: { label: "Skip for now", className: "border-border bg-muted/50 text-muted-foreground" },
};
const ORDER: Platform["fit"][] = ["recommended", "test_later", "skip"];

export function PaidSection({ plan }: { plan: MarketingPlan }) {
  const { paid } = plan;
  const platforms = [...paid.platforms].sort((a, b) => ORDER.indexOf(a.fit) - ORDER.indexOf(b.fit));
  const active = platforms.filter((p) => p.fit !== "skip");
  const skipped = platforms.filter((p) => p.fit === "skip");

  return (
    <>
      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><Megaphone className="size-4 text-primary" /> Paid channels</h2>
        <p className="text-xs text-muted-foreground">Costs money. Use small tests to learn fast. Every major ad platform is assessed for your audience below.</p>
        {paid.summary ? <p className="mt-3 text-sm">{paid.summary}</p> : null}
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((p) => (
            <li key={p.platform} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm">
              <span className="truncate">{p.platform}</span>
              <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px]", FIT[p.fit].className)}>{FIT[p.fit].label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-medium"><Scale className="size-4 text-primary" /> Your first ad test</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Suggested starting test: about {paid.testBudget.currency} {paid.testBudget.amountPerDay}/day for {paid.testBudget.durationDays} days. {paid.testBudget.note}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">This is a suggestion, not a forecast. Only spend what you can afford to lose while learning.</p>
        <div className="mt-4 grid gap-5 text-sm md:grid-cols-2">
          {paid.testPlan.length ? (
            <div>
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><ListOrdered className="size-3.5" /> How to run it</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">{paid.testPlan.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          ) : null}
          {paid.decisionRules.length ? (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Decide before you spend</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{paid.decisionRules.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          ) : null}
        </div>
      </section>

      {active.map((p) => <PlatformCard key={p.platform} p={p} />)}

      {skipped.length ? (
        <section className="surface p-6">
          <h2 className="flex items-center gap-2 font-medium"><Ban className="size-4 text-muted-foreground" /> Platforms to skip for now</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {skipped.map((p) => (
              <li key={p.platform} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
                <span className="w-56 shrink-0 font-medium">{p.platform}</span>
                <span className="text-muted-foreground">{p.why}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function PlatformCard({ p }: { p: Platform }) {
  const search = SEARCH_PLATFORMS.includes(p.platform);
  return (
    <section className="surface p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-medium">{p.platform}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{p.why}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("w-fit rounded-full border px-2 py-0.5 text-xs", FIT[p.fit].className)}>{FIT[p.fit].label}</span>
          {p.suggestedMonthlyBudget > 0 ? <span className="text-xs text-muted-foreground">Suggested: {p.suggestedMonthlyBudget}/month</span> : null}
        </div>
      </div>
      <FitBlock c={p} />

      <div className="mt-4 grid gap-5 text-sm md:grid-cols-2">
        {p.targeting.length ? (
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><Crosshair className="size-3.5" /> Targeting</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{p.targeting.map((t) => <li key={t}>{t}</li>)}</ul>
            {p.formats.length ? <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Formats:</span> {p.formats.join(" · ")}</p> : null}
          </div>
        ) : null}
        {p.keywords.length ? (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><KeyRound className="size-3.5" /> Keywords</p>
              <CopyButton text={p.keywords.join("\n")} />
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">{p.keywords.map((k) => <li key={k} className="rounded-md border border-border bg-white px-2 py-0.5 text-xs">{k}</li>)}</ul>
            {p.negativeKeywords.length ? (
              <>
                <p className="mt-3 text-xs text-muted-foreground">Negative keywords (exclude these)</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">{p.negativeKeywords.map((k) => <li key={k} className="rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">−{k}</li>)}</ul>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {p.ads.length ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Ad copy ({p.ads.length} variant{p.ads.length === 1 ? "" : "s"}, test them against each other)</p>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">{p.ads.map((a, i) => (search ? <SearchAd key={i} a={a} /> : <SocialAd key={i} a={a} platform={p.platform} />))}</div>
        </div>
      ) : null}
    </section>
  );
}

const adText = (a: Ad) => [a.headline, a.primaryText, a.description, a.cta].filter(Boolean).join("\n");

function AngleTag({ a }: { a: Ad }) {
  return a.angle ? <span className="rounded-full border border-[var(--violet)]/30 bg-[var(--violet)]/5 px-2 py-0.5 text-[11px] text-[var(--violet)]">Angle: {a.angle}</span> : <span />;
}

function SearchAd({ a }: { a: Ad }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 text-sm">
      <div className="flex items-center justify-between gap-2"><AngleTag a={a} /><CopyButton text={adText(a)} /></div>
      <p className="mt-2 text-xs text-muted-foreground">Sponsored · yoursite.com</p>
      <p className="mt-0.5 text-base font-medium text-[#1a0dab]">{a.headline}</p>
      <p className="mt-1 text-muted-foreground">{a.primaryText}{a.description ? ` ${a.description}` : ""}</p>
      {a.creative ? <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Extensions:</span> {a.creative}</p> : null}
    </div>
  );
}

function SocialAd({ a, platform }: { a: Ad; platform: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white text-sm">
      <div className="flex items-center justify-between gap-2 px-4 pt-3"><AngleTag a={a} /><CopyButton text={adText(a)} /></div>
      <div className="flex items-center gap-2 px-4 pt-2">
        <span className="size-7 rounded-full bg-brand-gradient" />
        <div className="leading-tight"><p className="text-xs font-medium">Your product</p><p className="text-[11px] text-muted-foreground">Sponsored · {platform}</p></div>
      </div>
      <p className="whitespace-pre-wrap px-4 pt-2">{a.primaryText}</p>
      <div className="mx-4 mt-3 flex min-h-24 items-start gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <ImageIcon className="mt-0.5 size-4 shrink-0" /> <span><span className="font-medium text-foreground">Creative idea:</span> {a.creative || "Add an image or video."}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-2.5">
        <div className="min-w-0"><p className="truncate font-medium">{a.headline}</p>{a.description ? <p className="truncate text-xs text-muted-foreground">{a.description}</p> : null}</div>
        <span className="shrink-0 rounded-md bg-[var(--plum)] px-3 py-1.5 text-xs font-medium text-white">{a.cta}</span>
      </div>
    </div>
  );
}
