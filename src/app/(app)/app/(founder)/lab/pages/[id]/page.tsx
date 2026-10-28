import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LandingEditor } from "@/components/lab/landing-editor";
import { getEnv, getIntegrationStatus } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getLandingPage, getPageStats, listSignups } from "@/server/data/landing-pages";
import { getProject } from "@/server/data/projects";
import { getBrandKit } from "@/server/services/brand";
import { listBrandAssets } from "@/server/services/brand-visuals";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function LandingPageEditor({ params }: PageProps<"/app/lab/pages/[id]">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const page = await getLandingPage(user.id, id);
  if (!page) notFound();
  const [stats, signups, project, brand] = await Promise.all([getPageStats(page.id), listSignups(user.id, page.id), getProject(user.id, page.projectId), getBrandKit(user.id, page.projectId)]);
  const heroImages = (await listBrandAssets(user.id, page.projectId)).filter((a) => a.kind === "hero").map((a) => a.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={page.experimentId ? `/app/lab/${page.experimentId}` : `/app/projects/${page.projectId}/validation`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Back to experiment
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Landing page</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {page.published ? "Published" : "Draft — publish it to start collecting signups."} · {stats.visits} unique visits · {stats.signups} signups
          {stats.conversion !== null ? ` · ${(stats.conversion * 100).toFixed(1)}% conversion` : ""}
        </p>
      </div>
      <LandingEditor mode="edit" projectId={page.projectId} projectName={project?.name ?? "Your product"} brand={brand} brandCost={CREDIT_COSTS.brand_kit} pageId={page.id} initial={page.content} slug={page.slug} published={page.published} aiConfigured={getIntegrationStatus("ai").configured} copyCost={CREDIT_COSTS.landing_copy} appUrl={getEnv().APP_URL} heroImages={heroImages} />
      <section className="surface p-6">
        <h2 className="font-medium">Waitlist ({signups.length})</h2>
        <p className="mt-1 text-xs text-muted-foreground">Personal data — only you can see these emails. Use them only to contact people about this product.</p>
        {signups.length ? (
          <ul className="mt-4 divide-y divide-border text-sm">
            {signups.map((s) => <li key={s.email} className="flex justify-between gap-3 py-2"><span className="truncate">{s.email}</span><span className="shrink-0 text-xs text-muted-foreground">{fmt.format(s.createdAt)}</span></li>)}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No signups yet.</p>
        )}
      </section>
    </div>
  );
}
