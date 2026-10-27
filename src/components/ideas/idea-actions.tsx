"use client";

import { Bookmark, BookmarkCheck, EyeOff, FolderPlus, Loader2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { convertIdeaAction, setIdeaStatusAction } from "@/app/(app)/app/(founder)/ideas/actions";
import { Button } from "@/components/ui/button";

type Props = { ideaId: string; status: "generated" | "saved" | "dismissed" | "converted"; projectId: string | null; compact?: boolean };

export function IdeaActions({ ideaId, status, projectId, compact }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Something went wrong");
      else {
        if (success) toast.success(success);
        router.refresh();
      }
    });

  if (status === "converted" && projectId) {
    return (
      <Button variant="outline" size={compact ? "sm" : "default"} className="rounded-[10px]" onClick={() => router.push(`/app/projects/${projectId}`)}>
        <FolderPlus /> Open project
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "saved" ? (
        <Button variant="outline" size={compact ? "sm" : "default"} className="rounded-[10px]" disabled={pending} onClick={() => run(() => setIdeaStatusAction(ideaId, "generated"))}>
          <BookmarkCheck className="text-primary" /> Saved
        </Button>
      ) : status === "dismissed" ? (
        <Button variant="outline" size={compact ? "sm" : "default"} className="rounded-[10px]" disabled={pending} onClick={() => run(() => setIdeaStatusAction(ideaId, "generated"), "Idea restored")}>
          <Undo2 /> Restore
        </Button>
      ) : (
        <Button variant="outline" size={compact ? "sm" : "default"} className="rounded-[10px]" disabled={pending} onClick={() => run(() => setIdeaStatusAction(ideaId, "saved"), "Idea saved")}>
          <Bookmark /> Save
        </Button>
      )}
      {status !== "dismissed" ? (
        <Button variant="ghost" size={compact ? "sm" : "default"} className="rounded-[10px]" disabled={pending} onClick={() => run(() => setIdeaStatusAction(ideaId, "dismissed"), "Idea dismissed")}>
          <EyeOff /> Dismiss
        </Button>
      ) : null}
      <Button
        variant="gradient"
        size={compact ? "sm" : "default"}
        className={compact ? "px-3" : "h-9 px-4"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await convertIdeaAction(ideaId);
            if (r && !r.ok) toast.error(r.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <FolderPlus />} Turn into project
      </Button>
    </div>
  );
}
