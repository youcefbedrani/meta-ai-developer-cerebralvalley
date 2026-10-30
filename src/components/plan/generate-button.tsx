"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateBusinessModelAction, generateMvpPlanAction } from "@/app/(app)/app/(founder)/projects/[id]/plan/actions";
import { generateLaunchPlaybookAction } from "@/app/(app)/app/(founder)/projects/[id]/playbook/actions";
import { Button } from "@/components/ui/button";

export function GenerateButton({ projectId, kind, label, cost, disabled }: { projectId: string; kind: "business" | "mvp" | "playbook"; label: string; cost: number; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="gradient"
        className="h-9 px-4"
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = kind === "business" ? await generateBusinessModelAction(projectId) : kind === "mvp" ? await generateMvpPlanAction(projectId) : await generateLaunchPlaybookAction(projectId);
            if (!r.ok) return setError(r.error);
            toast.success(kind === "business" ? "Business model generated" : kind === "mvp" ? "MVP plan generated" : "Launch playbook ready");
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {label} · {cost} credits
      </Button>
      {error ? <p role="alert" className="max-w-sm text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
