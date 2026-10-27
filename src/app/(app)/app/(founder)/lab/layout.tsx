import { ModuleGate } from "@/components/app/module-gate";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate module="lab">{children}</ModuleGate>;
}
