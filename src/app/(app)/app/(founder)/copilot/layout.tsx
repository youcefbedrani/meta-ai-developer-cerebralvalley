import { ModuleGate } from "@/components/app/module-gate";

export default function CopilotLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="copilot">{children}</ModuleGate>;
}
