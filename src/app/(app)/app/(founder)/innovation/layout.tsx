import { ModuleGate } from "@/components/app/module-gate";

export default function InnovationLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="innovation">{children}</ModuleGate>;
}
