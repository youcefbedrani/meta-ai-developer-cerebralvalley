"use client";

import { Loader2, Plus } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { addRecommendedExperimentAction } from "@/app/(app)/app/(founder)/lab/actions";
import { Button } from "@/components/ui/button";

export function AddRecommendedButton({ projectId, index }: { projectId: string; index: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 rounded-[10px]"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await addRecommendedExperimentAction(projectId, index);
          if (r && !r.ok) toast.error(r.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add to lab
    </Button>
  );
}
