import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ScanForm, ScanList } from "@/components/innovation/scan-form";
import { COMPANY_SIZES, INDUSTRIES, INNOVATION_LIMITS, type InnovationMode } from "@/lib/validation/innovation";
import { requireFounder } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { listInnovationScans, scanCost } from "@/server/services/innovation";

export const metadata: Metadata = { title: "Traditional → Innovative" };

/** Upload how work is done today (video, photos, PDFs) or pick an industry: Muse Spark proposes the software that replaces it. */
export default async function InnovationPage({ searchParams }: PageProps<"/app/innovation">) {
  const user = await requireFounder();
  const mode: InnovationMode = (await searchParams).mode === "enterprise" ? "enterprise" : "process";
  const [scans, balance] = await Promise.all([listInnovationScans(user.id), getBalance(user.id)]);
  return (
    <div className="space-y-6">
      <PageHeader
        title={<>Traditional <span className="text-gradient">→ Innovative</span></>}
        description="Show how something is done today, by hand or with old tools, and Muse Spark proposes the SaaS, automation or system that replaces it. For a small business's daily work, or for the hard problems of big companies."
      />
      <ScanForm
        mode={mode}
        balance={balance}
        costs={{ process: scanCost("process"), enterprise: scanCost("enterprise") }}
        industries={[...INDUSTRIES]}
        sizes={[...COMPANY_SIZES]}
        limits={{ files: INNOVATION_LIMITS.files, videoMb: INNOVATION_LIMITS.videoMb, imageMb: INNOVATION_LIMITS.imageMb, pdfMb: INNOVATION_LIMITS.pdfMb, videoMinutes: INNOVATION_LIMITS.videoSeconds / 60 }}
      />
      <ScanList
        scans={scans.map((s) => ({ id: s.id, mode: s.mode as InnovationMode, title: s.title, status: s.status, stage: s.stage, ideas: (s.ideas ?? []).length, createdAt: s.createdAt.toISOString() }))}
      />
    </div>
  );
}
