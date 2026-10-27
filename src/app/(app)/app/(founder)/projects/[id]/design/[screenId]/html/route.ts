import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getDesignScreen } from "@/server/services/design";

/**
 * Serves a generated screen's HTML. The sandbox CSP gives the document an opaque origin, so its
 * scripts (Stitch uses the Tailwind CDN) can run but can't read cookies or reach the app.
 */
export async function GET(request: Request, ctx: RouteContext<"/app/projects/[id]/design/[screenId]/html">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id, screenId } = await ctx.params;
  const screen = await getDesignScreen(user.id, screenId);
  if (!screen || screen.projectId !== id || !screen.html) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const file = `${screen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "screen"}.html`;
  return new NextResponse(screen.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "sandbox allow-scripts allow-popups",
      "cache-control": "private, no-store",
      ...(download ? { "content-disposition": `attachment; filename="${file}"` } : {}),
    },
  });
}
