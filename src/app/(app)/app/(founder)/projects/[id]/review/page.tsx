import { notFound } from "next/navigation";
import { PageReviewPanel, type ReviewItem } from "@/components/page-review/page-review-panel";
import { CREDIT_COSTS } from "@/lib/plans";
import type { CompetitorPageReview, OwnPageReview } from "@/lib/validation/page-review";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { getProject } from "@/server/data/projects";
import { listPageReviews } from "@/server/services/page-review";

export default async function ProjectReviewPage({ params, searchParams }: PageProps<"/app/projects/[id]/review">) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  const { r } = await searchParams;
  const project = await getProject(user.id, id);
  if (!project) notFound();
  const [rows, balance] = await Promise.all([listPageReviews(user.id, id), getBalance(user.id)]);
  const reviews: ReviewItem[] = rows.map((row) => ({
    id: row.id,
    mode: row.mode,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
    result: row.result as OwnPageReview | CompetitorPageReview,
  }));
  const selected = reviews.find((x) => x.id === r) ?? reviews[0] ?? null;
  return <PageReviewPanel projectId={id} reviews={reviews} selected={selected} cost={CREDIT_COSTS.page_review} balance={balance} />;
}
