import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeViewer } from "@/components/design/code-viewer";
import { codebaseFileOrder } from "@/lib/codebase";
import { requireFounder } from "@/server/auth/current-user";
import { getProject } from "@/server/data/projects";
import { getLatestCodebase } from "@/server/services/codebase";

/** The codebase generated from the approved prototype. */
export default async function CodePage({ params }: PageProps<"/app/projects/[id]/design/code">) {
  const user = await requireFounder();
  const { id } = await params;
  if (!(await getProject(user.id, id))) notFound();
  const codebase = await getLatestCodebase(user.id, id);
  if (!codebase) {
    return (
      <div className="surface p-8 text-center">
        <p className="font-medium">No code yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Design your screens, click through the prototype, then approve it to generate the code.</p>
        <Link href={`/app/projects/${id}/design`} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Go to Design →</Link>
      </div>
    );
  }
  return <CodeViewer projectId={id} name={codebase.name} files={codebase.files} order={codebaseFileOrder(Object.keys(codebase.files))} generatedAt={codebase.createdAt.toISOString()} />;
}
