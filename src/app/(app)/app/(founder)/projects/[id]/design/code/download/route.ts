import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getProject } from "@/server/data/projects";
import { buildCodebaseZip } from "@/server/services/codebase";

/** The latest generated codebase as a .zip (one folder, ready for `npm install && npm run dev`). */
export async function GET(_request: Request, ctx: RouteContext<"/app/projects/[id]/design/code/download">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await getProject(user.id, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const out = await buildCodebaseZip(user.id, id);
  if (!out) return NextResponse.json({ error: "No code generated yet" }, { status: 404 });
  return new NextResponse(Buffer.from(out.zip), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${out.filename}"`, "cache-control": "no-store" },
  });
}
