import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { startInnovationScan } from "@/server/services/innovation";
import { errorResponse, sameOrigin } from "@/server/upload-routes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Start a Traditional → Innovative scan: the form fields plus up to 8 files (video, photos, PDFs). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    const form = await request.formData();
    const field = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" && v.trim() ? v : undefined;
    };
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const data = await startInnovationScan(
      user.id,
      { mode: field("mode"), title: field("title"), notes: field("notes"), industry: field("industry") ?? null, companySize: field("companySize") ?? null, region: field("region") },
      files,
    );
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
