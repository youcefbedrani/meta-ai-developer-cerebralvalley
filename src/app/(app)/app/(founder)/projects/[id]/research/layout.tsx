import { ModuleGate } from "@/components/app/module-gate";

export default function ProjectResearchLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="research">{children}</ModuleGate>;
}
