import { ModuleGate } from "@/components/app/module-gate";

export default function ProjectReviewLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="lab">{children}</ModuleGate>;
}
