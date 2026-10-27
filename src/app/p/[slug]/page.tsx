import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingView } from "@/components/public/landing-view";
import { VisitPing, WaitlistForm } from "@/components/public/waitlist-form";
import { getPublishedPage } from "@/server/data/landing-pages";
import { BRAND } from "@/lib/brand";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const page = await getPublishedPage((await params).slug);
  return page ? { title: { absolute: page.content.headline }, description: page.content.subheadline } : { title: "Not found" };
}

/** Public validation landing page with a real waitlist, in the theme the founder picked. Only published pages render. */
export default async function PublicLandingPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  return (
    <div className="flex min-h-screen flex-col [&>div]:flex-1">
      <VisitPing slug={page.slug} />
      <LandingView content={page.content} brand={page.brand} projectName={page.projectName} cta={<WaitlistForm slug={page.slug} ctaLabel={page.content.ctaLabel} />} footer={`Validation page built with ${BRAND.name}`} />
    </div>
  );
}
