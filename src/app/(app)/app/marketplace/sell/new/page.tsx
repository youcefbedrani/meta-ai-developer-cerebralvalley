import type { Metadata } from "next";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { PageHeader } from "@/components/app/page-header";
import { ListingWizard } from "@/components/marketplace/listing-wizard";
import { MarketplaceNav } from "@/components/marketplace/shared";
import { ideaContentSchema } from "@/lib/validation/ideas";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getDb, schema } from "@/server/db/client";
import { listProjects } from "@/server/data/projects";
import { requireMarketplace } from "@/server/marketplace/guard";
import { getProjectValidation } from "@/server/marketplace/stats";

export const metadata: Metadata = { title: "Sell an idea or project" };

const ACTIVE = ["draft", "pending_review", "published"];

export default async function NewListingPage() {
  requireMarketplace();
  const user = await requireOnboardedUser();
  const db = getDb();
  const [projects, ideaRows, active] = await Promise.all([
    listProjects(user.id, { status: "active" }),
    db
      .select({ id: schema.ideas.id, title: schema.ideas.title, content: schema.ideas.content, projectName: schema.projects.name })
      .from(schema.ideas)
      .leftJoin(schema.projects, eq(schema.projects.id, schema.ideas.projectId))
      .where(and(eq(schema.ideas.userId, user.id), ne(schema.ideas.status, "dismissed")))
      .orderBy(desc(schema.ideas.updatedAt))
      .limit(100),
    db.select({ projectId: schema.listings.projectId, ideaId: schema.listings.ideaId, status: schema.listings.status }).from(schema.listings).where(and(eq(schema.listings.sellerId, user.id), inArray(schema.listings.status, ["draft", "pending_review", "published"]))),
  ]);
  const listed = (pred: (a: (typeof active)[number]) => boolean) => active.some((a) => pred(a) && ACTIVE.includes(a.status));
  const rows = await Promise.all(projects.map(async (p) => ({ id: p.id, name: p.name, level: (await getProjectValidation(p.id)).level, listed: listed((a) => a.projectId === p.id) })));
  const ideas = ideaRows.flatMap((i) => {
    const c = ideaContentSchema.safeParse(i.content);
    return c.success ? [{ id: i.id, title: i.title, oneLiner: c.data.oneLiner, listed: listed((a) => a.ideaId === i.id), fromProject: i.projectName }] : [];
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Sell an idea or project" description="Buyers see only the niche, your price and your earning estimate. The idea itself unlocks after they sign an NDA and you grant access (or they make an offer)." />
      <MarketplaceNav active="sell" />
      <ListingWizard projects={rows} ideas={ideas} />
    </div>
  );
}
