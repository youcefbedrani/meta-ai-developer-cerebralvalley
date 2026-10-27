import type { Metadata } from "next";
import { CopilotChat } from "@/components/copilot/copilot-chat";
import { COPILOT_TOOLS, toolById } from "@/lib/copilot";
import { getIntegrationStatus, isMockProvider } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { requireFounder } from "@/server/auth/current-user";
import { getAiUsage } from "@/server/ai/budget";
import { getBalance } from "@/server/billing/credits";
import { listProjects } from "@/server/data/projects";
import { getCopilotThread, listCopilotThreads } from "@/server/services/copilot";

export const metadata: Metadata = { title: "AI Copilot" };

/** AI Copilot: marketing, copywriting, sales, product and strategy help, with the client's project as context. */
export default async function CopilotPage({ searchParams }: PageProps<"/app/copilot">) {
  const user = await requireFounder();
  const sp = (await searchParams) as { thread?: string; tool?: string; project?: string };
  const [threads, projects, open, usage, balance] = await Promise.all([
    listCopilotThreads(user.id),
    listProjects(user.id, { status: "active" }),
    sp.thread ? getCopilotThread(user.id, sp.thread) : Promise.resolve(null),
    getAiUsage(user.id, user.plan),
    getBalance(user.id),
  ]);
  const tool = toolById(open?.thread.tool ?? sp.tool ?? "chat");
  const projectId = open ? open.thread.projectId : (projects.find((p) => p.id === sp.project)?.id ?? projects[0]?.id ?? null);
  return (
    <CopilotChat
      key={open?.thread.id ?? `new-${tool.id}`}
      tools={COPILOT_TOOLS.map(({ id, group, label, description, placeholder }) => ({ id, group, label, description, placeholder }))}
      toolId={tool.id}
      threadId={open?.thread.id ?? null}
      messages={(open?.messages ?? []).map((m) => ({ id: m.id, role: m.role, content: m.content, cached: m.cached }))}
      threads={threads.map((t) => ({ id: t.id, title: t.title, tool: t.tool }))}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      projectId={projectId}
      usage={usage}
      balance={balance}
      cost={CREDIT_COSTS.copilot_message}
      plan={user.plan}
      aiReady={getIntegrationStatus("ai").configured}
      mock={isMockProvider("ai")}
    />
  );
}
