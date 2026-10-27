import { ModuleGate } from "@/components/app/module-gate";

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="research">{children}</ModuleGate>;
}
