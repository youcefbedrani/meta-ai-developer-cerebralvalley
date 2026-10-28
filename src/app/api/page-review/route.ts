import { NextResponse } from "next/server";
import { PAGE_REVIEW_MAX_MB } from "@/lib/validation/page-review";
import { getCurrentUser } from "@/server/auth/current-user";
import { reviewPage } from "@/server/services/page-review";
import { errorResponse, sameOrigin } from "@/server/upload-routes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Upload a page screenshot (own landing page or a competitor's) for a Muse Spark vision review. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    const mode = form.get("mode") === "competitor" ? "competitor" : "own";
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, error: "Choose a screenshot." }, { status: 400 });
    if (file.size > PAGE_REVIEW_MAX_MB * 1024 * 1024) return NextResponse.json({ ok: false, error: `Screenshots can be up to ${PAGE_REVIEW_MAX_MB} MB.` }, { status: 413 });
    const review = await reviewPage(user.id, String(form.get("projectId") ?? ""), mode, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, data: { id: review.id } });
  } catch (err) {
    return errorResponse(err);
  }
}
