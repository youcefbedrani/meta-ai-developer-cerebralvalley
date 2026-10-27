"use client";

import { cancelJobAction, retryJobAction, setProjectStatusAction } from "@/app/(app)/app/admin/actions";
import { useRun } from "@/components/marketplace/use-run";
import { Button } from "@/components/ui/button";

export function ProjectStatusButton({ projectId, status }: { projectId: string; status: "active" | "archived" }) {
  const { run, pending } = useRun();
  const next = status === "active" ? "archived" : "active";
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setProjectStatusAction(projectId, next), next === "archived" ? "Project archived" : "Project restored")}>
      {next === "archived" ? "Archive" : "Restore"}
    </Button>
  );
}

export function JobButtons({ jobId, status }: { jobId: string; status: string }) {
  const { run, pending } = useRun();
  if (status === "queued" || status === "running") {
    return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelJobAction(jobId), "Job cancelled and refunded")}>Cancel & refund</Button>;
  }
  if (status === "failed" || status === "cancelled") {
    return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => retryJobAction(jobId), "Job queued again (free for the user)")}>Retry free</Button>;
  }
  return null;
}
