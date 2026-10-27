import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { getValidationSummary } from "@/server/data/experiments";
import { getLatestBusinessModel, getLatestMvpPlan } from "@/server/data/planning";
import { getProject } from "@/server/data/projects";
import { buildAgentPrompt, buildSpecMarkdown } from "@/server/services/build-kit";

/** Downloads the MVP spec or the coding-agent prompt as Markdown. */
export async function GET(request: Request, ctx: RouteContext<"/app/projects/[id]/plan/export">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getProject(user.id, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [plan, business, validation] = await Promise.all([getLatestMvpPlan(user.id, id), getLatestBusinessModel(user.id, id), getValidationSummary(user.id, id)]);
  if (!plan) return NextResponse.json({ error: "No MVP plan yet" }, { status: 404 });

  const format = new URL(request.url).searchParams.get("format") === "prompt" ? "prompt" : "spec";
  const input = { projectName: project.name, plan: plan.plan, business: business?.model ?? null, validation, decision: project.decision, generatedAt: plan.createdAt };
  const body = format === "prompt" ? buildAgentPrompt(input) : buildSpecMarkdown(input);
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";
  return new NextResponse(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-${format === "prompt" ? "agent-prompt" : "mvp-spec"}.md"`,
      "cache-control": "no-store",
    },
  });
}
