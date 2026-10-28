import { ModuleGate } from "@/components/app/module-gate";

export default function ProjectAutopilotLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="research">{children}</ModuleGate>;
}
