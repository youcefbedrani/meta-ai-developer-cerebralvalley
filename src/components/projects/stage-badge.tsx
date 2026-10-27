import { PROJECT_STAGES, type ProjectStage } from "@/lib/validation/project";
import { cn } from "@/lib/utils";

const STYLES: Record<ProjectStage, string> = {
  idea: "border-border text-muted-foreground",
  research: "border-sky-300 text-sky-700",
  validation: "border-violet-300 text-violet-700",
  planning: "border-indigo-300 text-indigo-700",
  building: "border-amber-300 text-amber-700",
  launched: "border-emerald-300 text-emerald-700",
};

export function StageBadge({ stage, className }: { stage: ProjectStage; className?: string }) {
  const label = PROJECT_STAGES.find((s) => s.value === stage)?.label ?? stage;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", STYLES[stage], className)}>
      {label}
    </span>
  );
}
