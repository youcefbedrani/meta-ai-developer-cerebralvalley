import { notFound } from "next/navigation";
import { BrandKitView } from "@/components/brand-kit/brand-kit-view";
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
  return <BrandKitView projectId={project.id} kit={parseStoredBrand(project.brand)} cost={CREDIT_COSTS.brand_kit} balance={balance} />;
}
