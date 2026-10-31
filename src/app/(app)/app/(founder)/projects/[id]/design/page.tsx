import { notFound } from "next/navigation";
import { DesignStudio } from "@/components/design/design-studio";
import { buildCodingPrompt, screenFileName, type Platform } from "@/lib/design-prompt";
import { isMockProvider } from "@/lib/env";
import { CREDIT_COSTS } from "@/lib/plans";
import { requireFounder } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { getProject } from "@/server/data/projects";
import { getCodebaseState } from "@/server/services/codebase";
import { getDesignContext, listDesignScreens } from "@/server/services/design";

/** MVP design: screens from the project's data → a clickable prototype → approve → generated code. */
export default async function DesignPage({ params }: PageProps<"/app/projects/[id]/design">) {
  const user = await requireFounder();
  const { id } = await params;
  if (!(await getProject(user.id, id))) notFound();
  const [{ ctx, sources }, screens, balance, code] = await Promise.all([getDesignContext(user.id, id), listDesignScreens(user.id, id), getBalance(user.id), getCodebaseState(user.id, id)]);
  const done = screens.filter((s) => s.status === "succeeded");
  const platform: Platform = done.length && done.every((s) => s.device === "MOBILE") ? "mobile" : "web";
  const codingPrompt = done.length ? buildCodingPrompt(ctx, done.map((s, i) => ({ name: s.name, file: screenFileName(i, s.name) })), platform) : null;
  return (
    <DesignStudio
      projectId={id}
      ctx={ctx}
      sources={sources}
      screens={screens.map((s) => ({ id: s.id, name: s.name, device: s.device, status: s.status, error: s.error, imageUrl: s.imageUrl }))}
      cost={CREDIT_COSTS.design_screen}
      balance={balance}
      provider={isMockProvider("design") ? "mock" : process.env.DESIGN_PROVIDER === "builtin" ? "builtin" : process.env.DESIGN_PROVIDER === "muse" ? "muse" : "stitch"}
      codingPrompt={codingPrompt}
      codebaseCost={CREDIT_COSTS.codebase}
      codebaseJob={code.job ? { status: code.job.status, stage: code.job.stage, error: code.job.error } : null}
      codebase={code.codebase ? { createdAt: code.codebase.createdAt.toISOString(), files: Object.keys(code.codebase.files).length, screens: code.codebase.screens, entities: code.codebase.entities, failedScreens: code.codebase.failedScreens } : null}
    />
  );
}
