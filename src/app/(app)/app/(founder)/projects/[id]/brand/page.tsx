import { notFound } from "next/navigation";
import { BrandKitView } from "@/components/brand-kit/brand-kit-view";
import { BrandVisuals } from "@/components/brand-kit/brand-visuals";
import { isImageConfigured } from "@/server/ai/image";
import { listBrandAssets } from "@/server/services/brand-visuals";
import { parseStoredBrand } from "@/lib/brand-kit";
import { CREDIT_COSTS } from "@/lib/plans";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { getProject } from "@/server/data/projects";

/** Brand Kit: names, tagline, palette, fonts and a downloadable logo for the project. */
export default async function BrandPage({ params }: PageProps<"/app/projects/[id]/brand">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const [project, balance] = await Promise.all([getProject(user.id, id), getBalance(user.id)]);
  if (!project) notFound();
  const kit = parseStoredBrand(project.brand);
  const assets = await listBrandAssets(user.id, project.id);
  return (
    <div className="space-y-6">
      <BrandKitView projectId={project.id} kit={kit} cost={CREDIT_COSTS.brand_kit} balance={balance} />
      <BrandVisuals
        projectId={project.id}
        assets={assets.map((a) => ({ id: a.id, kind: a.kind, channel: a.channel, headline: a.headline, rationale: a.rationale, width: a.width, height: a.height, hasCutout: !!a.cutoutKey, createdAt: a.createdAt.toISOString() }))}
        cost={CREDIT_COSTS.brand_visuals}
        balance={balance}
        configured={isImageConfigured()}
        hasKit={!!kit}
      />
    </div>
  );
}
