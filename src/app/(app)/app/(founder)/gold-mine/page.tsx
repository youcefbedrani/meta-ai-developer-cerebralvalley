import { ArrowRight, Compass, Lightbulb, Pickaxe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { StartIdeaForm } from "@/components/gold-mine/start-idea-form";
import { buttonVariants } from "@/components/ui/button";
import { GOLD_MINE_STEPS } from "@/lib/validation/gold-mine";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { listSessions } from "@/server/data/gold-mine";

export const metadata: Metadata = { title: "Gold Mine" };
const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function GoldMinePage() {
  const user = await requireOnboardedUser();
  const sessions = await listSessions(user.id);
  return (
    <div className="space-y-8">
      <PageHeader
        title={<span className="flex items-center gap-3"><Pickaxe className="size-7 text-[var(--violet)]" /> Gold Mine</span>}
        description="Find SaaS opportunities from real demand and real customer complaints: Market → Demand → Pains → Ideas → Landing page. Every quote links to the public discussion it came from."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface ambient-glow flex flex-col p-6">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-white"><Compass className="size-5" /></span>
          <h2 className="mt-4 text-lg font-semibold">I don&apos;t have an idea</h2>
          <p className="mt-1 text-sm text-muted-foreground">Explore the market map — Health, Wealth, Relationships — one level at a time, tailored to your profile, until you find a niche worth checking.</p>
          <Link href="/app/gold-mine/market" className={cn(buttonVariants({ variant: "gradient" }), "mt-auto h-10 w-fit px-5")} style={{ marginTop: 24 }}>
            Open the market map <ArrowRight />
          </Link>
        </section>
        <section className="surface flex flex-col p-6">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--plum)] text-white"><Lightbulb className="size-5" /></span>
          <h2 className="mt-4 text-lg font-semibold">I already have an idea</h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">Skip the map. We&apos;ll check demand, mine real complaints and turn them into evidence-backed ideas for your niche.</p>
          <StartIdeaForm />
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Your Gold Mine sessions</h2>
        {sessions.length ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            {sessions.map((s) => (
              <Link key={s.id} href={`/app/gold-mine/${s.id}`} className="flex flex-col gap-2 border-b border-border p-4 last:border-0 hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{s.niche}</p>
                  <p className="text-xs text-muted-foreground">{s.mode === "market" ? (s.marketPath ?? []).join(" › ") : "From my idea"} · started {fmt.format(s.createdAt)}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">Step: {GOLD_MINE_STEPS.find((x) => x.key === s.currentStep)?.label}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground">No sessions yet. Pick one of the two ways to start above.</p>
        )}
      </section>
    </div>
  );
}
