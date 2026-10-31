import Link from "next/link";
import { notFound } from "next/navigation";
import { PrototypeViewer } from "@/components/design/prototype-viewer";
import { CREDIT_COSTS } from "@/lib/plans";
import { startScreen } from "@/lib/prototype";
import { requireFounder } from "@/server/auth/current-user";
import { getBalance } from "@/server/billing/credits";
import { getProject } from "@/server/data/projects";
import { getLatestCodebase } from "@/server/services/codebase";
import { listDesignScreens } from "@/server/services/design";

/** The designed screens as a clickable prototype; approving it generates the code. */
export default async function PrototypePage({ params }: PageProps<"/app/projects/[id]/design/prototype">) {
  const user = await requireFounder();
  const { id } = await params;
  if (!(await getProject(user.id, id))) notFound();
  const [screens, balance, codebase] = await Promise.all([listDesignScreens(user.id, id), getBalance(user.id), getLatestCodebase(user.id, id)]);
  const done = screens.filter((s) => s.status === "succeeded" && s.html);
  const first = startScreen(done);
  if (!first) {
    return (
      <div className="surface p-8 text-center">
        <p className="font-medium">No screens to click through yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Design a few screens first; the prototype links them together.</p>
        <Link href={`/app/projects/${id}/design`} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Go to Design →</Link>
      </div>
    );
  }
  return (
    <PrototypeViewer
      projectId={id}
      screens={done.map((s) => ({ id: s.id, name: s.name, device: s.device, links: (s.html!.match(/data-goto=/g) ?? []).length }))}
      startId={first.id}
      cost={CREDIT_COSTS.codebase}
      balance={balance}
      hasCode={!!codebase}
    />
  );
}
