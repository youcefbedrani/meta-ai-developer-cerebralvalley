import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getProject } from "@/server/data/projects";
import { buildDesignExport } from "@/server/services/design";

/** The project kit (.zip) for Claude Code, Cursor or any AI coding tool; ?format=prompt returns just PROMPT.md. */
export async function GET(request: Request, ctx: RouteContext<"/app/projects/[id]/design/export">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await getProject(user.id, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const kit = await buildDesignExport(user.id, id);
  if (new URL(request.url).searchParams.get("format") === "prompt") {
    return new NextResponse(kit.prompt, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": 'attachment; filename="PROMPT.md"', "cache-control": "no-store" } });
  }
  return new NextResponse(Buffer.from(kit.zip), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${kit.filename}"`, "cache-control": "no-store" },
  });
}
