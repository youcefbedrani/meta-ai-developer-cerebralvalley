import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScanResult } from "@/components/innovation/scan-result";
import { requireFounder } from "@/server/auth/current-user";
import { getInnovationScan, ideasOf, observationOf, scanInputOf, scanMediaOf } from "@/server/services/innovation";

export const metadata: Metadata = { title: "Scan · Traditional → Innovative" };

export default async function ScanPage({ params }: PageProps<"/app/innovation/[scanId]">) {
  const user = await requireFounder();
  const { scanId } = await params;
  const scan = await getInnovationScan(user.id, scanId).catch(() => null);
  if (!scan) notFound();
  const input = scanInputOf(scan);
  const media = scanMediaOf(scan);
  const src = (key: string) => `/app/innovation/${scan.id}/media?key=${encodeURIComponent(key)}`;
  return (
    <div className="space-y-6">
      <Link href="/app/innovation" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4" /> Traditional → Innovative</Link>
      <ScanResult
        scan={{
          id: scan.id,
          mode: input.mode,
          title: scan.title,
          status: scan.status,
          stage: scan.stage,
          error: scan.error,
          industry: input.industry,
          notes: input.notes,
          createdAt: scan.createdAt.toISOString(),
        }}
        media={media.map((m) => ({
          kind: m.kind,
          name: m.name,
          durationSec: m.durationSec ?? null,
          transcript: m.transcript ?? null,
          pdfChars: m.pdfChars ?? null,
          image: m.kind === "image" ? src(m.key) : null,
          frames: (m.frames ?? []).map((f) => ({ src: src(f.key), atSec: f.atSec })),
        }))}
        observation={observationOf(scan)}
        ideas={ideasOf(scan)}
      />
    </div>
  );
}
