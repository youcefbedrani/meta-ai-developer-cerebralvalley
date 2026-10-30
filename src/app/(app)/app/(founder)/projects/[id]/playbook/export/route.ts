import { NextResponse } from "next/server";
import { playbookMarkdown } from "@/lib/launch-playbook-markdown";
import { getCurrentUser } from "@/server/auth/current-user";
import { getLatestLaunchPlaybook } from "@/server/data/planning";
import { getProject } from "@/server/data/projects";

/** Downloads the launch playbook as Markdown. */
export async function GET(_request: Request, ctx: RouteContext<"/app/projects/[id]/playbook/export">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getProject(user.id, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const latest = await getLatestLaunchPlaybook(user.id, id);
  if (!latest) return NextResponse.json({ error: "No launch playbook yet" }, { status: 404 });
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";
  return new NextResponse(playbookMarkdown(project.name, latest.playbook, latest.math, latest.createdAt), {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${slug}-launch-playbook.md"`, "cache-control": "no-store" },
  });
}
