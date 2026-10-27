import { ModuleGate } from "@/components/app/module-gate";

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="resources">{children}</ModuleGate>;
}
